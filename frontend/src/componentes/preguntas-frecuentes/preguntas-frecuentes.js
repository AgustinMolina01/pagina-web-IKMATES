import "./preguntas-frecuentes.css";
import { $, esc } from "../../compartido/elementos.js";
import { state, on } from "../../servicios/estado.js";

/** "## Pregunta\nRespuesta…" → [{ q, a: [párrafos] }]. Las líneas en blanco separan párrafos. */
export function parseFaq(texto) {
  const out = [];
  let actual = null, parrafo = [];
  const cerrar = () => { if (actual && parrafo.length) actual.a.push(parrafo.join(" ")); parrafo = []; };
  for (const linea of String(texto || "").split(/\r?\n/)) {
    const l = linea.trim();
    if (l.startsWith("## ")) { cerrar(); actual = { q: l.slice(3).trim(), a: [] }; out.push(actual); }
    else if (!l) cerrar();
    else if (actual) parrafo.push(l);
  }
  cerrar();
  return out.filter((x) => x.q);
}

function render() {
  const preguntas = parseFaq(state.settings.faqText);
  $("#preguntas").hidden = !preguntas.length;
  $("#faqList").innerHTML = preguntas.map((p) =>
    `<details><summary>${esc(p.q)}</summary><div class="faq-a">${p.a.map((t) => `<p>${esc(t)}</p>`).join("")}</div></details>`).join("");
}

export function initFaq() {
  on("settings", render);
}
