const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../ayudas/servidor");
const { client, adminClient } = require("../ayudas/cliente");

let srv, admin, productId, pickup, cash;
before(async () => {
  srv = await startServer({ REGISTER_LIMIT: "500" });
  admin = await adminClient(srv.base);
  productId = (await client(srv.base).get("/api/products")).data[0].id;
  const site = (await client(srv.base).get("/api/site")).data;
  pickup = site.shipping[0].id; cash = site.payments[1].id;
});
after(async () => { await srv.stop(); });

const order = (c) => c.post("/api/orders", { items: [{ id: productId, qty: 1 }], shippingId: pickup, paymentId: cash });
const register = (c, name, email, extra = {}) => c.post("/api/account/register", { name, email, password: "clave1234", ...extra });

test("registro: valida nombre, email, contraseña y teléfono; normaliza los datos", async () => {
  const c = client(srv.base);
  assert.equal((await register(c, "A", "a@x.com")).status, 400, "nombre corto");
  assert.equal((await register(c, "Ana Pérez", "no-es-email")).status, 400, "email inválido");
  assert.equal((await c.post("/api/account/register", { name: "Ana Pérez", email: "a@x.com", password: "corta" })).status, 400, "clave corta");
  assert.equal((await register(c, "Ana Pérez", "a@x.com", { phone: "12" })).status, 400, "teléfono corto");
  const ok = await register(c, "Ana Pérez", "ANA@Ejemplo.com", { phone: "+54 341 214-7956" });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.customer.email, "ana@ejemplo.com");
  assert.equal(ok.data.customer.phone, "543412147956");
  assert.ok(!("pw" in ok.data.customer), "nunca se devuelve la clave");
  assert.ok(c.jar.ik_user, "queda con la sesión iniciada");
  assert.equal((await register(client(srv.base), "Otra", "ana@EJEMPLO.com")).status, 400, "email repetido sin importar mayúsculas");
});

test("ingreso y salida; el mensaje de error no revela qué emails existen", async () => {
  const c = client(srv.base);
  await register(c, "Beto Gómez", "beto@ejemplo.com");
  await c.post("/api/account/logout");
  assert.equal((await c.get("/api/account/me")).data.customer, null);
  const bad = await c.post("/api/account/login", { email: "beto@ejemplo.com", password: "mala-clave" });
  const none = await c.post("/api/account/login", { email: "nadie@nada.com", password: "mala-clave" });
  assert.equal(bad.status, 401);
  assert.equal(none.status, 401);
  assert.equal(bad.data.error, none.data.error);
  assert.equal((await c.post("/api/account/login", { email: "BETO@ejemplo.com", password: "clave1234" })).status, 200);
});

test("tras 8 intentos fallidos se bloquea ese email", async () => {
  const c = client(srv.base);
  let last = 0;
  for (let i = 0; i < 9; i++) last = (await c.post("/api/account/login", { email: "limite@x.com", password: "x" + i })).status;
  assert.equal(last, 429);
});

test("'Mis pedidos' muestra solo los propios y el panel ve de quién es cada pedido", async () => {
  const ana = client(srv.base), beto = client(srv.base), anon = client(srv.base);
  await register(ana, "Ana Pérez", "ana2@ejemplo.com");
  await register(beto, "Beto Gómez", "beto2@ejemplo.com");
  const o1 = (await order(ana)).data.id;
  await order(beto);
  const o3 = (await order(anon)).data.id;

  const mine = (await ana.get("/api/account/orders")).data;
  assert.deepEqual(mine.map((o) => o.id), [o1]);
  assert.equal((await anon.get("/api/account/orders")).status, 401);

  const all = (await admin.get("/api/admin/orders")).data.orders;
  assert.equal(all.find((o) => o.id === o1).customer.email, "ana2@ejemplo.com");
  assert.equal(all.find((o) => o.id === o3).customer, null, "sin cuenta: sin cliente");
});

test("una clienta no puede usar las funciones del panel", async () => {
  const c = client(srv.base);
  await register(c, "Caro Díaz", "caro@ejemplo.com");
  assert.equal((await c.get("/api/admin/customers")).status, 401);
  assert.equal((await c.get("/api/admin/orders")).status, 401);
});

test("panel: lista sin claves, contraseña temporal, baja de cuenta", async () => {
  const c = client(srv.base);
  await register(c, "Dani Ruiz", "dani@ejemplo.com");
  await order(c);
  const list = (await admin.get("/api/admin/customers")).data;
  const dani = list.find((x) => x.email === "dani@ejemplo.com");
  assert.equal(dani.orders, 1);
  assert.ok(!JSON.stringify(list).includes("scrypt") && !("pw" in dani), "no se exponen hashes");

  const temp = (await admin.post(`/api/admin/customers/${dani.id}/reset-password`)).data.password;
  assert.equal(temp.length, 10);
  const login = (pw) => client(srv.base).post("/api/account/login", { email: "dani@ejemplo.com", password: pw });
  assert.equal((await login("clave1234")).status, 401, "la vieja deja de funcionar");
  assert.equal((await login(temp)).status, 200, "la temporal funciona");

  await admin.del(`/api/admin/customers/${dani.id}`);
  assert.equal((await c.get("/api/account/me")).data.customer, null, "la sesión de una cuenta borrada deja de valer");
  const orders = (await admin.get("/api/admin/orders")).data.orders;
  assert.ok(orders.every((o) => o.customer === null || o.customer.email !== "dani@ejemplo.com"), "los pedidos quedan, sin cuenta");
});
