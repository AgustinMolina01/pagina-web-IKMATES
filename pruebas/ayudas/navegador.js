// Abre una página del sitio en un navegador simulado (jsdom), con sus scripts, y devuelve herramientas para probarla.
const { JSDOM, VirtualConsole, ResourceLoader } = require("jsdom");

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param base  dirección del servidor de prueba (http://localhost:3xxx)
 * @param ruta  "/" o "/admin"
 * @param opciones.cookies  frasco de cookies { nombre: valor } compartido (para simular a una misma persona)
 * @param opciones.sinServidor  si es true, todos los pedidos al servidor fallan (modo sin conexión)
 */
async function abrir(base, ruta, opciones = {}) {
  const errores = [], ventanas = [];
  const cookies = opciones.cookies || {};
  const consola = new VirtualConsole();
  consola.on("jsdomError", (e) => errores.push(e.detail?.message || e.message));

  // Solo se cargan los archivos propios; fuentes, mapas, etc. se ignoran
  class SoloPropios extends ResourceLoader {
    fetch(url, o) { return url.startsWith(base) ? super.fetch(url, o) : Promise.resolve(Buffer.from("")); }
  }

  const dom = await JSDOM.fromURL(base + ruta, {
    runScripts: "dangerously", resources: new SoloPropios(), pretendToBeVisual: true, virtualConsole: consola,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: true });
      w.scrollTo = () => {};
      w.Element.prototype.scrollIntoView = () => {};
      w.confirm = () => true;
      w.prompt = (mensaje, porDefecto) => porDefecto;
      w.alert = (mensaje) => errores.push("alert: " + mensaje);
      w.open = (url) => { const v = { location: { href: "" }, closed: false, close() { v.closed = true; } }; ventanas.push({ url, v }); return v; };
      w.fetch = async (url, o = {}) => {
        if (opciones.sinServidor) throw new Error("sin servidor");
        const cabeceras = { ...(o.headers || {}), cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") };
        const r = await fetch(new URL(url, base).href, { ...o, headers: cabeceras });
        for (const c of r.headers.getSetCookie()) {
          const [par] = c.split(";"), nombre = par.slice(0, par.indexOf("=")), valor = par.slice(par.indexOf("=") + 1);
          if (/Max-Age=0/i.test(c)) delete cookies[nombre]; else cookies[nombre] = valor;
        }
        return r;
      };
    },
  });
  await esperar(opciones.espera || 1500);
  const d = dom.window.document;
  return {
    dom, d, w: dom.window, errores, ventanas, cookies,
    todos: (sel) => [...d.querySelectorAll(sel)],
    evento: (nombre) => new dom.window.Event(nombre, { bubbles: true, cancelable: true }),
    /** Dispara el envío de un formulario como lo haría el navegador. */
    enviar(form) { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); },
    escribir(sel, valor) { const el = d.querySelector(sel); el.value = valor; el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); },
    cerrar: () => dom.window.close(),
  };
}

module.exports = { abrir, esperar };
