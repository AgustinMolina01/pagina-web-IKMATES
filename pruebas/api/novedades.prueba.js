// Botón de arrepentimiento, cupones, envío por provincia, textos editables y estadísticas.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../ayudas/servidor");
const { client, adminClient } = require("../ayudas/cliente");

let srv, admin, shop, pickup, cash;
before(async () => {
  srv = await startServer({ ORDER_LIMIT: "500" });
  admin = await adminClient(srv.base);
  shop = client(srv.base);
  const site = (await shop.get("/api/site")).data;
  pickup = site.shipping.find((s) => s.name === "Retiro en el local");
  cash = site.payments.find((p) => p.name === "Efectivo");
});
after(async () => { await srv.stop(); });

const product = async (extra = {}) => (await admin.post("/api/admin/products", { name: "P", category: "mates", price: 10000, ...extra })).data.id;
const pedido = (items, extra = {}) => ({ items, shippingId: pickup.id, paymentId: cash.id, ...extra });

// ---------- Botón de arrepentimiento ----------
test("arrepentimiento: la página existe, da un código y la solicitud llega al panel", async () => {
  const pagina = await fetch(srv.base + "/arrepentimiento");
  assert.equal(pagina.status, 200);
  assert.match(await pagina.text(), /Botón de arrepentimiento/);

  assert.equal((await shop.post("/api/arrepentimiento", { name: "", contact: "x" })).status, 400, "faltan datos");
  const r = await shop.post("/api/arrepentimiento", { name: "Ana Pérez", contact: "ana@mail.com", orderRef: "12", reason: "No me gustó" });
  assert.equal(r.status, 200);
  assert.match(r.data.code, /^ARR-\d{6}$/);

  assert.equal((await shop.get("/api/admin/withdrawals")).status, 401, "el listado es solo para el panel");
  const lista = (await admin.get("/api/admin/withdrawals")).data;
  const s = lista.find((x) => x.code === r.data.code);
  assert.equal(s.name, "Ana Pérez");
  assert.equal(s.status, "nueva");
  await admin.put(`/api/admin/withdrawals/${s.id}`, { status: "resuelta" });
  assert.equal((await admin.get("/api/admin/withdrawals")).data.find((x) => x.id === s.id).status, "resuelta");
});

test("el pie de la tienda tiene el botón de arrepentimiento y Defensa del Consumidor; el sitemap lo incluye", async () => {
  const html = await (await fetch(srv.base + "/")).text();
  assert.match(html, /href="\/arrepentimiento"/);
  assert.match(html, /defensadelconsumidor/);
  assert.match(await (await fetch(srv.base + "/sitemap.xml")).text(), /\/arrepentimiento</);
});

// ---------- Cupones ----------
test("cupones: se validan al crearlos", async () => {
  assert.equal((await admin.post("/api/admin/coupons", { code: "a", value: 10 })).status, 400, "código corto");
  assert.equal((await admin.post("/api/admin/coupons", { code: "MUCHO", value: 95 })).status, 400, "más de 90%");
  assert.equal((await admin.post("/api/admin/coupons", { code: "SINVALOR" })).status, 400, "sin descuento");
  assert.equal((await admin.post("/api/admin/coupons", { code: "dup test", value: 5 })).status, 200);
  assert.equal((await admin.post("/api/admin/coupons", { code: "DUPTEST", value: 5 })).status, 400, "repetido (sin importar espacios ni mayúsculas)");
});

test("cupones: porcentaje sobre lo que queda tras el descuento por pago, monto fijo y compra mínima", async () => {
  const id = await product({ price: 10000 });
  await admin.post("/api/admin/coupons", { code: "DIEZ", kind: "percent", value: 10 });
  await admin.post("/api/admin/coupons", { code: "MIL", kind: "amount", value: 1000, minTotal: 15000 });

  const q1 = (await shop.post("/api/quote", pedido([{ id, qty: 2 }], { coupon: "diez" }))).data;
  assert.equal(q1.coupon.code, "DIEZ");
  assert.equal(q1.coupon.discount, 2000);
  assert.equal(q1.total, 18000);

  const q2 = (await shop.post("/api/quote", pedido([{ id, qty: 1 }], { coupon: "MIL" }))).data;
  assert.equal(q2.coupon, null, "no llega a la compra mínima");
  assert.match(q2.couponError, /desde/);
  assert.equal(q2.total, 10000, "la cotización sigue sin el cupón");
  assert.equal((await shop.post("/api/orders", pedido([{ id, qty: 1 }], { coupon: "MIL" }))).status, 400, "el pedido real no pasa con un cupón inválido");

  const q3 = (await shop.post("/api/quote", pedido([{ id, qty: 2 }], { coupon: "MIL" }))).data;
  assert.equal(q3.total, 19000);
  assert.match((await shop.post("/api/quote", pedido([{ id, qty: 1 }], { coupon: "NOEXISTE" }))).data.couponError, /no existe/);
});

test("cupones: cuenta los usos, respeta el máximo y el vencimiento; queda en el pedido", async () => {
  const id = await product({ price: 5000 });
  await admin.post("/api/admin/coupons", { code: "UNAVEZ", value: 20, maxUses: 1 });
  await admin.post("/api/admin/coupons", { code: "VIEJO", value: 20, expires: "2020-01-01" });
  await admin.post("/api/admin/coupons", { code: "PAUSADO", value: 20, active: false });

  const r = await shop.post("/api/orders", pedido([{ id, qty: 1 }], { coupon: "UNAVEZ" }));
  assert.equal(r.status, 200);
  assert.equal(r.data.total, 4000);
  const cupon = (await admin.get("/api/admin/coupons")).data.find((c) => c.code === "UNAVEZ");
  assert.equal(cupon.uses, 1);
  assert.match((await shop.post("/api/quote", pedido([{ id, qty: 1 }], { coupon: "UNAVEZ" }))).data.couponError, /todas las veces/);
  assert.match((await shop.post("/api/quote", pedido([{ id, qty: 1 }], { coupon: "VIEJO" }))).data.couponError, /vencido/);
  assert.match((await shop.post("/api/quote", pedido([{ id, qty: 1 }], { coupon: "PAUSADO" }))).data.couponError, /no existe/);

  const guardado = (await admin.get("/api/admin/orders")).data.orders.find((o) => o.id === r.data.id);
  assert.equal(guardado.details.coupon.code, "UNAVEZ");
});

// ---------- Envío por provincia ----------
test("envío por provincia: cada provincia tiene su costo, vacía = a coordinar, y vale el gratis desde", async () => {
  const id = await product({ price: 10000 });
  const nuevo = await admin.post("/api/admin/shipping", {
    name: "Envío a todo el país", needsAddress: true, freeFrom: 50000,
    provincePrices: { "Santa Fe": 3000, "Córdoba": 6000, "Narnia": 1, "Salta": "" },
  });
  assert.equal(nuevo.status, 200);
  const m = (await shop.get("/api/site")).data.shipping.find((s) => s.id === nuevo.data.id);
  assert.equal(m.byProvince, true);
  assert.deepEqual(m.provincePrices, { "Santa Fe": 3000, "Córdoba": 6000, "Salta": null }, "descarta provincias inventadas");

  const base = (extra) => ({ items: [{ id, qty: 1 }], shippingId: m.id, paymentId: cash.id, shipTo: "Calle 123, Ciudad", ...extra });
  assert.match((await shop.post("/api/orders", base({}))).data.error, /provincia/, "hay que elegir provincia");
  assert.ok((await shop.post("/api/quote", base({}))).data.missing.includes("province"));

  const cba = (await shop.post("/api/quote", base({ province: "Córdoba" }))).data;
  assert.equal(cba.shipping.cost, 6000);
  assert.equal(cba.total, 16000);
  assert.equal((await shop.post("/api/quote", base({ province: "Salta" }))).data.shipping.pending, true, "sin precio = a coordinar");
  assert.equal((await shop.post("/api/quote", base({ province: "Mendoza" }))).data.shipping.pending, true, "no cargada = a coordinar");

  const grande = (await shop.post("/api/quote", { ...base({ province: "Córdoba" }), items: [{ id, qty: 5 }] })).data;
  assert.equal(grande.shipping.free, true, "gratis desde $50.000");

  const r = await shop.post("/api/orders", base({ province: "Santa Fe" }));
  assert.equal(r.status, 200);
  assert.equal(r.data.shipping.province, "Santa Fe");
  assert.equal(r.data.total, 13000);

  assert.equal((await admin.post("/api/admin/shipping", { name: "Vacío", provincePrices: { "Salta": "" } })).status, 400, "al menos una provincia con costo");
});

// ---------- Textos editables ----------
test("'Quiénes somos' y preguntas frecuentes vienen con texto base, se editan y vuelven al base si se vacían", async () => {
  const s = (await shop.get("/api/settings")).data;
  assert.equal(s.aboutTitle, "Pasión por el mate");
  assert.match(s.faqText, /^## /);
  assert.equal(s.termsText, undefined, "los legales no viajan con la tienda");

  await admin.put("/api/admin/settings", { aboutTitle: "Nuestra historia", aboutValues: "Envíos: A todo el país", faqText: "" });
  const s2 = (await shop.get("/api/settings")).data;
  assert.equal(s2.aboutTitle, "Nuestra historia");
  assert.equal(s2.aboutValues, "Envíos: A todo el país");
  assert.equal(s2.faqText, "", "sin preguntas, la sección no se muestra");

  await admin.put("/api/admin/settings", { aboutTitle: "" });
  assert.equal((await shop.get("/api/settings")).data.aboutTitle, "Pasión por el mate", "título vacío vuelve al base");
});

// ---------- Estadísticas ----------
test("estadísticas: ventas del mes, más vendidos y cupones; los cancelados no cuentan", async () => {
  assert.equal((await shop.get("/api/admin/stats")).status, 401);
  const id = await product({ name: "Termo Estrella", price: 20000 });
  await shop.post("/api/orders", pedido([{ id, qty: 3 }]));
  const cancelado = (await shop.post("/api/orders", pedido([{ id, qty: 1 }]))).data.id;
  await admin.put(`/api/admin/orders/${cancelado}`, { status: "cancelado" });

  const e = (await admin.get("/api/admin/stats")).data;
  assert.equal(e.porMes.length, 6);
  assert.ok(e.resumen.mesActual.total >= 60000);
  assert.ok(e.resumen.cancelados >= 1);
  const termo = e.masVendidos.find((p) => p.name === "Termo Estrella");
  assert.equal(termo.qty, 3, "el cancelado no suma");
  assert.ok(e.pagos.some((p) => p.name === "Efectivo"));
  assert.ok(e.cupones.some((c) => c.code === "DIEZ" || c.code === "UNAVEZ"));
});
