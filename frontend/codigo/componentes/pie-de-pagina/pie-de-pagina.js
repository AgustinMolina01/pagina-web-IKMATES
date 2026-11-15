import "./pie-de-pagina.css";
import { $, esc } from "../../compartido/elementos.js";
import { socialUrl } from "../../compartido/formato.js";
import { state, on } from "../../servicios/estado.js";

const NETWORKS = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

function render() {
  $("#socials").innerHTML = Object.keys(NETWORKS)
    .filter((kind) => state.settings[kind])
    .map((kind) => `<a href="${esc(socialUrl(kind, state.settings[kind]))}" target="_blank" rel="noopener">${NETWORKS[kind]}</a>`)
    .join("");
}

export function initSiteFooter() {
  $("#year").textContent = new Date().getFullYear();
  on("settings", render);
}
