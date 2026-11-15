import { $, esc } from "../../../compartido/elementos.js";
import { money } from "../../../compartido/formato.js";
import { post } from "../../../compartido/peticiones.js";
import { on, emit } from "../../../compartido/eventos.js";
import { cargarProductos, opcionesCategorias } from "../../servicios/datos.js";

let plan = null;      // resultado de la vista previa
let tildados = () => []; // lo registra la lista de productos (evita que los componentes se importen en círculo)

export const registrarSeleccion = (fn) => { tildados = fn; };

const decir = (m) => { $("#prErr").textContent = m; };
const ocultarResultado = () => { $("#prPreview").innerHTML = ""; $("#prApplyBtn").classList.add("hidden"); plan = null; };

function sincronizar() {
  $("#prCatBox").classList.toggle("hidden", $("#prScope").value !== "category");
  $("#prValLabel").textContent = $("#prMode").value === "percent" ? "Porcentaje (ej: 10 sube 10%, -5 baja 5%)" : "Monto en $ (ej: 500 suma $500, -300 resta $300)";
  $("#prWholeBox").classList.toggle("hidden", $("#prMode").value !== "percent");
}

export function abrirPrecios() {
  emit("abrir-panel", "precios");
  $("#pricePanel").classList.remove("hidden");
  ocultarResultado();
  decir("");
  const hay = tildados().length > 0;
  if (hay) $("#prScope").value = "selected"; else if ($("#prScope").value === "selected") $("#prScope").value = "all";
  sincronizar();
  $("#pricePanel").scrollIntoView({ behavior: "smooth" });
}

const cuerpo = (soloVista) => {
  const alcance = $("#prScope").value;
  return {
    scope: alcance === "selected" ? "ids" : alcance, ids: tildados(), category: $("#prCat").value, mode: $("#prMode").value,
    value: Number($("#prValue").value), round: Number($("#prRound").value), includeWholesale: $("#prWhole").checked, dryRun: soloVista,
  };
};

export function iniciarCambioPrecios() {
  on("categorias", () => { const v = $("#prCat").value; $("#prCat").innerHTML = opcionesCategorias(); if (v) $("#prCat").value = v; });
  on("abrir-panel", (nombre) => { if (nombre !== "precios") $("#pricePanel").classList.add("hidden"); });

  ["#prScope", "#prMode"].forEach((s) => $(s).addEventListener("input", () => { sincronizar(); ocultarResultado(); }));
  $("#prClose").onclick = () => $("#pricePanel").classList.add("hidden");

  $("#prPreviewBtn").onclick = async () => {
    decir("");
    try {
      plan = await post("/api/admin/products/bulk-price", cuerpo(true));
      $("#prPreview").innerHTML = plan.count
        ? `<div class="preview"><b>${plan.count} producto${plan.count === 1 ? "" : "s"} van a cambiar.</b> Ejemplos:<table>${plan.sample.map((s) => `<tr><td>${esc(s.name)}</td><td>${money(s.from)} → <b>${money(s.to)}</b></td></tr>`).join("")}</table></div>`
        : `<div class="preview">Ningún producto cambiaría con esos valores.</div>`;
      $("#prApplyBtn").classList.toggle("hidden", !plan.count);
    } catch (err) { decir(err.message); }
  };

  $("#prApplyBtn").onclick = async () => {
    if (!plan || !confirm(`¿Cambiar el precio de ${plan.count} producto(s)?`)) return;
    try {
      const r = await post("/api/admin/products/bulk-price", cuerpo(false));
      $("#prPreview").innerHTML = `<div class="preview okmsg">Listo: se actualizaron ${r.count} precios.</div>`;
      $("#prApplyBtn").classList.add("hidden");
      plan = null;
      await cargarProductos();
    } catch (err) { decir(err.message); }
  };
}
