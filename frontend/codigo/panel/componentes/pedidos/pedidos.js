import "./pedidos.css";
import { $, esc } from "../../../compartido/elementos.js";
import { money, formatDateTime } from "../../../compartido/formato.js";
import { get, put, del } from "../../../compartido/peticiones.js";
import { on } from "../../../compartido/eventos.js";

const ESTADOS = { nuevo: "Nuevo", atendido: "Atendido", cancelado: "Cancelado" };

/** Detalle de pago y entrega que eligió el cliente. */
function datosDelPedido(o) {
  const d = o.details || {}, filas = [];
  if (d.payment) filas.push(`💳 ${esc(d.payment.name)}${d.discount > 0 ? ` (${d.payment.discountPct}% off: −${money(d.discount)})` : ""}`);
  if (d.coupon) filas.push(`🏷️ Cupón ${esc(d.coupon.code)}: −${money(d.coupon.discount)}`);
  if (d.shipping) {
    const costo = d.shipping.pending ? "a coordinar" : d.shipping.free ? "gratis" : money(d.shipping.cost);
    filas.push(`🚚 ${esc(d.shipping.name)}${d.shipping.province ? " a " + esc(d.shipping.province) : ""} (${costo})${d.shipping.address ? " — " + esc(d.shipping.address) : ""}`);
  }
  return filas.length ? `<div class="ord-datos">${filas.map((f) => `<span>${f}</span>`).join("")}</div>` : "";
}

export async function cargarPedidos() {
  const r = await get("/api/admin/orders");
  const nuevos = r.orders.filter((o) => o.status === "nuevo").length;
  $("#ordBadge").textContent = nuevos;
  $("#ordBadge").classList.toggle("hidden", nuevos === 0);
  $("#ordStats").innerHTML = `<div class="stat"><b>${r.count}</b><span>pedidos (sin los cancelados)</span></div><div class="stat"><b>${money(r.total)}</b><span>suma de los pedidos</span></div><div class="stat"><b>${nuevos}</b><span>nuevos sin atender</span></div>`;
  $("#ordList").innerHTML = r.orders.length
    ? r.orders.map((o) => `<div class="ord ${o.status}">
        <div class="ord-h"><div><b>Pedido #${o.id}</b> · <small>${esc(formatDateTime(o.created_at))}</small></div><div><b>${money(o.total)}</b></div></div>
        ${o.customer ? `<div class="hint" style="margin:0">👤 ${esc(o.customer.name)} · ${esc(o.customer.email)}${o.customer.phone ? " · " + esc(o.customer.phone) : ""}</div>` : ""}
        <ul>${o.items.map((i) => `<li>${i.qty} × ${esc(i.name)}${i.options && i.options.length ? ` (${esc(i.options.join(", "))})` : ""} — ${money(i.subtotal)}${i.wholesale ? " (mayorista)" : ""}</li>`).join("")}</ul>
        ${datosDelPedido(o)}
        <div class="acts"><select data-ost="${o.id}" style="width:auto;margin:0;padding:6px 10px">${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${k === o.status ? "selected" : ""}>${v}</option>`).join("")}</select>
        <button class="del" data-odel="${o.id}">Eliminar</button></div></div>`).join("")
    : `<p class="hint">Todavía no hay pedidos.</p>`;
}

// ---------- Botón de arrepentimiento ----------
let solicitudes = [];
async function cargarArrepentimientos() {
  solicitudes = await get("/api/admin/withdrawals");
  const nuevas = solicitudes.filter((s) => s.status === "nueva").length;
  $("#arrBadge").textContent = nuevas ? `${nuevas} sin resolver` : "";
  $("#arrBadge").classList.toggle("hidden", !nuevas);
  $("#arrList").innerHTML = solicitudes.length
    ? solicitudes.map((s) => `<div class="ord ${s.status === "resuelta" ? "atendido" : "cancelado"}">
        <div class="ord-h"><div><b>${esc(s.code)}</b> · <small>${esc(formatDateTime(s.created_at))}</small></div><div><span class="pill ${s.status === "resuelta" ? "green" : "off"}">${s.status === "resuelta" ? "Resuelta" : "Nueva"}</span></div></div>
        <div>👤 <b>${esc(s.name)}</b> · ${esc(s.contact)}${s.orderRef ? ` · Pedido: ${esc(s.orderRef)}` : ""}</div>
        ${s.reason ? `<div class="hint" style="margin:6px 0 0">${esc(s.reason)}</div>` : ""}
        <div class="acts" style="margin-top:8px"><button data-arrok="${s.id}">${s.status === "resuelta" ? "Marcar como nueva" : "Marcar como resuelta"}</button><button class="del" data-arrdel="${s.id}">Eliminar</button></div></div>`).join("")
    : `<p class="hint">No hay solicitudes. Acá aparecen los clientes que usen el "Botón de arrepentimiento" del pie de la tienda.</p>`;
}

export function iniciarPedidos() {
  on("pestana", (nombre) => { if (nombre === "pedidos") { cargarPedidos(); cargarArrepentimientos(); } });
  on("sesion-lista", () => { cargarPedidos().catch(() => {}); cargarArrepentimientos().catch(() => {}); });

  $("#arrList").onclick = async (e) => {
    const d = e.target.dataset, s = solicitudes.find((x) => x.id == (d.arrok || d.arrdel));
    if (!s) return;
    if (d.arrok) await put(`/api/admin/withdrawals/${s.id}`, { status: s.status === "resuelta" ? "nueva" : "resuelta" });
    if (d.arrdel) { if (!confirm(`¿Eliminar la solicitud ${s.code}?`)) return; await del(`/api/admin/withdrawals/${s.id}`); }
    cargarArrepentimientos();
  };

  $("#ordRefresh").onclick = () => { cargarPedidos(); cargarArrepentimientos(); };
  $("#ordList").onchange = async (e) => {
    if (e.target.dataset.ost) { await put(`/api/admin/orders/${e.target.dataset.ost}`, { status: e.target.value }); cargarPedidos(); }
  };
  $("#ordList").onclick = async (e) => {
    const id = e.target.dataset.odel;
    if (id && confirm("¿Eliminar este pedido del registro? Si no estaba cancelado, se devuelve el stock.")) { await del(`/api/admin/orders/${id}`); cargarPedidos(); }
  };
}
