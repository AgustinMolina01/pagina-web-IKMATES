// Estado central de la tienda + avisos entre componentes.
// Los componentes no se llaman entre sí: escuchan eventos  on("products", fn)  y quien cambia algo avisa  emit("products").
//
// Eventos: "site" (categorías, ajustes, banners, envíos y pagos) · "products" · "query" (buscador) ·
//          "cart" · "quote" (totales del servidor) · "account"

export const DEFAULT_SETTINGS = {
  whatsapp: "5493412147956", hours: "9 a 18 hs", address: "San Martín 1974, Rosario",
  heroEyebrow: "Tradición argentina", heroTitle: "Tomá mate con", heroTitleEm: "estilo propio",
  heroText: "Mates, yerba y combos seleccionados, con envíos a todo el país. Hacé tu pedido en minutos por WhatsApp.",
  instagram: "", facebook: "", tiktok: "", payments: "", shipping: "", wholesaleNote: "",
};

export const DEFAULT_CATEGORIES = [
  { slug: "mates", name: "Mates", parent: null },
  { slug: "yerba", name: "Yerba", parent: null },
  { slug: "combos", name: "Combos", parent: null },
];

export const state = {
  products: [],
  siteLoaded: false,     // true cuando ya llegaron las categorías y ajustes del servidor
  productsLoaded: false, // true cuando ya se pidieron los productos al servidor (aunque no haya)
  categories: DEFAULT_CATEGORIES,
  settings: { ...DEFAULT_SETTINGS },
  announcements: [],
  banners: [],
  shipping: [],   // formas de entrega activas
  payments: [],   // formas de pago activas
  vista: { tipo: "inicio" }, // página que se está viendo (ver navegacion.servicio.js)
  query: "",      // texto del buscador
  cart: [],       // [{ key, id, qty, options }]
  checkout: { shippingId: null, paymentId: null, shipTo: "", province: "", coupon: "" },
  quote: null,    // últimos totales calculados por el servidor
  account: null,  // cliente con sesión iniciada
};

// Los avisos entre componentes viven en compartido/eventos.js (se reexportan acá por comodidad)
export { on, emit } from "../compartido/eventos.js";
