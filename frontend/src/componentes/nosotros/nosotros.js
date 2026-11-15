import "./nosotros.css";
import { $, esc } from "../../compartido/elementos.js";
import { state, on } from "../../servicios/estado.js";

// "Quiénes somos": título, párrafos (separados por una línea en blanco) y valores ("Título: texto", uno por línea).
// Si todavía no llegaron los ajustes, queda el texto que trae el HTML.
function render() {
  const s = state.settings;
  if (s.aboutTitle) $("#aboutTitle").textContent = s.aboutTitle;
  if (s.aboutText) {
    $("#aboutText").innerHTML = String(s.aboutText).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  }
  if (s.aboutValues !== undefined) {
    const values = String(s.aboutValues).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const i = l.indexOf(":");
      return i > 0 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { title: l, text: "" };
    });
    $("#aboutValues").innerHTML = values.map((v) => `<li><strong>${esc(v.title)}</strong>${v.text ? `<span>${esc(v.text)}</span>` : ""}</li>`).join("");
    $("#aboutValues").hidden = !values.length;
  }
}

export function initAbout() {
  on("settings", render);
}
