// Lo que ayuda a vender: ofertas, descuento por forma de pago, envío gratis, cantidad y barra del carrito.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../ayudas/servidor");
const { adminClient } = require("../ayudas/cliente");
const { abrir, esperar } = require("../ayudas/navegador");

let srv, admin, ids = {};

before(async () => {
  srv = await startServer({ REGISTER_LIMIT: "500", ORDER_LIMIT: "500" });
  admin = await adminClient(srv.base);
  const mk = async (b) => (await admin.post("/api/admin/products", { category: "mates", price: 1000, ...b })).data.id;
  ids.oferta = await mk({ name: "VT Oferta", price: 1000, oldPrice: 1250, stock: 10, image: "/img/logo.png" });
  ids.comun = await mk({ name: "VT Común", price: 800 });
  ids.otro = await mk({ name: "VT Yerba", category: "yerba", price: 500 });

  const site = (await admin.get("/api/site")).data;
  const transfer = site.payments.find((p) => p.name === "Transferencia bancaria");
  const delivery = site.shipping.find((s) => s.name === "Envío a domicilio");
  await admin.put(`/api/admin/payments/${transfer.id}`, { name: "Transferencia bancaria", description: "", discount: 10 });
  await admin.put(`/api/admin/shipping/${delivery.id}`, { name: "Envío a domicilio", description: "", price: 1500, freeFrom: 3000, needsAddress: true });
});
after(async () => { await srv.stop(); });

const tarjeta = (P, nombre) => P.todos(".card").find((c) => c.querySelector("h3").textContent === nombre);

test("precio anterior: se valida, se guarda y solo cuenta si es mayor al precio", async () => {
  const mal = await admin.post("/api/admin/products", { name: "X", category: "mates", price: 1000, oldPrice: 900 });
  assert.equal(mal.status, 400);
  assert.match(mal.data.error, /precio anterior/i);
  assert.equal((await admin.post("/api/admin/products", { name: "X", category: "mates", price: 1000, oldPrice: 1000 })).status, 400);
  const lista = (await admin.get("/api/admin/products")).data;
  assert.equal(lista.find((p) => p.id === ids.oferta).oldPrice, 1250);
  assert.equal(lista.find((p) => p.id === ids.comun).oldPrice, null);
  // si después sube el precio por encima del anterior, deja de mostrarse como oferta
  await admin.put(`/api/admin/products/${ids.comun}`, { name: "VT Común", category: "mates", price: 800, oldPrice: 1000 });
  await admin.put(`/api/admin/products/${ids.comun}`, { name: "VT Común", category: "mates", price: 800 });
  assert.equal((await admin.get("/api/admin/products")).data.find((p) => p.id === ids.comun).oldPrice, null, "vaciarlo termina la oferta");
});

test("tarjetas y portada destacan la oferta, el descuento por pago y el envío gratis", async () => {
  const P = await abrir(srv.base, "/");
  assert.deepEqual(P.errores, []);
  const t = tarjeta(P, "VT Oferta");
  assert.equal(t.querySelector(".tag-off").textContent, "−20%");
  assert.equal(t.querySelector(".price-old").textContent, "$1.250");
  assert.match(t.querySelector(".pay-off").textContent, /\$900 con transferencia bancaria/);
  assert.ok(!tarjeta(P, "VT Común").querySelector(".tag-off"), "sin precio anterior no hay etiqueta de oferta");
  assert.equal(t.querySelector(".add").textContent, "Agregar al carrito");

  // La barra en movimiento suma sola las promociones reales y queda debajo del encabezado con el nombre de la marca (no arriba de todo)
  const barra = P.d.querySelector("#announce");
  assert.equal(barra.hidden, false);
  assert.match(barra.textContent, /10% OFF pagando con Transferencia bancaria/);
  assert.match(barra.textContent, /Envío gratis desde \$3\.000/);
  const despues = (a, b) => a.compareDocumentPosition(b) & P.w.Node.DOCUMENT_POSITION_FOLLOWING;
  assert.ok(despues(P.d.querySelector(".header"), barra), "la barra queda después del encabezado");
  assert.ok(despues(barra, P.d.querySelector("#slider")), "y encima de las publicaciones");
  assert.equal(P.d.querySelector(".hero"), null, "ya no hay portada con texto grande");
  assert.equal(P.d.querySelector("#benPagoTitulo").textContent, "10% OFF");
  assert.equal(P.d.querySelector("#benEnvioTitulo").textContent, "Envío gratis");
  assert.match(P.d.querySelector("#benEnvioTexto").textContent, /\$3\.000/);

  assert.equal(P.d.querySelector("#categoriasDestacadas").hidden, false);
  const bloques = P.todos("#catTiles .cat-tile").map((a) => a.querySelector("strong").textContent);
  assert.ok(bloques.includes("Mates") && bloques.includes("Yerba"), "un bloque por categoría con productos");
  P.cerrar();
});

test("ficha: cantidad, total en el botón, consulta por WhatsApp y relacionados; luego el carrito empuja al envío gratis", async () => {
  const P = await abrir(srv.base, "/");
  tarjeta(P, "VT Oferta").querySelector("h3 a").click();
  const caja = () => P.d.querySelector("#pmBox");
  assert.match(caja().querySelector(".pm-save").textContent, /Ahorrás \$250/);
  assert.match(caja().querySelector(".pm-pay").textContent, /\$900 pagando con transferencia bancaria/);
  assert.match(caja().querySelector(".pm-wa").href, /^https:\/\/wa\.me\/\d+\?text=/);
  assert.match(decodeURIComponent(caja().querySelector(".pm-wa").href), /VT Oferta/);
  assert.ok(caja().querySelector(".pm-more [data-open]"), "productos relacionados");
  assert.match(caja().querySelector("[data-padd]").textContent, /\$1\.000/);

  caja().querySelector('[data-pqty="1"]').click();
  assert.match(caja().querySelector("[data-padd]").textContent, /\$2\.000/, "el botón muestra el total de la cantidad elegida");
  caja().querySelector("[data-padd]").click();
  await esperar(900);

  assert.ok(P.d.querySelector("#drawer").classList.contains("open"), "después de agregar se abre el carrito");
  assert.equal(P.d.querySelector("#cartCount").textContent, "2");
  assert.match(P.d.querySelector("#cartProgress").textContent, /Te faltan \$1\.000 para tener envío gratis/);
  assert.equal(P.d.querySelector("#cartBar").hidden, false, "barra fija del celular");
  assert.match(P.d.querySelector("#cartBarTotal").textContent, /\$/);
  assert.match(P.d.querySelector("#checkout").textContent, /Finalizar pedido por WhatsApp · \$/);

  // sumando más se llega al monto y el aviso cambia
  P.d.querySelector("[data-inc]").click();
  await esperar(500);
  assert.ok(P.d.querySelector(".ship-goal.done"), "con $3.000 el envío es gratis");
  assert.match(P.d.querySelector("#cartProgress").textContent, /envío es gratis/);
  P.cerrar();
});
