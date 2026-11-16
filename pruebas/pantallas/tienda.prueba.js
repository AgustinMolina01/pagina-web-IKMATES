const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../ayudas/servidor");
const { adminClient } = require("../ayudas/cliente");
const { abrir, esperar } = require("../ayudas/navegador");

let srv, admin, ids = {}, pickup, delivery, transfer, cash;

before(async () => {
  srv = await startServer({ REGISTER_LIMIT: "500", ORDER_LIMIT: "500" });
  admin = await adminClient(srv.base);
  const mk = async (b) => (await admin.post("/api/admin/products", { category: "mates", price: 1000, ...b })).data.id;
  await admin.post("/api/admin/categories", { name: "Tipos de prueba", parent_id: 1 });

  ids.destacado = await mk({ name: "UI Destacado", featured: true, wholesalePrice: 800, wholesaleMin: 3, image: "/img/logo.png", images: ["/img/banner-mates.svg", "/img/banner-yerba.svg"], description: "linea1\nlinea2" });
  ids.agotado = await mk({ name: "UI Agotado", price: 500, soldOut: true });
  ids.pocas = await mk({ name: "UI Pocas unidades", stock: 3 });
  ids.variantes = await mk({ name: "UI Con variantes", price: 2000, stock: 10, options: [{ name: "Color", values: ["Negro", { label: "Rojo", soldOut: true }, "Azul"] }, { name: "Virola", values: ["Acero", "Alpaca"] }] });
  ids.sub = await mk({ name: "UI En subcategoria", category: "tipos-de-prueba", price: 700 });

  const site = (await admin.get("/api/site")).data;
  pickup = site.shipping.find((s) => s.name === "Retiro en el local");
  delivery = site.shipping.find((s) => s.name === "Envío a domicilio");
  transfer = site.payments.find((p) => p.name === "Transferencia bancaria");
  cash = site.payments.find((p) => p.name === "Efectivo");
  await admin.put(`/api/admin/payments/${transfer.id}`, { name: "Transferencia bancaria", description: "", discount: 10 });
  await admin.put(`/api/admin/shipping/${delivery.id}`, { name: "Envío a domicilio", description: "", price: 1500, needsAddress: true });
  await admin.put("/api/admin/settings", { instagram: "@ikmates", payments: "Aceptamos tarjetas", shipping: "Despachamos de lunes a viernes", wholesaleNote: "Por mayor consultá", hours: "10 a 19 hs", whatsapp: "5493415551234" });
});
after(async () => { await srv.stop(); });

const tarjeta = (P, nombre) => P.todos(".card").find((c) => c.querySelector("h3").textContent === nombre);

test("la tienda carga sin errores y muestra destacados, mayorista, agotados y poco stock", async () => {
  const P = await abrir(srv.base, "/");
  assert.deepEqual(P.errores, []);
  assert.equal(P.todos("#destacados .card h3")[0].textContent, "UI Destacado");
  assert.match(tarjeta(P, "UI Destacado").textContent, /Por mayor: \$800 desde 3 u\./);
  assert.ok(tarjeta(P, "UI Agotado").querySelector(".add").disabled, "agotado: botón deshabilitado");
  assert.match(tarjeta(P, "UI Pocas unidades").textContent, /¡Últimas 3 unidades!/);
  assert.equal(tarjeta(P, "UI Con variantes").querySelector(".add").textContent, "Elegir opciones", "con variantes se elige antes de agregar");
  assert.ok(P.todos(".sub-head").some((h) => h.textContent === "Tipos de prueba"), "subcategoría");
  assert.ok(P.todos("#megaCols .mega-sub").some((a) => a.textContent === "Tipos de prueba"), "menú desplegable");
  P.cerrar();
});

test("datos del negocio editables: WhatsApp, horario, redes y 'Cómo comprar'", async () => {
  const P = await abrir(srv.base, "/");
  assert.equal(P.d.querySelector("#waNum").textContent, "+54 9 341 555-1234");
  assert.match(P.d.querySelector("#waFloat").href, /5493415551234/);
  assert.equal(P.d.querySelector(".strip [data-s=hours]").textContent, "Te asesoramos de 10 a 19 hs");
  assert.ok(P.todos("#socials a").some((a) => a.href === "https://instagram.com/ikmates"));
  const cuadros = P.d.querySelector("#infoCards").textContent;
  assert.match(cuadros, /Transferencia bancaria — 10% de descuento/, "las formas de pago configuradas aparecen solas");
  assert.match(cuadros, /Envío a domicilio — \$1\.500/);
  assert.match(cuadros, /Aceptamos tarjetas/);
  assert.match(cuadros, /Por mayor consultá/);
  P.cerrar();
});

test("ficha de producto: galería, descripción y condición mayorista", async () => {
  const P = await abrir(srv.base, "/");
  tarjeta(P, "UI Destacado").querySelector(".card-img").click();
  assert.equal(P.d.querySelector("#vistaProducto").hidden, false, "el producto tiene su propia página");
  assert.equal(P.d.querySelector("#vistaInicio").hidden, true);
  assert.equal(P.todos(".pm-thumbs button").length, 3);
  P.todos(".pm-thumbs button")[1].click();
  assert.equal(P.d.querySelector(".pm-main img").getAttribute("src"), "/img/banner-mates.svg");
  assert.match(P.d.querySelector(".pm-desc").textContent, /linea1/);
  assert.match(P.d.querySelector("#pmBox").textContent, /llevando 3 o más/);
  P.d.querySelector("#prodMigas a").click(); // "Inicio" en las migas de pan
  assert.equal(P.d.querySelector("#vistaProducto").hidden, true);
  assert.equal(P.d.querySelector("#vistaInicio").hidden, false);
  P.cerrar();
});

test("variantes: no deja agregar sin elegir, bloquea lo agotado y el carrito muestra la elección", async () => {
  const P = await abrir(srv.base, "/");
  tarjeta(P, "UI Con variantes").querySelector(".add").click();
  P.d.querySelector("[data-padd]").click();
  assert.match(P.d.querySelector("#pmErr").textContent, /Elegí color/i);
  assert.ok(P.todos(".pm-pill").find((b) => b.textContent === "Rojo").disabled, "'Rojo' agotado: deshabilitado");
  P.todos(".pm-pill").find((b) => b.textContent === "Negro").click();
  P.d.querySelector("[data-padd]").click();
  assert.match(P.d.querySelector("#pmErr").textContent, /Elegí virola/i, "falta el segundo grupo");
  P.todos(".pm-pill").find((b) => b.textContent === "Alpaca").click();
  P.d.querySelector("[data-padd]").click();
  assert.equal(P.d.querySelector("#vistaProducto").hidden, false, "sigue en la página del producto");
  assert.ok(P.d.querySelector("#drawer").classList.contains("open"), "y se abre el carrito para terminar la compra");
  await esperar(500);
  assert.equal(P.d.querySelector("#cartCount").textContent, "1");
  assert.match(P.d.querySelector("#cartItems").textContent, /Negro · Alpaca/);
  P.cerrar();
});

test("carrito: elegir entrega y pago, descuento y envío calculados por el servidor", async () => {
  const P = await abrir(srv.base, "/");
  const agregarDirecto = (id) => P.d.querySelector(`#productos [data-id="${id}"]`).click();
  agregarDirecto(ids.pocas); agregarDirecto(ids.pocas);
  await esperar(600);
  assert.match(P.d.querySelector("#cartSummary").textContent, /Falta elegir/, "avisa qué falta");
  assert.equal(P.todos('#cartChoices input[name="ship"]').length, 2);
  assert.equal(P.todos('#cartChoices input[name="pay"]').length, 2);

  // Transferencia (10% off) + envío a domicilio ($1.500, pide dirección)
  const radio = (nombre, valor) => { const r = P.d.querySelector(`#cartChoices input[name="${nombre}"][value="${valor}"]`); r.checked = true; r.dispatchEvent(P.evento("change")); };
  radio("pay", transfer.id); radio("ship", delivery.id);
  await esperar(600);
  assert.ok(P.d.querySelector("#shipTo"), "aparece el campo de dirección");
  assert.match(P.d.querySelector("#cartSummary").textContent, /Falta elegir: la dirección/);
  P.escribir("#shipTo", "Calle Falsa 123, Rosario");
  await esperar(900);
  const resumen = P.d.querySelector("#cartSummary").textContent;
  assert.match(resumen, /Subtotal\$2\.000/);
  assert.match(resumen, /Transferencia bancaria \(10% off\)−\$200/);
  assert.match(resumen, /Envío\$1\.500/);
  assert.match(resumen, /Total\$3\.300/, "2.000 − 200 + 1.500");
  P.cerrar();
});

test("pedido completo: queda registrado, descuenta stock y arma el mensaje de WhatsApp", async () => {
  const P = await abrir(srv.base, "/");
  const agregar = (id) => P.d.querySelector(`#productos [data-id="${id}"]`).click();
  agregar(ids.pocas);
  const radio = (nombre, valor) => { const r = P.d.querySelector(`#cartChoices input[name="${nombre}"][value="${valor}"]`); r.checked = true; r.dispatchEvent(P.evento("change")); };
  radio("pay", transfer.id); radio("ship", delivery.id);
  P.escribir("#shipTo", "Calle Falsa 123, Rosario");
  await esperar(900);
  P.d.querySelector("#checkout").click();
  await esperar(1500);

  const salida = P.ventanas.find((v) => v.url === "about:blank");
  const mensaje = decodeURIComponent((salida?.v.location.href || "").split("text=")[1] || "");
  assert.match(salida.v.location.href, /^https:\/\/wa\.me\/5493415551234\?text=/);
  assert.match(mensaje, /pedido #\d+/);
  assert.match(mensaje, /1 x UI Pocas unidades — \$1\.000/);
  assert.match(mensaje, /Pago: Transferencia bancaria \(10% off: −\$100\)/);
  assert.match(mensaje, /Entrega: Envío a domicilio \(\$1\.500\)/);
  assert.match(mensaje, /Dirección: Calle Falsa 123, Rosario/);
  assert.match(mensaje, /Total: \$2\.400/);
  assert.equal(P.d.querySelector("#cartCount").textContent, "0", "el carrito se vacía");

  const pedidos = (await admin.get("/api/admin/orders")).data;
  assert.equal(pedidos.orders[0].total, 2400);
  assert.equal(pedidos.orders[0].details.shipping.address, "Calle Falsa 123, Rosario");
  const producto = (await admin.get("/api/admin/products")).data.find((p) => p.id === ids.pocas);
  assert.equal(producto.stock, 2, "3 − 1");
  P.cerrar();
});

test("no deja enviar el pedido si falta elegir entrega o pago", async () => {
  const P = await abrir(srv.base, "/");
  P.d.querySelector(`#productos [data-id="${ids.sub}"]`).click();
  await esperar(400);
  const antes = (await admin.get("/api/admin/orders")).data.count;
  P.d.querySelector("#checkout").click();
  await esperar(500);
  assert.match(P.d.querySelector(".toast").textContent, /Falta elegir/);
  assert.equal((await admin.get("/api/admin/orders")).data.count, antes, "no se registró ningún pedido");
  P.cerrar();
});

test("buscador: filtra sin importar acentos y oculta los destacados", async () => {
  const P = await abrir(srv.base, "/");
  P.escribir("#search", "subcategoria");
  assert.equal(P.todos(".card").length, 1);
  assert.equal(P.todos(".card h3")[0].textContent, "UI En subcategoria");
  assert.ok(!P.d.querySelector("#destacados"));
  P.escribir("#search", "zzzz");
  assert.match(P.d.querySelector("#productos").textContent, /No encontramos productos para “zzzz”/);
  P.cerrar();
});

test("cuenta del cliente: ventana con logo, registro, Mis pedidos y salir", async () => {
  const P = await abrir(srv.base, "/");
  assert.equal(P.d.querySelector("#acctLabel").textContent, "Ingresar");
  P.d.querySelector("#acctBtn").click();
  assert.equal(P.d.querySelector(".am-head img").getAttribute("src"), "/img/logo.png", "la ventana lleva el logo (ruta absoluta: funciona también dentro de /categoria/... y /producto/...)");
  const ojo = P.d.querySelector(".am-box .clave-ojo");
  assert.ok(ojo, "la contraseña del cliente también tiene el botón Ver");
  ojo.click();
  assert.equal(P.d.querySelector('.am-box input[name="password"]').type, "text");
  ojo.click();
  assert.equal(P.d.querySelector('.am-box input[name="password"]').type, "password");
  P.d.querySelector('[data-atab="register"]').click();
  P.enviar(P.d.querySelector("#authForm"));
  await esperar(500);
  assert.match(P.d.querySelector("#amErr").textContent, /Escribí tu nombre/);

  const f = P.d.querySelector("#authForm");
  f.querySelector("[name=name]").value = "Carolina Díaz"; f.querySelector("[name=email]").value = "caro@ejemplo.com"; f.querySelector("[name=password]").value = "clavecaro1";
  P.enviar(f);
  await esperar(800);
  assert.equal(P.d.querySelector("#amodal").hidden, true);
  assert.equal(P.d.querySelector("#acctLabel").textContent, "Carolina");

  // un pedido con cuenta: el mensaje lleva el nombre y aparece en Mis pedidos
  P.d.querySelector(`#productos [data-id="${ids.sub}"]`).click();
  const radio = (n, v) => { const r = P.d.querySelector(`#cartChoices input[name="${n}"][value="${v}"]`); r.checked = true; r.dispatchEvent(P.evento("change")); };
  radio("pay", cash.id); radio("ship", pickup.id);
  await esperar(800);
  P.d.querySelector("#checkout").click();
  await esperar(1500);
  const mensaje = decodeURIComponent((P.ventanas.find((v) => v.url === "about:blank").v.location.href.split("text=")[1]) || "");
  assert.match(mensaje, /Cliente: Carolina Díaz/);

  P.d.querySelector("#acctBtn").click();
  P.d.querySelector('[data-acct="orders"]').click();
  await esperar(800);
  assert.match(P.d.querySelector("#amOrders").textContent, /Pedido #\d+/);
  assert.match(P.d.querySelector("#amOrders").textContent, /Efectivo · Retiro en el local/);
  P.d.querySelector(".pm-x").click();

  P.d.querySelector("#acctBtn").click();
  P.d.querySelector('[data-acct="logout"]').click();
  await esperar(500);
  assert.equal(P.d.querySelector("#acctLabel").textContent, "Ingresar");
  assert.deepEqual(P.errores, []);
  P.cerrar();
});

test("sin conexión con el servidor: muestra barra, carrusel y datos por defecto sin romperse", async () => {
  const P = await abrir(srv.base, "/", { sinServidor: true });
  assert.equal(P.d.querySelector("#announce").hidden, false);
  assert.equal(P.d.querySelector("#slider").hidden, false);
  assert.deepEqual([...P.d.querySelectorAll("#slides img")].map((img) => img.getAttribute("src")), [
    "/img/banner-cybermonday.png",
    "/img/banner-2x1.png",
  ]);
  assert.equal(P.d.querySelector("#waNum").textContent, "+54 9 341 214-7956");
  assert.equal(P.d.querySelector("#aboutTitle").textContent, "Pasión por el mate", "'Quiénes somos' conserva el texto base");
  assert.match(P.d.querySelector("#productos").textContent, /Próximamente/);
  assert.deepEqual(P.errores, []);
  P.cerrar();
});

test("novedades: 'Quiénes somos' y preguntas editables, pie legal y cupón en el carrito", async () => {
  await admin.put("/api/admin/settings", { aboutTitle: "Nuestra historia", aboutValues: "Envíos: A todo el país\nCalidad: Elegidos uno por uno" });
  await admin.post("/api/admin/coupons", { code: "PRUEBA20", value: 20 });
  const P = await abrir(srv.base, "/");
  assert.deepEqual(P.errores, []);
  assert.equal(P.d.querySelector("#aboutTitle").textContent, "Nuestra historia");
  assert.equal(P.todos("#aboutValues li").length, 2);
  assert.equal(P.d.querySelector("#preguntas").hidden, false, "las preguntas base se muestran");
  assert.ok(P.todos("#faqList details").length >= 3);
  assert.ok(P.d.querySelector('footer a[href="/arrepentimiento"]'), "botón de arrepentimiento en el pie");
  assert.ok(P.d.querySelector('footer a[href*="defensadelconsumidor"]'), "link a Defensa del Consumidor");

  // Cupón: uno que no existe avisa; uno válido descuenta
  P.d.querySelector(`#productos [data-id="${ids.pocas}"]`).click();
  await esperar(900);
  assert.equal(P.d.querySelector("#cartCoupon").hidden, false);
  P.d.querySelector("#couponInput").value = "NOEXISTE";
  P.enviar(P.d.querySelector("#couponForm")); await esperar(900);
  assert.match(P.d.querySelector("#couponMsg").textContent, /no existe/);
  P.d.querySelector("#couponInput").value = "prueba20";
  P.enviar(P.d.querySelector("#couponForm")); await esperar(900);
  assert.match(P.d.querySelector("#couponMsg").textContent, /PRUEBA20.*aplicado/);
  assert.match(P.d.querySelector("#cartSummary").textContent, /Cupón PRUEBA20−\$200/);
  P.cerrar();
});
