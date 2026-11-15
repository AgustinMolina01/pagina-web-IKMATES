const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../ayudas/servidor");
const { client, adminClient } = require("../ayudas/cliente");

let srv, admin, idProducto;
before(async () => {
  srv = await startServer();
  admin = await adminClient(srv.base);
  idProducto = (await admin.post("/api/admin/products", {
    name: 'Mate <b>"Imperial"</b>', category: "mates", price: 18600, desc: "Cuero <script>alert(1)</script> y virola de acero", image: "/img/logo.png",
  })).data.id;
});
after(async () => { await srv.stop(); });

const texto = async (url) => { const r = await fetch(srv.base + url, { redirect: "manual" }); return { status: r.status, body: await r.text(), type: r.headers.get("content-type") || "", headers: r.headers }; };

test("la portada lleva título, descripción y vista previa propios", async () => {
  const r = await texto("/");
  assert.equal(r.status, 200);
  assert.ok(r.body.includes(`<link rel="canonical" href="${srv.base}/">`));
  assert.match(r.body, /og:image/);
  assert.match(r.body, /"@type":"Store"/);
  assert.equal(r.body.match(/<title>/g).length, 1, "un solo título");
});

test("cada producto tiene su link con etiquetas propias y todo escapado", async () => {
  const r = await texto(`/producto/${idProducto}`);
  assert.equal(r.status, 200);
  assert.match(r.body, /<title>Mate &lt;b&gt;&quot;Imperial&quot;&lt;\/b&gt; \| IK Mates<\/title>/);
  assert.match(r.body, /og:type" content="product"/);
  assert.ok(r.body.includes(`og:image" content="${srv.base}/img/logo.png"`));
  assert.ok(!r.body.includes("<script>alert(1)"), "la descripción no inyecta código");
  const ld = r.body.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1];
  const datos = JSON.parse(ld);
  assert.equal(datos.offers.price, 18600);
  assert.equal(datos.offers.availability, "https://schema.org/InStock");
  assert.ok(!ld.includes("<"), "el JSON no puede cerrar la etiqueta");
});

test("un producto inexistente o inactivo vuelve a la portada", async () => {
  assert.equal((await texto("/producto/99999")).status, 302);
  assert.equal((await texto("/producto/abc")).status, 302);
  await admin.put(`/api/admin/products/${idProducto}`, { name: "Mate", category: "mates", price: 1, active: false });
  assert.equal((await texto(`/producto/${idProducto}`)).status, 302);
  await admin.put(`/api/admin/products/${idProducto}`, { name: "Mate", category: "mates", price: 18600, active: true });
});

test("sitemap.xml y robots.txt", async () => {
  const mapa = await texto("/sitemap.xml");
  assert.match(mapa.type, /xml/);
  assert.match(mapa.body, new RegExp(`/producto/${idProducto}<`));
  assert.match(mapa.body, /\/privacidad</);
  const robots = await texto("/robots.txt");
  assert.match(robots.body, /Disallow: \/admin/);
  assert.ok(robots.body.includes(`Sitemap: ${srv.base}/sitemap.xml`));
});

test("páginas legales: texto base, editable y escapado", async () => {
  const priv = await texto("/privacidad");
  assert.equal(priv.status, 200);
  assert.match(priv.body, /<h2>Qué datos guardamos<\/h2>/);
  assert.match((await texto("/terminos")).body, /Cambios y devoluciones/);

  await admin.put("/api/admin/settings", { privacyText: "## Mi título\nLínea <img src=x onerror=alert(1)>\n\nOtro párrafo" });
  const nueva = (await texto("/privacidad")).body;
  assert.match(nueva, /<h2>Mi título<\/h2>/);
  assert.ok(!nueva.includes("<img src=x"), "el texto se escapa");
  assert.match(nueva, /Otro párrafo/);

  // vaciarlo devuelve el texto base
  await admin.put("/api/admin/settings", { privacyText: "" });
  assert.match((await texto("/privacidad")).body, /Qué datos guardamos/);
});

test("los textos legales no viajan con la tienda pero sí con el panel", async () => {
  const publico = client(srv.base);
  assert.ok(!("privacyText" in (await publico.get("/api/settings")).data));
  assert.ok(!("termsText" in (await publico.get("/api/site")).data.settings));
  assert.ok("privacyText" in (await admin.get("/api/admin/settings")).data);
});
