import "./pie-de-pagina.css";
import { $, esc } from "../../compartido/elementos.js";
import { formatPhone, socialUrl } from "../../compartido/formato.js";
import { state, on } from "../../servicios/estado.js";
import { helloLink } from "../../servicios/ajustes.servicio.js";
import { navTree } from "../../servicios/catalogo.servicio.js";
import { rutaCategoria } from "../../servicios/navegacion.servicio.js";

const NETWORKS = {
  instagram: {
    name: "Instagram",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  },
  facebook: {
    name: "Facebook",
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-8h2.8l.4-3h-3.2V8.1c0-.9.3-1.6 1.7-1.6h1.7V3.8c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V10H6.8v3h2.9v8h3.8Z"/></svg>',
  },
  tiktok: {
    name: "TikTok",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4v11.2a4.2 4.2 0 1 1-3.5-4.1"/><path d="M14 4c.5 2.8 2.2 4.5 5 5"/></svg>',
  },
  whatsapp: {
    name: "WhatsApp",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L4 20l1.1-3.3A8.5 8.5 0 1 1 20 11.5Z"/><path d="M8.6 8.3c.2-.3.6-.3.8-.1l1 1.4c.2.3.2.6-.1.9l-.6.7a6.6 6.6 0 0 0 3 3l.7-.6c.3-.2.6-.3.9-.1l1.4 1c.3.2.3.6.1.8-.5.8-1.4 1.3-2.4 1.1-2.1-.4-4.7-3-5.1-5.1-.2-1 .3-1.9 1.1-2.4Z"/></svg>',
  },
};

function render() {
  $("#socials").innerHTML = Object.keys(NETWORKS)
    .filter((kind) => kind === "whatsapp" || state.settings[kind])
    .map((kind) => {
      const { name, icon } = NETWORKS[kind];
      const href = kind === "whatsapp" ? helloLink() : socialUrl(kind, state.settings[kind]);
      return `<a href="${esc(href)}" target="_blank" rel="noopener" aria-label="${name}" title="${name}">${icon}</a>`;
    })
    .join("");
  $("#footerWhatsapp").href = helloLink();
  $("#footerWhatsappNumber").textContent = formatPhone(state.settings.whatsapp);
  $("#footerCategories").innerHTML = navTree()
    .map((category) => `<a href="${esc(rutaCategoria(category.slug))}">${esc(category.name)}</a>`)
    .join("");
}

export function initSiteFooter() {
  $("#year").textContent = new Date().getFullYear();
  on("settings", render);
  on("site", render);
  on("products", render);
}
