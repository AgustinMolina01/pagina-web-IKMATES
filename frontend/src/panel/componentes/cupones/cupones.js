import { $, esc } from "../../../compartido/elementos.js";
import { money } from "../../../compartido/formato.js";
import { get, post, put, del } from "../../../compartido/peticiones.js";
import { on } from "../../../compartido/eventos.js";

let cupones = [];

const decir = (m) => { $("#cpErr").textContent = m; };
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fecha = (s) => s.split("-").reverse().join("/");

/** Estado del cupón para mostrar: activo, vencido, agotado u oculto. */
function estado(c) {
  if (!c.active) return `<span class="pill off">Pausado</span>`;
  if (c.expires && c.expires < hoy()) return `<span class="pill off">Vencido el ${fecha(c.expires)}</span>`;
  if (c.maxUses != null && c.uses >= c.maxUses) return `<span class="pill off">Agotado</span>`;
  return `<span class="pill green">Activo${c.expires ? " hasta " + fecha(c.expires) : ""}</span>`;
}

async function cargar() {
  cupones = await get("/api/admin/coupons");
  $("#cpList").innerHTML = cupones.length
    ? cupones.map((c) => `<div style="display:flex;gap:8px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line);flex-wrap:wrap" class="acts">
        <span style="flex:1;min-width:220px">
          <strong style="font-size:1.05rem;letter-spacing:.04em">${esc(c.code)}</strong>
          <span class="pill">${c.kind === "amount" ? money(c.value) + " de descuento" : c.value + "% OFF"}</span> ${estado(c)}<br>
          <small style="color:var(--muted)">Usado ${c.uses} ${c.uses === 1 ? "vez" : "veces"}${c.maxUses != null ? ` de ${c.maxUses}` : ""}${c.minTotal ? ` · compra mínima ${money(c.minTotal)}` : ""}</small>
        </span>
        <button data-cpcopy="${c.id}">Copiar</button><button data-cpedit="${c.id}">Editar</button><button class="del" data-cpdel="${c.id}">Eliminar</button></div>`).join("")
    : `<p class="hint" style="margin-top:10px">Todavía no hay cupones.</p>`;
}

function limpiar() {
  $("#cpForm").reset();
  $("#cpId").value = "";
  $("#cpActive").checked = true;
  $("#cpCancel").classList.add("hidden");
  etiquetaValor();
  decir("");
}
const etiquetaValor = () => { $("#cpValueLabel").textContent = $("#cpKind").value === "amount" ? "Descuento ($) *" : "Descuento (%) *"; };

export function iniciarCupones() {
  on("pestana", (nombre) => { if (nombre === "cupones") cargar(); });
  $("#cpKind").onchange = etiquetaValor;
  $("#cpCancel").onclick = limpiar;

  $("#cpForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = $("#cpId").value;
    const cuerpo = {
      code: $("#cpCode").value, kind: $("#cpKind").value, value: $("#cpValue").value, minTotal: $("#cpMin").value,
      expires: $("#cpExpires").value, maxUses: $("#cpMax").value, active: $("#cpActive").checked,
    };
    try { await (id ? put(`/api/admin/coupons/${id}`, cuerpo) : post("/api/admin/coupons", cuerpo)); limpiar(); cargar(); }
    catch (err) { decir(err.message); }
  };

  $("#cpList").onclick = async (e) => {
    const d = e.target.dataset, c = cupones.find((x) => x.id == (d.cpcopy || d.cpedit || d.cpdel));
    if (!c) return;
    if (d.cpcopy) {
      try { await navigator.clipboard.writeText(c.code); e.target.textContent = "¡Copiado!"; } catch { prompt("Copiá el código:", c.code); }
      return;
    }
    if (d.cpedit) {
      $("#cpId").value = c.id; $("#cpCode").value = c.code; $("#cpKind").value = c.kind; $("#cpValue").value = c.value;
      $("#cpMin").value = c.minTotal ?? ""; $("#cpExpires").value = c.expires; $("#cpMax").value = c.maxUses ?? ""; $("#cpActive").checked = c.active;
      etiquetaValor();
      $("#cpCancel").classList.remove("hidden");
      $("#cpForm").scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (d.cpdel && confirm(`¿Eliminar el cupón ${c.code}? Los pedidos que ya lo usaron no cambian.`)) { await del(`/api/admin/coupons/${c.id}`); cargar(); }
  };
}
