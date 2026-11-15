const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../ayudas/servidor");
const { client, adminClient } = require("../ayudas/cliente");

let srv, admin, shop, pickup, delivery, transfer, cash;
before(async () => {
  srv = await startServer();
  admin = await adminClient(srv.base);
  shop = client(srv.base);
  const site = (await shop.get("/api/site")).data;
  pickup = site.shipping.find((s) => s.name === "Retiro en el local");
  delivery = site.shipping.find((s) => s.name === "Envío a domicilio");
  transfer = site.payments.find((p) => p.name === "Transferencia bancaria");
  cash = site.payments.find((p) => p.name === "Efectivo");
});
after(async () => { await srv.stop(); });

const product = async (extra = {}) => (await admin.post("/api/admin/products", { name: "P", category: "mates", price: 1000, ...extra })).data.id;
const stockOf = async (id) => (await admin.get("/api/admin/products")).data.find((p) => p.id === id).stock;
const base = (items, extra = {}) => ({ items, shippingId: pickup.id, paymentId: cash.id, ...extra });

test("datos iniciales: retiro gratis y envío a coordinar, sin descuentos", () => {
  assert.equal(pickup.price, 0);
  assert.equal(delivery.price, null);
  assert.equal(delivery.needsAddress, true);
  assert.equal(transfer.discount, 0);
});

test("el servidor calcula el total e ignora los precios que manda el cliente", async () => {
  const id = await product({ price: 1000 });
  const r = await shop.post("/api/orders", base([{ id, qty: 2, price: 1, unit: 1 }]));
  assert.equal(r.status, 200);
  assert.equal(r.data.total, 2000);
  assert.equal(r.data.lines[0].unit, 1000);
});

test("precio por mayor: se aplica al llegar a la cantidad mínima, sumando todas las variantes del producto", async () => {
  const id = await product({ price: 1000, wholesalePrice: 800, wholesaleMin: 6, options: [{ name: "Color", values: ["Negro", "Rojo"] }] });
  const q = (qtyNegro, qtyRojo) => shop.post("/api/quote", base([
    { id, qty: qtyNegro, options: { Color: "Negro" } }, { id, qty: qtyRojo, options: { Color: "Rojo" } },
  ]));
  assert.equal((await q(2, 3)).data.total, 5000, "5 unidades: precio normal");
  const r = await q(3, 3);
  assert.equal(r.data.total, 4800, "3 + 3 = 6 unidades: mayorista");
  assert.ok(r.data.lines.every((l) => l.wholesale));
});

test("variantes: hay que elegir una opción disponible de cada grupo", async () => {
  const id = await product({ options: [{ name: "Color", values: ["Negro", { label: "Rojo", soldOut: true }] }, { name: "Virola", values: ["Acero"] }] });
  const quote = (options) => shop.post("/api/quote", base([{ id, qty: 1, options }]));
  assert.equal((await quote({})).status, 400, "sin elegir");
  assert.match((await quote({ Color: "Negro" })).data.error, /virola/i, "falta un grupo");
  assert.match((await quote({ Color: "Rojo", Virola: "Acero" })).data.error, /agotado/i, "valor agotado");
  assert.equal((await quote({ Color: "Verde", Virola: "Acero" })).status, 400, "valor inexistente");
  const ok = await quote({ Color: "Negro", Virola: "Acero" });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.data.lines[0].options, ["Color: Negro", "Virola: Acero"]);
});

test("stock: se descuenta al pedir, no deja pasarse y se repone al cancelar o borrar", async () => {
  const id = await product({ stock: 5 });
  const order = await shop.post("/api/orders", base([{ id, qty: 3 }]));
  assert.equal(await stockOf(id), 2, "5 - 3");
  const over = await shop.post("/api/orders", base([{ id, qty: 3 }]));
  assert.equal(over.status, 400);
  assert.match(over.data.error, /quedan 2/i);
  assert.equal(await stockOf(id), 2, "un pedido rechazado no descuenta");

  await admin.put(`/api/admin/orders/${order.data.id}`, { status: "cancelado" });
  assert.equal(await stockOf(id), 5, "cancelar repone");
  await admin.put(`/api/admin/orders/${order.data.id}`, { status: "nuevo" });
  assert.equal(await stockOf(id), 2, "reabrir vuelve a descontar");
  await admin.del(`/api/admin/orders/${order.data.id}`);
  assert.equal(await stockOf(id), 5, "borrar un pedido libera el stock");

  await shop.post("/api/orders", base([{ id, qty: 5 }]));
  assert.equal(await stockOf(id), 0);
  const pub = (await shop.get("/api/products")).data.find((p) => p.id === id);
  assert.equal(pub.soldOut, true, "al llegar a 0 queda agotado solo");
  assert.equal((await shop.post("/api/orders", base([{ id, qty: 1 }]))).status, 400);
});

test("producto sin control de stock no se descuenta", async () => {
  const id = await product();
  await shop.post("/api/orders", base([{ id, qty: 4 }]));
  assert.equal(await stockOf(id), null);
});

test("descuento por forma de pago: se aplica sobre los productos, no sobre el envío", async () => {
  await admin.put(`/api/admin/payments/${transfer.id}`, { name: "Transferencia bancaria", description: "", discount: 10 });
  await admin.put(`/api/admin/shipping/${delivery.id}`, { name: "Envío a domicilio", description: "", price: 1500, needsAddress: true });
  const id = await product({ price: 10000 });
  const r = await shop.post("/api/quote", { items: [{ id, qty: 1 }], paymentId: transfer.id, shippingId: delivery.id, shipTo: "Calle Falsa 123, Rosario" });
  assert.equal(r.data.subtotal, 10000);
  assert.equal(r.data.discount, 1000);
  assert.equal(r.data.shipping.cost, 1500);
  assert.equal(r.data.total, 10500, "10.000 − 10% + 1.500 de envío");
  assert.equal((await shop.post("/api/quote", { items: [{ id, qty: 1 }], paymentId: cash.id, shippingId: pickup.id })).data.discount, 0, "otra forma de pago, sin descuento");
});

test("envío: obligatorio, con dirección si hace falta, a coordinar y gratis desde un monto", async () => {
  const id = await product({ price: 10000 });
  const items = [{ id, qty: 1 }];
  assert.match((await shop.post("/api/quote", { items, paymentId: cash.id, strict: true })).data.error, /recibir/i, "falta elegir el envío");
  assert.match((await shop.post("/api/quote", { items, shippingId: pickup.id, strict: true })).data.error, /pagar/i, "falta elegir el pago");
  assert.match((await shop.post("/api/quote", { items, shippingId: delivery.id, paymentId: cash.id, strict: true })).data.error, /dirección/i, "falta la dirección");
  // cotización flexible (la usa el carrito): no falla, avisa qué falta
  const soft = (await shop.post("/api/quote", { items })).data;
  assert.deepEqual(soft.missing, ["payment", "shipping"]);
  assert.equal(soft.total, 10000);
  assert.deepEqual((await shop.post("/api/quote", { items, shippingId: delivery.id, paymentId: cash.id })).data.missing, ["address"]);
  assert.equal((await shop.post("/api/orders", { items })).status, 400, "pero el pedido real sí lo exige");

  await admin.put(`/api/admin/shipping/${delivery.id}`, { name: "Envío a domicilio", description: "", price: "", needsAddress: true });
  const pending = (await shop.post("/api/quote", { items, shippingId: delivery.id, paymentId: cash.id, shipTo: "Calle 123, Rosario" })).data;
  assert.equal(pending.shipping.pending, true);
  assert.equal(pending.shipping.cost, null, "costo a coordinar");
  assert.equal(pending.total, 10000, "no suma envío hasta coordinarlo");

  await admin.put(`/api/admin/shipping/${delivery.id}`, { name: "Envío a domicilio", description: "", price: 2000, freeFrom: 9000, needsAddress: true });
  const free = (await shop.post("/api/quote", { items, shippingId: delivery.id, paymentId: cash.id, shipTo: "Calle 123, Rosario" })).data;
  assert.equal(free.shipping.free, true);
  assert.equal(free.total, 10000, "la compra supera $9.000: envío gratis");
  const small = await product({ price: 3000 });
  const paid = (await shop.post("/api/quote", { items: [{ id: small, qty: 1 }], shippingId: delivery.id, paymentId: cash.id, shipTo: "Calle 123, Rosario" })).data;
  assert.equal(paid.total, 5000, "no llega al mínimo: paga el envío");
});

test("si ella desactiva todos los envíos o pagos, ya no se piden", async () => {
  const id = await product({ price: 700 });
  for (const s of (await admin.get("/api/admin/shipping")).data) await admin.put(`/api/admin/shipping/${s.id}`, { name: s.name, description: "", price: s.price, active: false });
  for (const p of (await admin.get("/api/admin/payments")).data) await admin.put(`/api/admin/payments/${p.id}`, { name: p.name, description: "", discount: p.discount, active: false });
  const r = await shop.post("/api/quote", { items: [{ id, qty: 1 }] });
  assert.equal(r.status, 200);
  assert.equal(r.data.shipping, null);
  assert.equal(r.data.payment, null);
});

test("validaciones: carrito vacío, producto oculto y envíos/pagos del panel", async () => {
  assert.equal((await shop.post("/api/quote", { items: [] })).status, 400);
  const id = await product();
  await admin.post("/api/admin/products/bulk", { ids: [id], action: "hide" });
  assert.equal((await shop.post("/api/quote", { items: [{ id, qty: 1 }] })).status, 400, "un producto oculto no se puede pedir");
  assert.equal((await admin.post("/api/admin/shipping", { name: "" })).status, 400);
  assert.equal((await admin.post("/api/admin/shipping", { name: "X", price: "abc" })).status, 400);
  assert.equal((await admin.post("/api/admin/payments", { name: "X", discount: 95 })).status, 400);
  const created = await admin.post("/api/admin/payments", { name: "Tarjeta", discount: 0 });
  assert.equal(created.status, 200);
  assert.equal((await admin.put(`/api/admin/orders/99999`, { status: "atendido" })).status, 404);
  assert.equal((await admin.put(`/api/admin/orders/1`, { status: "raro" })).status, 400);
});
