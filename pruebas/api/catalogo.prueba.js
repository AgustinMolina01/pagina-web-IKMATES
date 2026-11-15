const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../ayudas/servidor");
const { client, adminClient } = require("../ayudas/cliente");

let srv, admin;
before(async () => { srv = await startServer(); admin = await adminClient(srv.base); });
after(async () => { await srv.stop(); });

const newProduct = async (extra = {}) => {
  const r = await admin.post("/api/admin/products", { name: "Prueba", category: "mates", price: 1000, ...extra });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.id;
};
const getProduct = async (id) => (await admin.get("/api/admin/products")).data.find((p) => p.id === id);

test("categorías de dos niveles con sus reglas", async () => {
  const top = (await admin.post("/api/admin/categories", { name: "Mate Uruguayo" })).data.id;
  const sub = await admin.post("/api/admin/categories", { name: "Camionero", parent_id: top });
  assert.equal(sub.status, 200);
  assert.equal((await admin.post("/api/admin/categories", { name: "Tercer nivel", parent_id: sub.data.id })).status, 400, "no hay tercer nivel");
  assert.equal((await admin.post("/api/admin/categories", { name: "mate uruguayo" })).status, 400, "nombre repetido en el mismo lugar");
  assert.equal((await admin.post("/api/admin/categories", { name: "   " })).status, 400, "vacío");
  assert.equal((await admin.del(`/api/admin/categories/${top}`)).status, 400, "con subcategorías no se borra");
  // acentos: el identificador sale sin acento
  const acc = await admin.post("/api/admin/categories", { name: "Clásicos", parent_id: top });
  const cats = (await admin.get("/api/admin/categories")).data;
  assert.equal(cats.find((c) => c.id === acc.data.id).slug, "clasicos");
  // nombres que usa la página reciben otro identificador
  const reserved = await admin.post("/api/admin/categories", { name: "Contacto" });
  assert.equal((await admin.get("/api/admin/categories")).data.find((c) => c.id === reserved.data.id).slug, "contacto-cat");
  // el público solo ve lo activo
  await admin.put(`/api/admin/categories/${acc.data.id}`, { name: "Clásicos", active: false });
  const site = (await client(srv.base).get("/api/site")).data;
  assert.ok(!site.categories.some((c) => c.slug === "clasicos"));
  assert.ok(site.categories.some((c) => c.slug === "camionero" && c.parent === "mate-uruguayo"));
});

test("producto: validaciones y datos guardados", async () => {
  assert.equal((await admin.post("/api/admin/products", { name: "", category: "mates", price: 1 })).status, 400, "sin nombre");
  assert.equal((await admin.post("/api/admin/products", { name: "X", category: "no-existe", price: 1 })).status, 400, "categoría inexistente");
  assert.equal((await admin.post("/api/admin/products", { name: "X", category: "mates", price: -5 })).status, 400, "precio negativo");
  assert.equal((await admin.post("/api/admin/products", { name: "X", category: "mates", price: 1000, wholesalePrice: 800 })).status, 400, "mayorista sin cantidad mínima");
  assert.equal((await admin.post("/api/admin/products", { name: "X", category: "mates", price: 1000, wholesalePrice: 1200, wholesaleMin: 3 })).status, 400, "mayorista más caro");
  assert.equal((await admin.post("/api/admin/products", { name: "X", category: "mates", price: 1000, stock: "abc" })).status, 400, "stock no numérico");

  const id = await newProduct({
    wholesalePrice: 800, wholesaleMin: 6, featured: true, image: "/img/logo.png",
    images: ["/uploads/a.jpg", "http://malo.com/x.jpg", "/img/banner-mates.svg"],
  });
  const p = await getProduct(id);
  assert.equal(p.featured, true);
  assert.deepEqual(p.wholesale, { price: 800, min: 6 });
  assert.deepEqual(p.images, ["/uploads/a.jpg", "/img/banner-mates.svg"], "las fotos externas se descartan");
  assert.equal(p.stock, null);
});

test("variantes: se limpian (duplicados, vacíos, límites)", async () => {
  const id = await newProduct({
    options: [
      { name: "Color", values: ["Negro", "negro", " ", { label: "Rojo", soldOut: true }, "Azul"] },
      { name: "color", values: ["Otro"] },
      { name: "", values: ["x"] },
      { name: "Virola", values: ["Acero", "Alpaca"] },
      { name: "Grabado", values: ["Sí"] },
      { name: "CuartoGrupo", values: ["No entra"] },
    ],
  });
  const p = await getProduct(id);
  assert.deepEqual(p.options.map((g) => g.name), ["Color", "Virola", "Grabado"], "máximo 3 grupos, sin repetir nombre");
  assert.deepEqual(p.options[0].values, [{ label: "Negro", soldOut: false }, { label: "Rojo", soldOut: true }, { label: "Azul", soldOut: false }]);
});

test("stock en cantidades: 0 deja el producto agotado y se puede quitar el control", async () => {
  const id = await newProduct({ stock: 3 });
  assert.equal((await getProduct(id)).soldOut, false);
  await admin.put(`/api/admin/products/${id}`, { name: "Prueba", category: "mates", price: 1000, stock: 0 });
  const p = await getProduct(id);
  assert.equal(p.soldOut, true, "stock 0 = agotado");
  assert.equal(p.soldOutFlag, false, "sin marcar la casilla a mano");
  const pub = (await client(srv.base).get("/api/products")).data.find((x) => x.id === id);
  assert.equal(pub.soldOut, true);
  await admin.put(`/api/admin/products/${id}`, { name: "Prueba", category: "mates", price: 1000, stock: "" });
  assert.equal((await getProduct(id)).stock, null, "vacío = sin control de cantidad");
  assert.equal((await getProduct(id)).soldOut, false);
});

test("acciones masivas, orden y cambio de precios con vista previa", async () => {
  const a = await newProduct({ name: "Masivo A", price: 500 }), b = await newProduct({ name: "Masivo B", price: 1000, wholesalePrice: 800, wholesaleMin: 3 });
  assert.equal((await admin.post("/api/admin/products/bulk", { ids: [a, b], action: "hide" })).data.count, 2);
  assert.ok(!(await client(srv.base).get("/api/products")).data.some((p) => p.id === a), "ocultos no salen al público");
  await admin.post("/api/admin/products/bulk", { ids: [a, b], action: "show" });
  await admin.post("/api/admin/products/bulk", { ids: [a, b], action: "move", category: "yerba" });
  assert.equal((await getProduct(a)).cat, "yerba");
  assert.equal((await getProduct(b)).cat, "yerba");
  assert.equal((await admin.post("/api/admin/products/bulk", { ids: [a], action: "move", category: "no-existe" })).status, 400);
  assert.equal((await admin.post("/api/admin/products/bulk", { ids: [a], action: "volar" })).status, 400);
  assert.equal((await admin.post("/api/admin/products/bulk", { ids: [], action: "hide" })).status, 400);

  const preview = await admin.post("/api/admin/products/bulk-price", { scope: "ids", ids: [a, b], mode: "percent", value: 10, round: 100, includeWholesale: true, dryRun: true });
  assert.equal(preview.data.count, 2);
  assert.equal(preview.data.sample.find((s) => s.id === a).to, 600, "$500 + 10% redondeado a 100");
  assert.equal((await getProduct(a)).price, 500, "la vista previa no cambia nada");
  await admin.post("/api/admin/products/bulk-price", { scope: "ids", ids: [a, b], mode: "percent", value: 10, round: 100, includeWholesale: true });
  assert.equal((await getProduct(a)).price, 600);
  assert.deepEqual((await getProduct(b)).wholesale, { price: 900, min: 3 }, "también ajusta el mayorista");
  assert.equal((await admin.post("/api/admin/products/bulk-price", { scope: "all", mode: "percent", value: 5000 })).status, 400);
  assert.equal((await admin.post("/api/admin/products/bulk-price", { scope: "all", mode: "percent", value: 0 })).status, 400);

  // orden con flechas dentro de la categoría
  const list = (await admin.get("/api/admin/products")).data.filter((p) => p.cat === "yerba").sort((x, y) => x.sort - y.sort || x.id - y.id);
  const last = list[list.length - 1];
  await admin.post(`/api/admin/products/${last.id}/move`, { dir: -1 });
  const after2 = (await admin.get("/api/admin/products")).data.filter((p) => p.cat === "yerba").sort((x, y) => x.sort - y.sort || x.id - y.id);
  assert.equal(after2[after2.length - 2].id, last.id);
});

test("carga desde planilla: precios argentinos, categorías nuevas, stock y variantes", async () => {
  const r = await admin.post("/api/admin/products/import", {
    rows: [
      { categoria: "Torpedos Costo Mayorista", nombre: "Torpedo importado", precio: "18.600,00 ARS", descripcion: "d", etiqueta: "Nuevo", destacado: "si", precio_mayorista: "15.000", minimo_mayorista: "5", stock: "12", opciones: "Color: Negro|Rojo; Virola: Acero|Alpaca" },
      { categoria: "Mate Importado > Sub Importada", nombre: "Con subcategoría", precio: "17900" },
      { categoria: "Mates", nombre: "", precio: "100" },
      { categoria: "Mates", nombre: "Sin precio", precio: "abc" },
      { categoria: "", nombre: "Sin categoría", precio: "100" },
    ],
  });
  assert.equal(r.data.created, 2);
  assert.equal(r.data.errorCount, 3);
  assert.equal(r.data.categoriesCreated, 3, "Torpedos + Mate Importado + Sub Importada");
  const p = (await admin.get("/api/admin/products")).data.find((x) => x.name === "Torpedo importado");
  assert.equal(p.price, 18600);
  assert.equal(p.stock, 12);
  assert.equal(p.featured, true);
  assert.deepEqual(p.wholesale, { price: 15000, min: 5 });
  assert.deepEqual(p.options.map((g) => g.name), ["Color", "Virola"]);
  assert.equal((await admin.post("/api/admin/products/import", { rows: [] })).status, 400);
});
