const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../ayudas/servidor");
const { client, adminClient } = require("../ayudas/cliente");

let srv, admin;
before(async () => { srv = await startServer(); admin = await adminClient(srv.base); });
after(async () => { await srv.stop(); });

const day = (offset) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test("publicaciones programadas: solo se ven las vigentes y las sin fecha", async () => {
  const mk = async (title, startDate, endDate) => (await admin.post("/api/admin/banners", { image: "/img/logo.png", title, startDate, endDate })).data.id;
  await mk("vigente", day(-1), day(1)); await mk("vencida", day(-10), day(-1)); await mk("futura", day(2), day(9)); await mk("sin-fecha", "", "");
  const titles = (await client(srv.base).get("/api/site")).data.banners.map((b) => b.title);
  assert.ok(titles.includes("vigente") && titles.includes("sin-fecha"));
  assert.ok(!titles.includes("vencida") && !titles.includes("futura"));
  assert.equal((await admin.post("/api/admin/banners", { image: "/img/logo.png", startDate: day(5), endDate: day(1) })).status, 400, "fin anterior al inicio");
  assert.equal((await admin.post("/api/admin/banners", { title: "sin imagen" })).status, 400);
  // los enlaces peligrosos se vacían
  const id = (await admin.post("/api/admin/banners", { image: "/img/logo.png", link: "javascript:alert(1)", title: "xss" })).data.id;
  assert.equal((await admin.get("/api/admin/banners")).data.find((b) => b.id === id).link, "");
});

test("mensajes de la barra superior", async () => {
  assert.equal((await admin.post("/api/admin/announcements", { text: "   " })).status, 400);
  const id = (await admin.post("/api/admin/announcements", { text: "PROMO" })).data.id;
  assert.ok((await client(srv.base).get("/api/site")).data.announcements.includes("PROMO"));
  await admin.put(`/api/admin/announcements/${id}`, { text: "PROMO", active: false });
  assert.ok(!(await client(srv.base).get("/api/site")).data.announcements.includes("PROMO"));
});

test("ajustes del negocio: se limpian, validan y conservan los valores por defecto", async () => {
  assert.equal((await admin.put("/api/admin/settings", { whatsapp: "123" })).status, 400);
  assert.equal((await admin.put("/api/admin/settings", { whatsapp: "+54 9 341 555-0000", hours: "10 a 20 hs", instagram: "@ikmates", payments: "Transferencia\nEfectivo" })).status, 200);
  const s = (await client(srv.base).get("/api/settings")).data;
  assert.equal(s.whatsapp, "5493415550000", "el número se guarda solo con dígitos (sin cortarse)");
  assert.equal(s.hours, "10 a 20 hs");
  assert.match(s.address, /Rosario/, "lo que no se editó conserva el valor por defecto");
  await admin.put("/api/admin/settings", { hours: "" });
  assert.equal((await client(srv.base).get("/api/settings")).data.hours, "9 a 18 hs", "un campo obligatorio vacío vuelve al valor por defecto");
});

test("subida de fotos: acepta imágenes, rechaza otros archivos", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const good = new FormData(); good.append("image", new Blob([png], { type: "image/png" }), "foto.png");
  const ok = await admin.post("/api/admin/upload", good);
  assert.equal(ok.status, 200);
  assert.match(ok.data.url, /^\/uploads\/.+\.png$/);
  assert.equal((await fetch(srv.base + ok.data.url)).status, 200, "la foto se puede ver");

  const bad = new FormData(); bad.append("image", new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "malo.html");
  assert.equal((await admin.post("/api/admin/upload", bad)).status, 400);
  assert.equal((await client(srv.base).post("/api/admin/upload", good)).status, 401, "sin sesión no se sube nada");
});

test("respaldo: .zip válido con la base de datos y las fotos", async () => {
  const res = await admin.get("/api/admin/backup");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/zip");
  const buf = Buffer.from(await res.res.arrayBuffer());
  assert.equal(buf.readUInt32LE(0), 0x04034b50, "empieza como un zip");
  const file = path.join(os.tmpdir(), `respaldo-${Date.now()}.zip`);
  fs.writeFileSync(file, buf);
  try {
    // tar de Windows/macOS (bsdtar) lee zips: valida de verdad la estructura
    const out = execFileSync(process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar", ["-tf", file]).toString();
    assert.match(out, /ikmates\.db/);
    assert.match(out, /uploads\/.+\.png/);
  } finally { fs.rmSync(file, { force: true }); }
  assert.equal((await client(srv.base).get("/api/admin/backup")).status, 401);
});
