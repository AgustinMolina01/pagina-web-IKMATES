// Datos del panel que usan varios componentes (categorías y productos) + funciones para pedirlos.
import { get } from "../../compartido/peticiones.js";
import { esc } from "../../compartido/elementos.js";
import { emit } from "../../compartido/eventos.js";

export const datos = {
  categorias: [],
  productos: [],
};

// ---------- Categorías (dos niveles) ----------
export const principales = () => datos.categorias.filter((c) => !c.parent_id);
export const hijas = (id) => datos.categorias.filter((c) => c.parent_id === id);
/** Principales, cada una seguida de sus subcategorías. */
export const ordenadas = () => principales().flatMap((c) => [c, ...hijas(c.id)]);
const buscarPorId = (id) => datos.categorias.find((c) => c.id === id);
export const nombreCompleto = (c) => (c.parent_id ? `${(buscarPorId(c.parent_id) || {}).name || ""} › ${c.name}` : c.name);
export const etiquetaCategoria = (slug) => {
  const c = datos.categorias.find((x) => x.slug === slug);
  return c ? nombreCompleto(c) : slug;
};
/** <option> de todas las categorías, con la jerarquía. */
export const opcionesCategorias = (primera = "") =>
  (primera ? `<option value="">${primera}</option>` : "") +
  ordenadas().map((c) => `<option value="${esc(c.slug)}">${esc(nombreCompleto(c))}</option>`).join("");

export async function cargarCategorias() {
  datos.categorias = await get("/api/admin/categories");
  emit("categorias");
}
export async function cargarProductos() {
  datos.productos = await get("/api/admin/products");
  emit("productos");
}
