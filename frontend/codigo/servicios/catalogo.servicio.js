// Productos y categorías: carga desde el servidor y consultas para armar menús y secciones.
import { get } from "../compartido/peticiones.js";
import { normalize } from "../compartido/formato.js";
import { state, emit, DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from "./estado.js";
import { setSettings } from "./ajustes.servicio.js";

const OFFLINE_ANNOUNCEMENTS = ["ENVÍOS A TODO EL PAÍS", "COMBOS LISTOS PARA REGALAR", "PEDÍ POR WHATSAPP Y TE ASESORAMOS"];
const OFFLINE_BANNERS = [
  { image: "/img/banner-combos.svg", title: "Combos", link: "/categoria/combos" },
  { image: "/img/banner-yerba.svg", title: "Yerba", link: "/categoria/yerba" },
  { image: "/img/banner-mates.svg", title: "Mates", link: "/categoria/mates" },
];

/** Portada: categorías, ajustes, banners, mensajes, envíos y pagos. Sin servidor, usa valores por defecto. */
export async function loadSite() {
  try {
    const site = await get("/api/site");
    if (Array.isArray(site.categories)) state.categories = site.categories;
    state.announcements = site.announcements || [];
    state.banners = site.banners || [];
    state.shipping = site.shipping || [];
    state.payments = site.payments || [];
    setSettings(site.settings);
  } catch (e) {
    state.categories = DEFAULT_CATEGORIES;
    state.announcements = OFFLINE_ANNOUNCEMENTS;
    state.banners = OFFLINE_BANNERS;
    setSettings(DEFAULT_SETTINGS);
  }
  state.siteLoaded = true;
  emit("site");
}

export async function loadProducts() {
  try {
    state.products = await get("/api/products");
  } catch (e) {
    state.products = [];
  }
  state.productsLoaded = true;
  emit("products");
}

// ---------- Consultas ----------
export const findProduct = (id) => state.products.find((p) => p.id == id);
export const productsIn = (slug) => state.products.filter((p) => p.cat === slug);
export const childrenOf = (slug) => state.categories.filter((c) => c.parent === slug);
export const categoryName = (slug) => (state.categories.find((c) => c.slug === slug) || {}).name || "";

const EMOJI = { mates: "🧉", yerba: "🌿", combos: "🎁", termos: "🫖" };
export const emojiFor = (slug) => EMOJI[slug] || "🛍️";
/** Fondo de la tarjeta sin foto: va rotando entre 3 tonos según la categoría. */
export const toneFor = (slug) => ["", "green", "rose"][Math.max(0, state.categories.findIndex((c) => c.slug === slug)) % 3];

/** Categorías principales que tienen productos (ellas o sus subcategorías), con sus subcategorías no vacías. */
export function navTree() {
  return state.categories
    .filter((c) => !c.parent)
    .map((c) => ({ ...c, kids: childrenOf(c.slug).filter((k) => productsIn(k.slug).length) }))
    .filter((c) => productsIn(c.slug).length || c.kids.length);
}

/** ¿El producto coincide con el texto del buscador? */
export const matchesQuery = (product) => {
  const q = normalize(state.query.trim());
  return !q || normalize(product.name + " " + product.desc).includes(q);
};

// ---------- Stock y opciones ----------
export const LOW_STOCK = 5;
/** Texto de aviso cuando quedan pocas unidades (o "" si no corresponde). */
export const stockNote = (p) =>
  p.stock !== null && p.stock > 0 && p.stock <= LOW_STOCK ? (p.stock === 1 ? "¡Última unidad!" : `¡Últimas ${p.stock} unidades!`) : "";
export const hasOptions = (p) => Array.isArray(p.options) && p.options.length > 0;
