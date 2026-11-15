const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../ayudas/servidor");
const { client, adminClient } = require("../ayudas/cliente");

let srv;
before(async () => { srv = await startServer(); });
after(async () => { await srv.stop(); });

test("el panel exige sesión y las rutas inexistentes dan 404 en JSON", async () => {
  const c = client(srv.base);
  for (const url of ["/api/admin/products", "/api/admin/orders", "/api/admin/customers", "/api/admin/settings", "/api/admin/backup"]) {
    assert.equal((await c.get(url)).status, 401, url);
  }
  const r = await c.get("/api/nada");
  assert.equal(r.status, 404);
  assert.ok(r.data.error);
});

test("login: exige correo y contraseña, no revela cuál falló, aviso de contraseña inicial", async () => {
  const c = client(srv.base);
  const malaClave = await c.post("/api/admin/login", { email: "admin@ikmates.com", password: "mala" });
  const malCorreo = await c.post("/api/admin/login", { email: "otro@correo.com", password: "ikmates2024" });
  const sinCorreo = await c.post("/api/admin/login", { password: "ikmates2024" });
  assert.deepEqual([malaClave.status, malCorreo.status, sinCorreo.status], [401, 401, 401]);
  assert.equal(malaClave.data.error, malCorreo.data.error, "el mensaje es el mismo: no da pistas");
  assert.match(malaClave.data.error, /correo o contraseña/i);
  assert.equal((await c.post("/api/admin/login", { email: "  ADMIN@IkMates.com ", password: "ikmates2024" })).status, 200, "no distingue mayúsculas ni espacios en el correo");
  const me = await c.get("/api/admin/me");
  assert.equal(me.status, 200);
  assert.equal(me.data.defaultPassword, true);
});

test("cambiar el correo de ingreso: pide la contraseña, valida el formato y el viejo deja de servir", async () => {
  const a = await adminClient(srv.base), c = client(srv.base);
  assert.equal((await a.get("/api/admin/me")).data.email, "admin@ikmates.com");
  assert.equal((await a.post("/api/admin/email", { email: "dueña@ejemplo.com", current: "mala" })).status, 400, "contraseña incorrecta");
  assert.equal((await a.post("/api/admin/email", { email: "no-es-un-correo", current: "ikmates2024" })).status, 400, "formato inválido");
  assert.equal((await c.post("/api/admin/email", { email: "x@y.com", current: "ikmates2024" })).status, 401, "sin sesión no se puede");
  const ok = await a.post("/api/admin/email", { email: "  Ventas@IKMates.com ", current: "ikmates2024" });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.email, "ventas@ikmates.com");
  assert.equal((await a.get("/api/admin/me")).status, 200, "la sesión abierta sigue");
  assert.equal((await c.post("/api/admin/login", { email: "admin@ikmates.com", password: "ikmates2024" })).status, 401, "el correo viejo ya no sirve");
  assert.equal((await c.post("/api/admin/login", { email: "ventas@ikmates.com", password: "ikmates2024" })).status, 200, "el nuevo sí");
  await a.post("/api/admin/email", { email: "admin@ikmates.com", current: "ikmates2024" }); // vuelve al inicial para las demás pruebas
});

test("cambiar la contraseña: valida, cierra otras sesiones y mantiene la actual", async () => {
  const a = await adminClient(srv.base), other = await adminClient(srv.base);
  assert.equal((await a.post("/api/admin/password", { current: "x", next: "nuevaclave123" })).status, 400, "clave actual incorrecta");
  assert.equal((await a.post("/api/admin/password", { current: "ikmates2024", next: "corta" })).status, 400, "muy corta");
  assert.equal((await a.post("/api/admin/password", { current: "ikmates2024", next: "ikmates2024" })).status, 400, "igual a la actual");
  assert.equal((await a.post("/api/admin/password", { current: "ikmates2024", next: "nuevaclave123" })).status, 200);

  assert.equal((await a.get("/api/admin/me")).data.defaultPassword, false);
  assert.equal((await a.get("/api/admin/me")).status, 200, "quien la cambió sigue con sesión");
  assert.equal((await other.get("/api/admin/me")).status, 401, "las otras sesiones se cierran");

  const c = client(srv.base);
  assert.equal((await c.post("/api/admin/login", { email: "admin@ikmates.com", password: "ikmates2024" })).status, 401, "la vieja ya no sirve");
  assert.equal((await c.post("/api/admin/login", { email: "admin@ikmates.com", password: "nuevaclave123" })).status, 200, "la nueva sí");
});

test("tras 8 ingresos fallidos se bloquea el login un rato", async () => {
  const c = client(srv.base);
  let last = 0;
  for (let i = 0; i < 9; i++) last = (await c.post("/api/admin/login", { email: "admin@ikmates.com", password: "x" + i })).status;
  assert.equal(last, 429);
});

test("los archivos del servidor no se pueden descargar desde el navegador", async () => {
  for (const url of ["/backend/servidor.js", "/servidor.js", "/package.json", "/datos/ikmates.db", "/backend/datos/ikmates.db", "/backend/src/configuracion.js", "/frontend/src/principal-tienda.js", "/pruebas/ejecutar.js"]) {
    assert.equal((await fetch(srv.base + url)).status, 404, url);
  }
  assert.equal((await fetch(srv.base + "/")).status, 200);
  assert.equal((await fetch(srv.base + "/admin")).status, 200);
});
