import { $, esc } from "../../../compartido/elementos.js";
import { shippingPriceLabel } from "../../../compartido/formato.js";
import { get, post, put, del } from "../../../compartido/peticiones.js";
import { on } from "../../../compartido/eventos.js";
import { PROVINCIAS } from "../../../compartido/provincias.js";

let entregas = [], pagos = [];

const decir = (sel, m) => { $(sel).textContent = m; };

// ---------- Entregas ----------
async function cargarEntregas() {
  entregas = await get("/api/admin/shipping");
  $("#shList").innerHTML = entregas.length
    ? entregas.map((m, i) => `<div style="display:flex;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);flex-wrap:wrap" class="acts">
        <span style="flex:1;min-width:200px;${m.active ? "" : "opacity:.5"}"><strong>${esc(m.name)}</strong> <span class="pill">${esc(shippingPriceLabel(m))}</span>${m.needsAddress ? ` <span class="pill">pide dirección</span>` : ""}${m.active ? "" : ` <span class="pill off">Oculta</span>`}${m.description ? `<br><small style="color:var(--muted)">${esc(m.description)}</small>` : ""}</span>
        <button data-shup="${m.id}" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button><button data-shdown="${m.id}" ${i === entregas.length - 1 ? "disabled" : ""} aria-label="Bajar">↓</button>
        <button data-shedit="${m.id}">Editar</button><button class="del" data-shdel="${m.id}">Eliminar</button></div>`).join("")
    : `<p class="hint" style="margin-top:10px">Sin formas de entrega: el cliente no tendrá que elegir cómo recibir el pedido.</p>`;
}
const limpiarEntrega = () => { $("#shForm").reset(); $("#shId").value = ""; $("#shActive").checked = true; $("#shCancel").classList.add("hidden"); decir("#shErr", ""); dibujarProvincias({}); verProvincias(); };

// ---------- Costo por provincia ----------
function dibujarProvincias(precios) {
  $("#shProvGrid").innerHTML = PROVINCIAS.map((p) => `<label style="display:flex;align-items:center;gap:8px;margin:0;font-weight:500;font-size:.85rem">
    <span style="flex:1">${esc(p)}</span>
    <input type="number" min="0" step="1" data-prov="${esc(p)}" value="${precios[p] ?? ""}" placeholder="a coordinar" style="width:110px;margin:0;padding:6px 8px"></label>`).join("");
}
const verProvincias = () => {
  const on = $("#shByProv").checked;
  $("#shProvBox").classList.toggle("hidden", !on);
  $("#shPrice").disabled = on; // con provincias, el costo único no se usa
};
/** Lo que cargó en la grilla: { provincia: costo o null (a coordinar) }. */
const preciosCargados = () => Object.fromEntries([...document.querySelectorAll("#shProvGrid [data-prov]")].map((i) => [i.dataset.prov, i.value === "" ? null : Number(i.value)]));

// ---------- Pagos ----------
async function cargarPagos() {
  pagos = await get("/api/admin/payments");
  $("#pyList").innerHTML = pagos.length
    ? pagos.map((p, i) => `<div style="display:flex;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);flex-wrap:wrap" class="acts">
        <span style="flex:1;min-width:200px;${p.active ? "" : "opacity:.5"}"><strong>${esc(p.name)}</strong>${p.discount ? ` <span class="pill green">${p.discount}% OFF</span>` : ""}${p.active ? "" : ` <span class="pill off">Oculta</span>`}${p.description ? `<br><small style="color:var(--muted)">${esc(p.description)}</small>` : ""}</span>
        <button data-pyup="${p.id}" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button><button data-pydown="${p.id}" ${i === pagos.length - 1 ? "disabled" : ""} aria-label="Bajar">↓</button>
        <button data-pyedit="${p.id}">Editar</button><button class="del" data-pydel="${p.id}">Eliminar</button></div>`).join("")
    : `<p class="hint" style="margin-top:10px">Sin formas de pago: el cliente no tendrá que elegir cómo pagar.</p>`;
}
const limpiarPago = () => { $("#pyForm").reset(); $("#pyId").value = ""; $("#pyActive").checked = true; $("#pyCancel").classList.add("hidden"); decir("#pyErr", ""); };

export function iniciarEnviosYPagos() {
  on("pestana", (nombre) => { if (nombre === "envios") { cargarEntregas(); cargarPagos(); } });
  dibujarProvincias({});
  $("#shByProv").onchange = () => { verProvincias(); if ($("#shByProv").checked) $("#shAddress").checked = true; };
  $("#shProvFillBtn").onclick = () => {
    const v = $("#shProvFill").value;
    if (v === "") return;
    document.querySelectorAll("#shProvGrid [data-prov]").forEach((i) => { if (i.value === "") i.value = v; });
  };

  $("#shForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = $("#shId").value;
    const porProvincia = $("#shByProv").checked;
    const cuerpo = {
      name: $("#shName").value, description: $("#shDesc").value, price: porProvincia ? "" : $("#shPrice").value, freeFrom: $("#shFree").value,
      needsAddress: $("#shAddress").checked, active: $("#shActive").checked, provincePrices: porProvincia ? preciosCargados() : {},
    };
    try { await (id ? put(`/api/admin/shipping/${id}`, cuerpo) : post("/api/admin/shipping", cuerpo)); limpiarEntrega(); cargarEntregas(); }
    catch (err) { decir("#shErr", err.message); }
  };
  $("#shCancel").onclick = limpiarEntrega;
  $("#shList").onclick = async (e) => {
    const d = e.target.dataset, id = d.shup || d.shdown || d.shedit || d.shdel, m = entregas.find((x) => x.id == id);
    if (!m) return;
    try {
      if (d.shup || d.shdown) { await post(`/api/admin/shipping/${m.id}/move`, { dir: d.shup ? -1 : 1 }); cargarEntregas(); }
      if (d.shedit) {
        $("#shId").value = m.id; $("#shName").value = m.name; $("#shDesc").value = m.description; $("#shPrice").value = m.price ?? ""; $("#shFree").value = m.freeFrom ?? "";
        $("#shAddress").checked = m.needsAddress; $("#shActive").checked = m.active; $("#shCancel").classList.remove("hidden");
        $("#shByProv").checked = m.byProvince; dibujarProvincias(m.provincePrices || {}); verProvincias();
        $("#shForm").scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (d.shdel && confirm(`¿Eliminar "${m.name}"?`)) { await del(`/api/admin/shipping/${m.id}`); cargarEntregas(); }
    } catch (err) { decir("#shErr", err.message); }
  };

  $("#pyForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = $("#pyId").value;
    const cuerpo = { name: $("#pyName").value, description: $("#pyDesc").value, discount: $("#pyDiscount").value, active: $("#pyActive").checked };
    try { await (id ? put(`/api/admin/payments/${id}`, cuerpo) : post("/api/admin/payments", cuerpo)); limpiarPago(); cargarPagos(); }
    catch (err) { decir("#pyErr", err.message); }
  };
  $("#pyCancel").onclick = limpiarPago;
  $("#pyList").onclick = async (e) => {
    const d = e.target.dataset, id = d.pyup || d.pydown || d.pyedit || d.pydel, p = pagos.find((x) => x.id == id);
    if (!p) return;
    try {
      if (d.pyup || d.pydown) { await post(`/api/admin/payments/${p.id}/move`, { dir: d.pyup ? -1 : 1 }); cargarPagos(); }
      if (d.pyedit) {
        $("#pyId").value = p.id; $("#pyName").value = p.name; $("#pyDesc").value = p.description; $("#pyDiscount").value = p.discount || "";
        $("#pyActive").checked = p.active; $("#pyCancel").classList.remove("hidden");
        $("#pyForm").scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (d.pydel && confirm(`¿Eliminar "${p.name}"?`)) { await del(`/api/admin/payments/${p.id}`); cargarPagos(); }
    } catch (err) { decir("#pyErr", err.message); }
  };
}
