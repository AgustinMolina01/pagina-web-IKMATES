// Cada categoría y cada producto tienen su propia página y dirección.
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
  const sub = (await admin.post("/api/admin/categories", { name: "Uruguayos", parent_id: 1 })).data;
  ids.barato = await mk({ name: "NV Barato", price: 500 });
  ids.caro = await mk({ name: "NV Caro", price: 9000 });
  ids.uruguayo = await mk({ name: "NV Uruguayo", category: sub.slug || "uruguayos", price: 3000 });
  ids.yerba = await mk({ name: "NV Yerba", category: "yerba", price: 700 });
});
after(async () => { await srv.stop(); });

const nombres = (P, sel) => P.todos(sel).map((h) => h.textContent);
const enRuta = (P) => P.w.location.pathname;

test("tocar una categoría en el menú abre su página, solo con sus productos", async () => {
  const P = await abrir(srv.base, "/");
  const enlace = P.todos("#megaCols .mega-top").find((a) => a.textContent === "Mates");
  assert.equal(enlace.getAttribute("href"), "/categoria/mates");
  enlace.click();
  assert.equal(enRuta(P), "/categoria/mates", "cambia la dirección sin recargar");
  assert.equal(P.d.querySelector("#vistaCategoria").hidden, false);
  assert.equal(P.d.querySelector("#vistaInicio").hidden, true, "el inicio se oculta");
  assert.equal(P.d.querySelector("#catTitulo").textContent, "Mates");
  assert.equal(P.d.title, "Mates | IK Mates");
  const productos = nombres(P, "#catProductos .card h3");
  assert.ok(productos.includes("NV Barato") && productos.includes("NV Uruguayo"), "incluye los de sus subcategorías");
  assert.ok(!productos.includes("NV Yerba"), "no mezcla otras categorías");
  assert.ok(P.todos("#catChips .chip").some((c) => c.textContent === "Uruguayos"), "atajo a la subcategoría");
  assert.deepEqual(P.errores, []);
  P.cerrar();
});

test("ordenar por precio, subcategoría y migas de pan", async () => {
  const P = await abrir(srv.base, "/categoria/mates");
  assert.equal(P.d.querySelector("#vistaCategoria").hidden, false, "entrar directo por la dirección funciona");
  const directos = () => nombres(P, "#catProductos > .grid .card h3");
  const orden = P.d.querySelector("#catOrden");
  orden.value = "mayor"; orden.dispatchEvent(P.evento("change"));
  assert.equal(directos().indexOf("NV Caro") < directos().indexOf("NV Barato"), true, "mayor precio primero");
  orden.value = "menor"; orden.dispatchEvent(P.evento("change"));
  assert.equal(directos().indexOf("NV Barato") < directos().indexOf("NV Caro"), true, "menor precio primero");

  P.todos("#catChips .chip").find((c) => c.textContent === "Uruguayos").click();
  assert.equal(enRuta(P), "/categoria/uruguayos");
  assert.deepEqual(nombres(P, "#catProductos .card h3"), ["NV Uruguayo"]);
  const migas = nombres(P, "#catMigas a, #catMigas [aria-current]");
  assert.deepEqual(migas, ["Inicio", "Mates", "Uruguayos"]);
  P.todos("#catMigas a").find((a) => a.textContent === "Mates").click();
  assert.equal(enRuta(P), "/categoria/mates");
  P.cerrar();
});

test("tocar un producto abre su página; atrás vuelve y el link directo funciona", async () => {
  const P = await abrir(srv.base, "/categoria/mates");
  P.todos("#catProductos .card").find((c) => c.querySelector("h3").textContent === "NV Caro").querySelector("h3 a").click();
  assert.equal(enRuta(P), `/producto/${ids.caro}`);
  assert.equal(P.d.querySelector("#vistaProducto").hidden, false);
  assert.equal(P.d.querySelector("#pmBox h1").textContent, "NV Caro");
  assert.equal(P.d.title, "NV Caro | IK Mates");
  assert.deepEqual(nombres(P, "#prodMigas a, #prodMigas [aria-current]"), ["Inicio", "Mates", "NV Caro"]);

  P.w.history.back(); // botón "atrás" del navegador
  await esperar(400);
  assert.equal(enRuta(P), "/categoria/mates");
  assert.equal(P.d.querySelector("#vistaCategoria").hidden, false);
  P.cerrar();

  const directo = await abrir(srv.base, `/producto/${ids.barato}`);
  assert.equal(directo.d.querySelector("#pmBox h1").textContent, "NV Barato");
  assert.deepEqual(directo.errores, []);
  directo.cerrar();
});

test("desde una página interna: 'Contacto' y el buscador llevan de vuelta al inicio", async () => {
  const P = await abrir(srv.base, `/producto/${ids.caro}`);
  P.todos("#subnav a").find((a) => a.textContent === "Contacto").click();
  assert.equal(enRuta(P), "/");
  assert.equal(P.d.querySelector("#vistaInicio").hidden, false);

  P.todos("#subnav a").find((a) => a.textContent === "Inicio").click();
  P.d.querySelector("#megaCols .mega-top").click();
  assert.match(enRuta(P), /^\/categoria\//);
  P.escribir("#search", "Barato");
  await esperar(300);
  assert.equal(enRuta(P), "/", "los resultados de búsqueda se muestran en el inicio");
  assert.deepEqual(nombres(P, "#productos .card h3"), ["NV Barato"]);
  P.cerrar();
});

test("categoría o producto que no existen vuelven al inicio", async () => {
  for (const ruta of ["/categoria/no-existe", "/producto/99999"]) {
    const P = await abrir(srv.base, ruta);
    assert.equal(P.w.location.pathname, "/", ruta);
    assert.equal(P.d.querySelector("#vistaInicio").hidden, false);
    P.cerrar();
  }
});
