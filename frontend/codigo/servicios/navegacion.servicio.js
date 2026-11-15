// Navegación de la tienda: cada categoría y cada producto tienen su propia página y dirección.
//   /                    → inicio
//   /categoria/mates     → todos los productos de esa categoría
//   /producto/12         → la página del producto
// No recarga la página: cambia lo que se ve, actualiza la barra de direcciones y respeta el botón "atrás".
// Los componentes escuchan el evento "vista" (state.vista = { tipo, slug | id }).
import { $ } from "../compartido/elementos.js";
import { state, emit } from "./estado.js";

const TITULO_INICIO = document.title;
const VISTAS = { inicio: "#vistaInicio", categoria: "#vistaCategoria", producto: "#vistaProducto" };

/** "/categoria/mates" → { tipo: "categoria", slug: "mates" } */
export function leerRuta(ruta) {
  let m = /^\/categoria\/([a-z0-9-]+)\/?$/.exec(ruta);
  if (m) return { tipo: "categoria", slug: m[1] };
  m = /^\/producto\/(\d+)\/?$/.exec(ruta);
  if (m) return { tipo: "producto", id: Number(m[1]) };
  return { tipo: "inicio" };
}

export const rutaCategoria = (slug) => `/categoria/${slug}`;
export const rutaProducto = (id) => `/producto/${id}`;

function mostrar(ancla) {
  state.vista = leerRuta(location.pathname);
  for (const [tipo, selector] of Object.entries(VISTAS)) { const el = $(selector); if (el) el.hidden = tipo !== state.vista.tipo; }
  if (state.vista.tipo === "inicio") document.title = TITULO_INICIO;
  emit("vista");
  if (ancla && state.vista.tipo === "inicio") {
    const destino = $(ancla);
    if (destino) { destino.scrollIntoView({ behavior: "smooth" }); return; }
  }
  window.scrollTo(0, 0);
}

/** Va a otra página de la tienda sin recargar. `ancla` ("#contacto") baja a esa sección del inicio. */
export function irA(ruta, { ancla = "", reemplazar = false } = {}) {
  try { history[reemplazar ? "replaceState" : "pushState"](null, "", ruta); } catch { /* sin historial: igual se muestra */ }
  mostrar(ancla);
}

export function iniciarNavegacion() {
  window.addEventListener("popstate", () => mostrar());

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const enlace = e.target.closest("a[href]");
    if (enlace && !enlace.target) {
      const href = enlace.getAttribute("href");
      if (/^\/(categoria|producto)\/[^/]+\/?$/.test(href) || href === "/") { e.preventDefault(); return irA(href); }
      // Un enlace a una sección ("#contacto") desde otra página: volver al inicio y bajar hasta ahí
      if (href.startsWith("#") && state.vista.tipo !== "inicio") { e.preventDefault(); return irA("/", { ancla: href.length > 1 ? href : "" }); }
      return;
    }
    const abrir = e.target.closest("[data-open]"); // botones "Elegir opciones", productos relacionados…
    if (abrir) irA(rutaProducto(abrir.dataset.open));
  });

  mostrar();
}
