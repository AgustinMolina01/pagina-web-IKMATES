const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../ayudas/servidor");
const { client, adminClient } = require("../ayudas/cliente");
const { abrir, esperar } = require("../ayudas/navegador");

let srv, api, tienda, P;

before(async () => {
  srv = await startServer({ REGISTER_LIMIT: "500", ORDER_LIMIT: "500" });
  api = await adminClient(srv.base);
  tienda = client(srv.base);
  const site = (await tienda.get("/api/site")).data;
  const retiro = site.shipping[0].id, efectivo = site.payments[1].id;
  // un cliente con un pedido, para las pestañas Clientes y Pedidos
  await tienda.post("/api/account/register", { name: "Carolina Díaz", email: "caro@ejemplo.com", password: "clavecaro1" });
  const pid = (await api.post("/api/admin/products", { name: "PP Con stock", category: "mates", price: 1000, stock: 5 })).data.id;
  await tienda.post("/api/orders", { items: [{ id: pid, qty: 2 }], shippingId: retiro, paymentId: efectivo });
  await api.post("/api/admin/products", { name: "PP Poco stock", category: "mates", price: 500, stock: 2 });

  P = await abrir(srv.base, "/admin", { espera: 2500 }); // sin sesión: muestra el ingreso
});
after(async () => { P.cerrar(); await srv.stop(); });

const productos = async () => (await api.get("/api/admin/products")).data;
const pestana = async (nombre, ms = 700) => { P.d.querySelector(`[data-tab="${nombre}"]`).click(); await esperar(ms); };
const marcar = (sel, valor) => { const el = P.d.querySelector(sel); el.value = valor; };

test("ingreso: sin sesión pide la contraseña, rechaza la mala y entra con la correcta", async () => {
  assert.equal(P.d.querySelector("#loginView").classList.contains("hidden"), false);
  assert.equal(P.d.querySelector("#appView").classList.contains("hidden"), true);
  // botón "Ver" en la contraseña del ingreso
  const ojo = P.d.querySelector("#loginForm .clave-ojo");
  assert.ok(ojo, "el campo de contraseña tiene su botón Ver");
  assert.equal(P.d.querySelector("#pass").type, "password");
  ojo.click();
  assert.equal(P.d.querySelector("#pass").type, "text", "al tocar Ver se muestra");
  assert.equal(ojo.textContent, "Ocultar");
  ojo.click();
  assert.equal(P.d.querySelector("#pass").type, "password", "y se vuelve a ocultar");
  assert.equal(P.todos("#appView .clave-ojo").length, 4, "también en Ajustes: correo (confirmar), actual, nueva y repetir");
  marcar("#email", "admin@ikmates.com"); marcar("#pass", "incorrecta"); P.enviar(P.d.querySelector("#loginForm")); await esperar(600);
  assert.match(P.d.querySelector("#loginErr").textContent, /correo o contraseña/i);
  marcar("#pass", "ikmates2024"); P.enviar(P.d.querySelector("#loginForm")); await esperar(1800);
  assert.equal(P.d.querySelector("#appView").classList.contains("hidden"), false);
  assert.deepEqual(P.errores, []);
  assert.deepEqual(P.todos("#tabs button").map((b) => b.dataset.tab), ["inicio", "pedidos", "productos", "categorias", "publicaciones", "envios", "cupones", "clientes", "estadisticas", "ajustes"]);
  assert.ok(P.d.querySelector("#tab-inicio").classList.contains("on"), "la primera vez abre en Inicio");
  assert.equal(P.d.querySelector("#pwWarn").classList.contains("hidden"), false, "avisa que sigue la contraseña inicial");
});

test("inicio: resumen y mapa; cada pestaña tiene su guía corta y se pueden ocultar", async () => {
  assert.equal(P.d.querySelector("#inPasos"), null, "ya no hay bloque de pasos para empezar");
  assert.match(P.d.querySelector("#inResumen").textContent, /pedidos? nuevos? sin atender/);
  assert.equal(P.todos("#inMapa [data-ir]").length, 9, "un acceso por cada pestaña");

  // los accesos llevan a la pestaña correcta
  P.d.querySelector('#inMapa [data-ir="productos"]').click();
  assert.ok(P.d.querySelector("#tab-productos").classList.contains("on"));
  assert.ok(!P.d.querySelector("#tab-inicio").classList.contains("on"));

  // cada pestaña (menos Inicio) empieza con una guía corta
  for (const nombre of ["pedidos", "productos", "categorias", "publicaciones", "envios", "cupones", "clientes", "estadisticas", "ajustes"]) {
    const guia = P.d.querySelector("#tab-" + nombre + " .guia");
    assert.ok(guia, "guía en " + nombre);
    assert.ok(guia.textContent.length < 420, "la guía es corta: " + nombre);
  }
  // el botón "Ayudas" las oculta y las vuelve a mostrar
  P.d.querySelector("#toggleAyuda").click();
  assert.ok(P.d.body.classList.contains("sin-ayuda"));
  assert.match(P.d.querySelector("#toggleAyuda").textContent, /no/);
  P.d.querySelector("#toggleAyuda").click();
  assert.ok(!P.d.body.classList.contains("sin-ayuda"));
});

test("productos: lista con stock y filtros (buscador y 'poco stock')", async () => {
  assert.ok(P.todos("#tbody tr").length >= 8);
  assert.match(P.d.querySelector("#tbody").textContent, /Stock: 3/, "el pedido de la preparación ya descontó 2 de 5");
  P.escribir("#pSearch", "poco");
  assert.equal(P.todos("#tbody tr").length, 1);
  P.escribir("#pSearch", "");
  marcar("#pStatus", "low"); P.d.querySelector("#pStatus").dispatchEvent(P.evento("input"));
  assert.deepEqual(P.todos("#tbody tr strong").map((s) => s.textContent), ["PP Con stock", "PP Poco stock"], "solo los de 5 unidades o menos");
  marcar("#pStatus", ""); P.d.querySelector("#pStatus").dispatchEvent(P.evento("input"));
});

test("formulario: crea un producto con stock, variantes y mayorista", async () => {
  P.d.querySelector("#newProduct").click();
  assert.equal(P.d.querySelector("#productPanel").classList.contains("hidden"), false);
  marcar("#pName", "PP Mate nuevo"); marcar("#pCat", "mates"); marcar("#pPrice", "9000"); marcar("#pStock", "12");
  marcar("#pWPrice", "7500"); marcar("#pWMin", "6"); P.d.querySelector("#pFeat").checked = true;

  P.d.querySelector("#agregarGrupo").click();
  P.d.querySelector('[data-gname="0"]').value = "Color"; P.d.querySelector('[data-gname="0"]').dispatchEvent(P.evento("input"));
  const valores = P.d.querySelector('[data-gvals="0"]'); valores.value = "Negro, Rojo, Azul, negro"; valores.dispatchEvent(P.evento("input"));
  assert.equal(P.todos('[data-chips="0"] .chip').length, 3, "las repetidas ('negro') no se duplican");
  P.todos('[data-chips="0"] .chip')[1].click(); // marca "Rojo" como agotado
  assert.match(P.todos('[data-chips="0"] .chip')[1].textContent, /Rojo \(agotado\)/);

  P.enviar(P.d.querySelector("#pForm")); await esperar(900);
  const p = (await productos()).find((x) => x.name === "PP Mate nuevo");
  assert.ok(p, JSON.stringify(P.d.querySelector("#formErr").textContent));
  assert.equal(p.stock, 12);
  assert.equal(p.featured, true);
  assert.deepEqual(p.wholesale, { price: 7500, min: 6 });
  assert.deepEqual(p.options[0].values, [{ label: "Negro", soldOut: false }, { label: "Rojo", soldOut: true }, { label: "Azul", soldOut: false }]);
  assert.equal(P.d.querySelector("#productPanel").classList.contains("hidden"), true, "se cierra al guardar");
});

test("formulario: errores claros, duplicar y editar", async () => {
  P.d.querySelector("#newProduct").click();
  marcar("#pName", "PP Malo"); marcar("#pCat", "mates"); marcar("#pPrice", "100"); marcar("#pWPrice", "50");
  P.enviar(P.d.querySelector("#pForm")); await esperar(600);
  assert.match(P.d.querySelector("#formErr").textContent, /precio mayorista/i);
  marcar("#pWPrice", ""); marcar("#pStock", "abc");
  P.d.querySelector("#cancelEdit").click();

  const original = (await productos()).find((x) => x.name === "PP Mate nuevo");
  P.d.querySelector(`[data-dup="${original.id}"]`).click();
  assert.equal(P.d.querySelector("#pName").value, "PP Mate nuevo (copia)");
  assert.equal(P.d.querySelector("#pId").value, "", "una copia es un producto nuevo");
  assert.equal(P.d.querySelector("#pStock").value, "12");
  assert.equal(P.todos("#opcionesEditor .grupo-op").length, 1, "copia también las variantes");
  P.d.querySelector("#cancelEdit").click();

  P.d.querySelector(`[data-edit="${original.id}"]`).click();
  assert.equal(P.d.querySelector("#pId").value, String(original.id));
  P.d.querySelector("#cancelEdit").click();
});

test("acciones masivas y cambio de precios con vista previa", async () => {
  const lista = await productos();
  const a = lista.find((x) => x.name === "PP Con stock"), b = lista.find((x) => x.name === "PP Poco stock");
  for (const id of [a.id, b.id]) { const c = P.d.querySelector(`[data-sel="${id}"]`); c.checked = true; c.dispatchEvent(new P.w.Event("click", { bubbles: true })); }
  assert.match(P.d.querySelector("#bulkCount").textContent, /2 seleccionados/);
  P.d.querySelector('[data-bulk="soldout"]').click(); await esperar(800);
  assert.ok((await productos()).filter((x) => [a.id, b.id].includes(x.id)).every((x) => x.soldOut), "marcar sin stock");
  P.d.querySelector('[data-bulk="instock"]').click(); await esperar(800);
  assert.ok((await productos()).filter((x) => [a.id, b.id].includes(x.id)).every((x) => !x.soldOutFlag));

  P.d.querySelector("#bulkPrice").click();
  assert.equal(P.d.querySelector("#prScope").value, "selected", "usa los tildados");
  marcar("#prMode", "percent"); marcar("#prValue", "10"); marcar("#prRound", "100");
  P.d.querySelector("#prPreviewBtn").click(); await esperar(700);
  assert.match(P.d.querySelector("#prPreview").textContent, /2 productos van a cambiar/);
  assert.equal((await productos()).find((x) => x.id === a.id).price, 1000, "la vista previa no cambia nada");
  P.d.querySelector("#prApplyBtn").click(); await esperar(900);
  assert.equal((await productos()).find((x) => x.id === a.id).price, 1100);
  marcar("#prValue", ""); P.d.querySelector("#prPreviewBtn").click(); await esperar(500);
  assert.match(P.d.querySelector("#prErr").textContent, /distinto de cero/);
  P.d.querySelector("#prClose").click();
});

test("carga desde planilla: lee CSV de Excel, importa y avisa de las filas con problemas", async () => {
  P.d.querySelector("#openImport").click();
  const entrada = P.d.querySelector("#csvFile");
  const usar = async (texto) => { Object.defineProperty(entrada, "files", { value: [{ text: async () => texto }], configurable: true }); entrada.dispatchEvent(P.evento("change")); await esperar(500); };

  await usar("a;b\r\n1;2\r\n");
  assert.match(P.d.querySelector("#impErr").textContent, /Faltan columnas/);
  await usar("﻿Categoría;Producto;Precio;Cantidad;Variantes\r\nPlanilla;PL Uno;1.500,00;7;Color: Negro|Rojo\r\n\"Planilla > Sub\";\"PL Dos; con ; punto y coma\";2500;;\r\n;Sin categoría;100;;\r\n");
  assert.match(P.d.querySelector("#impPreview").textContent, /3 fila/);
  P.d.querySelector("#impGo").click(); await esperar(1200);
  assert.match(P.d.querySelector("#impPreview").textContent, /Se importaron 2 productos/);
  assert.match(P.d.querySelector("#impPreview").textContent, /1 fila/);
  const uno = (await productos()).find((x) => x.name === "PL Uno");
  assert.equal(uno.price, 1500);
  assert.equal(uno.stock, 7);
  assert.deepEqual(uno.options[0].values.map((v) => v.label), ["Negro", "Rojo"]);
  assert.ok((await productos()).some((x) => x.name === "PL Dos; con ; punto y coma"), "separadores dentro de comillas");
  P.d.querySelector("#impClose").click();
});

test("categorías: crear una subcategoría y verla en los selectores", async () => {
  await pestana("categorias");
  marcar("#cName", "PC Nueva"); P.d.querySelector("#cForm").dispatchEvent(P.evento("submit")); await esperar(800);
  assert.match(P.d.querySelector("#cList").textContent, /PC Nueva/);
  assert.ok(P.todos("#pCat option").some((o) => o.textContent === "PC Nueva"));
  assert.ok(P.todos("#cParent option").some((o) => /Dentro de: PC Nueva/.test(o.textContent)));
});

test("publicaciones: carrusel con vigencia y mensajes de la barra", async () => {
  await pestana("publicaciones");
  assert.ok(P.todos("#bList > div").length >= 3);
  assert.match(P.d.querySelector("#bList").textContent, /En vigencia/);
  marcar("#aText", "PROMO PANEL"); P.d.querySelector("#aForm").dispatchEvent(P.evento("submit")); await esperar(700);
  assert.match(P.d.querySelector("#aList").textContent, /PROMO PANEL/);
});

test("pedidos: muestra pago y entrega, y al cancelar devuelve el stock", async () => {
  await pestana("pedidos", 900);
  const tarjeta = P.d.querySelector("#ordList .ord");
  assert.match(tarjeta.textContent, /PP Con stock/);
  assert.match(tarjeta.textContent, /Efectivo/);
  assert.match(tarjeta.textContent, /Retiro en el local/);
  assert.match(tarjeta.textContent, /Carolina Díaz/);
  assert.equal(P.d.querySelector("#ordBadge").classList.contains("hidden"), false, "etiqueta de pedidos nuevos");
  const stockAntes = (await productos()).find((x) => x.name === "PP Con stock").stock;
  const select = P.d.querySelector("[data-ost]"); select.value = "cancelado"; select.dispatchEvent(P.evento("change")); await esperar(900);
  assert.equal((await productos()).find((x) => x.name === "PP Con stock").stock, stockAntes + 2, "devuelve las 2 unidades");
});

test("clientes: lista, buscador y contraseña temporal", async () => {
  await pestana("clientes", 900);
  assert.match(P.d.querySelector("#custBody").textContent, /caro@ejemplo\.com/);
  P.escribir("#custSearch", "nadie"); assert.match(P.d.querySelector("#custBody").textContent, /Ningún cliente coincide/);
  P.escribir("#custSearch", "caro");
  P.d.querySelector("[data-creset]").click(); await esperar(800);
  assert.match(P.d.querySelector("#custMsg").textContent, /Contraseña temporal de Carolina/);
  assert.match(P.d.querySelector("#custMsg").textContent, /una sola vez/);
});

test("envíos y pagos: crear, ver en la tienda y reglas de validación", async () => {
  await pestana("envios", 900);
  assert.match(P.d.querySelector("#shList").textContent, /Retiro en el local/);
  assert.match(P.d.querySelector("#pyList").textContent, /Transferencia bancaria/);

  marcar("#shName", "Moto en Rosario"); marcar("#shPrice", "1200"); marcar("#shFree", "30000"); P.d.querySelector("#shAddress").checked = true;
  P.enviar(P.d.querySelector("#shForm")); await esperar(800);
  assert.match(P.d.querySelector("#shList").textContent, /Moto en Rosario/);
  assert.match(P.d.querySelector("#shList").textContent, /\$1\.200, gratis desde \$30\.000/);

  marcar("#pyName", "Tarjeta"); marcar("#pyDiscount", "95");
  P.enviar(P.d.querySelector("#pyForm")); await esperar(600);
  assert.match(P.d.querySelector("#pyErr").textContent, /entre 0 y 90/);
  marcar("#pyDiscount", "5"); P.enviar(P.d.querySelector("#pyForm")); await esperar(800);
  assert.match(P.d.querySelector("#pyList").textContent, /5% OFF/);

  const site = (await tienda.get("/api/site")).data;
  assert.ok(site.shipping.some((s) => s.name === "Moto en Rosario" && s.freeFrom === 30000));
  assert.ok(site.payments.some((p) => p.name === "Tarjeta" && p.discount === 5));
});

test("envío por provincia: la grilla aparece al marcarlo y se guarda", async () => {
  await pestana("envios", 900);
  assert.equal(P.d.querySelector("#shProvBox").classList.contains("hidden"), true);
  marcar("#shName", "Todo el país");
  const chk = P.d.querySelector("#shByProv"); chk.checked = true; chk.dispatchEvent(P.evento("change"));
  assert.equal(P.d.querySelector("#shProvBox").classList.contains("hidden"), false);
  assert.equal(P.todos("#shProvGrid [data-prov]").length, 24, "las 24 provincias");
  P.d.querySelector('#shProvGrid [data-prov="Córdoba"]').value = "6000";
  marcar("#shProvFill", "9000"); P.d.querySelector("#shProvFillBtn").click();
  assert.equal(P.d.querySelector('#shProvGrid [data-prov="Salta"]').value, "9000", "completa las vacías");
  assert.equal(P.d.querySelector('#shProvGrid [data-prov="Córdoba"]').value, "6000", "no pisa las cargadas");
  P.enviar(P.d.querySelector("#shForm")); await esperar(900);
  assert.match(P.d.querySelector("#shList").textContent, /Todo el país[\s\S]*según provincia/);
  const m = (await tienda.get("/api/site")).data.shipping.find((s) => s.name === "Todo el país");
  assert.equal(m.provincePrices["Córdoba"], 6000);
  assert.equal(m.provincePrices["Salta"], 9000);
});

test("cupones y estadísticas: crear un cupón desde el panel y ver las ventas", async () => {
  await pestana("cupones", 900);
  marcar("#cpCode", "x"); marcar("#cpValue", "10");
  P.enviar(P.d.querySelector("#cpForm")); await esperar(600);
  assert.match(P.d.querySelector("#cpErr").textContent, /entre 3 y 30/);
  marcar("#cpCode", "invierno15"); marcar("#cpValue", "15");
  P.enviar(P.d.querySelector("#cpForm")); await esperar(800);
  assert.match(P.d.querySelector("#cpList").textContent, /INVIERNO15[\s\S]*15% OFF[\s\S]*Activo/);

  // un pedido nuevo (el del inicio de las pruebas se canceló en la prueba de Pedidos: no cuenta)
  const site = (await tienda.get("/api/site")).data;
  const pid = (await api.post("/api/admin/products", { name: "PP Estadística", category: "mates", price: 3000 })).data.id;
  await tienda.post("/api/orders", { items: [{ id: pid, qty: 4 }], shippingId: site.shipping[0].id, paymentId: site.payments[1].id });

  await pestana("estadisticas", 1200);
  assert.equal(P.todos("#stMeses .est-mes").length, 6, "6 meses");
  assert.match(P.d.querySelector("#stProductos").textContent, /PP Estadística[\s\S]*4 u\./);
  assert.match(P.d.querySelector("#stResumen").textContent, /vendido este mes/);
});

test("ajustes: guardar datos del negocio y cambiar la contraseña", async () => {
  await pestana("ajustes");
  marcar("#sWhatsapp", "12"); P.d.querySelector("#sForm").dispatchEvent(P.evento("submit")); await esperar(600);
  assert.match(P.d.querySelector("#sErr").textContent, /código de país/);
  marcar("#sWhatsapp", "5493412147956"); marcar("#sHours", "8 a 17 hs"); P.d.querySelector("#sForm").dispatchEvent(P.evento("submit")); await esperar(800);
  assert.match(P.d.querySelector("#sOk").textContent, /Guardado/);
  assert.equal((await tienda.get("/api/settings")).data.hours, "8 a 17 hs");

  marcar("#pwCur", "ikmates2024"); marcar("#pwNew", "abcdefgh1"); marcar("#pwNew2", "otra-cosa-1");
  P.d.querySelector("#pwForm").dispatchEvent(P.evento("submit")); await esperar(500);
  assert.match(P.d.querySelector("#pwErr").textContent, /no coinciden/);
  marcar("#pwNew2", "abcdefgh1"); P.d.querySelector("#pwForm").dispatchEvent(P.evento("submit")); await esperar(900);
  assert.match(P.d.querySelector("#pwOk").textContent, /Contraseña cambiada/);
  assert.equal(P.d.querySelector("#pwWarn").classList.contains("hidden"), true, "el aviso rojo desaparece");
  assert.ok(P.d.querySelector('a[href="/api/admin/backup"][download]'), "botón de respaldo");
  assert.deepEqual(P.errores, [], "el panel completo, sin errores de JavaScript");
});
