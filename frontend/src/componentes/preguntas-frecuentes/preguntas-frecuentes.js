import "./preguntas-frecuentes.css";
import { $, esc } from "../../compartido/elementos.js";
import { toLines, shippingPriceLabel } from "../../compartido/formato.js";
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

function agregarDetalles(preguntas, coincidencia, titulo, prefijo, detalles) {
  const pregunta = preguntas.find((p) => coincidencia.test(p.q));
  const respuesta = pregunta ? pregunta.a.join(" ").toLowerCase() : "";
  const faltantes = detalles.filter((detalle) => !respuesta.includes(detalle.toLowerCase()));
  if (!faltantes.length) return;

  const texto = prefijo ? `${prefijo}${faltantes.join(" · ")}.` : faltantes.join(" · ");
  if (pregunta) pregunta.a.push(texto);
  else preguntas.push({ q: titulo, a: [texto] });
}

function render() {
  const preguntas = parseFaq(state.settings.faqText);
  const s = state.settings;

  if (!preguntas.some((p) => /pedido|compr/i.test(p.q))) {
    preguntas.unshift({
      q: "¿Cómo hago un pedido?",
      a: [
        "Elegí tus productos y sumalos al carrito.",
        "Enviá tu pedido por WhatsApp desde el carrito.",
        "Coordinamos la disponibilidad, el pago y la entrega con vos.",
      ],
    });
  }

  const pagos = [
    ...state.payments.map((p) => (p.discount ? `${p.name} — ${p.discount}% de descuento` : p.name)),
    ...toLines(s.payments),
  ];
  const envios = [
    ...state.shipping.map((m) => `${m.name} — ${shippingPriceLabel(m)}`),
    ...toLines(s.shipping),
  ];

  agregarDetalles(preguntas, /pag|abon|tarjeta|efectivo|transferenc/i, "¿Qué formas de pago aceptan?", "Formas de pago disponibles: ", pagos);
  agregarDetalles(preguntas, /env[ií]o|entrega|recib|retiro|correo/i, "¿Cómo recibo mi pedido?", "Opciones de entrega y costos: ", envios);
  if (s.wholesaleNote) {
    agregarDetalles(preguntas, /mayor|mayorista/i, "¿Venden por mayor?", "", [s.wholesaleNote.trim()]);
  }

  $("#preguntas").hidden = !preguntas.length;
  $("#faqList").innerHTML = preguntas.map((p) =>
    `<details><summary>${esc(p.q)}</summary><div class="faq-a">${p.a.map((t) => `<p>${esc(t)}</p>`).join("")}</div></details>`).join("");
}

export function initFaq() {
  on("settings", render);
  on("site", render);
}
