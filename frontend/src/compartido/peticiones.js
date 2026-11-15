// Llamadas al servidor. Todas devuelven el JSON o lanzan un Error con el mensaje del servidor.
let onUnauthorized = null;

/** El panel registra acá qué hacer si la sesión venció (volver al login). */
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function request(method, url, body) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body !== undefined && !isForm ? { "Content-Type": "application/json" } : {},
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && onUnauthorized && !url.includes("login")) onUnauthorized();
    const error = new Error(data.error || "No se pudo completar la acción");
    error.status = res.status;
    throw error;
  }
  return data;
}

export const get = (url) => request("GET", url);
export const post = (url, body = {}) => request("POST", url, body);
export const put = (url, body = {}) => request("PUT", url, body);
export const del = (url) => request("DELETE", url);
