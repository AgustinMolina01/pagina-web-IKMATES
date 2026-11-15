// Cliente HTTP con "frasco de cookies" propio: sirve para simular a distintas personas a la vez.
function client(base) {
  const jar = {};
  const call = async (method, url, body) => {
    const headers = { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") };
    if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    const res = await fetch(base + url, {
      method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const name = pair.slice(0, pair.indexOf("=")), value = pair.slice(pair.indexOf("=") + 1);
      if (/Max-Age=0/i.test(c)) delete jar[name]; else jar[name] = value;
    }
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : null;
    return { status: res.status, data, headers: res.headers, res, cookies: { ...jar } };
  };
  return {
    get: (u) => call("GET", u), post: (u, b = {}) => call("POST", u, b), put: (u, b = {}) => call("PUT", u, b), del: (u) => call("DELETE", u),
    jar,
  };
}

async function adminClient(base, password = "ikmates2024", email = "admin@ikmates.com") {
  const c = client(base);
  const r = await c.post("/api/admin/login", { email, password });
  if (r.status !== 200) throw new Error("No se pudo ingresar como administradora: " + r.status);
  return c;
}

module.exports = { client, adminClient };
