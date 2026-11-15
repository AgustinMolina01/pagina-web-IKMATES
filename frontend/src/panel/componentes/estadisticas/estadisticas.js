import "./estadisticas.css";
import { $, esc } from "../../../compartido/elementos.js";
import { money } from "../../../compartido/formato.js";
import { get } from "../../../compartido/peticiones.js";
import { on } from "../../../compartido/eventos.js";

const pedidosTxt = (n) => `${n} ${n === 1 ? "pedido" : "pedidos"}`;
const tarjeta = (numero, texto) => `<div class="stat"><b>${numero}</b><span>${texto}</span></div>`;

/** Variación de este mes contra el anterior, en texto ("+20% que el mes pasado"). */
function variacion(actual, anterior) {
  if (!anterior.total) return actual.total ? "primer mes con ventas" : "sin ventas todavía";
  const pct = Math.round(((actual.total - anterior.total) / anterior.total) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% que el mes pasado`;
}

function dibujarMeses(meses) {
  const max = Math.max(...meses.map((m) => m.total), 1);
  $("#stMeses").innerHTML = meses.map((m) => {
    const alto = Math.round((m.total / max) * 100);
    const tip = `${m.nombre}: ${money(m.total)} · ${pedidosTxt(m.count)}`;
    return `<div class="est-mes${m.total ? "" : " vacio"}" role="listitem" tabindex="0" aria-label="${esc(tip)}">
      <span class="valor">${m.total ? money(m.total) : ""}</span>
      <span class="barra" style="height:${Math.max(alto, 1)}%"></span>
      <span class="est-tip">${esc(tip)}</span></div>`;
  }).join("");
  // Los nombres de los meses van debajo de la línea base, en su propia fila
  $("#stMesesNombres").innerHTML = meses.map((m) => `<span>${esc(m.nombre)}</span>`).join("");
}

/** Lista con barra horizontal: filas = [{ nombre, valor (para la barra), texto (lo que se lee), tip }]. */
function dibujarRanking(sel, filas, vacio) {
  if (!filas.length) { $(sel).innerHTML = `<p class="est-vacio">${vacio}</p>`; return; }
  const max = Math.max(...filas.map((f) => f.valor), 1);
  $(sel).innerHTML = filas.map((f) => `<div class="est-fila" tabindex="0" aria-label="${esc(f.tip)}">
      <span class="nombre" title="${esc(f.nombre)}">${esc(f.nombre)}</span>
      <span class="pista"><span class="barra" style="display:block;width:${Math.max(Math.round((f.valor / max) * 100), 1)}%"></span></span>
      <span class="valor">${esc(f.texto)}</span>
      <span class="est-tip">${esc(f.tip)}</span></div>`).join("");
}

const porPedidos = (lista) => lista.map((x) => ({
  nombre: x.name, valor: x.count, texto: pedidosTxt(x.count), tip: `${x.name}: ${pedidosTxt(x.count)} · ${money(x.total)}`,
}));

async function cargar() {
  const e = await get("/api/admin/stats");
  const r = e.resumen;
  $("#stResumen").innerHTML =
    tarjeta(money(r.mesActual.total), `vendido este mes (${pedidosTxt(r.mesActual.count)}) · ${variacion(r.mesActual, r.mesAnterior)}`) +
    tarjeta(money(r.total), `vendido en total (${pedidosTxt(r.pedidos)})`) +
    tarjeta(money(r.ticketPromedio), "gasto promedio por pedido") +
    tarjeta(r.cancelados, r.cancelados === 1 ? "pedido cancelado" : "pedidos cancelados");

  dibujarMeses(e.porMes);
  dibujarRanking("#stProductos", e.masVendidos.map((p) => ({
    nombre: p.name, valor: p.qty, texto: `${p.qty} u.`, tip: `${p.name}: ${p.qty} ${p.qty === 1 ? "unidad" : "unidades"} · ${money(p.total)}`,
  })), "Todavía no hay ventas registradas.");
  dibujarRanking("#stPagos", porPedidos(e.pagos), "Sin datos todavía.");
  dibujarRanking("#stEntregas", porPedidos(e.entregas), "Sin datos todavía.");
  dibujarRanking("#stProvincias", porPedidos(e.provincias), "Todavía no hay envíos con provincia (se activa con un envío \"según provincia\").");
  dibujarRanking("#stCupones", e.cupones.map((c) => ({
    nombre: c.code, valor: c.count, texto: `${c.count} ${c.count === 1 ? "uso" : "usos"}`, tip: `${c.code}: ${pedidosTxt(c.count)} · descontó ${money(c.discount)}`,
  })), "Todavía no se usaron cupones.");
}

export function iniciarEstadisticas() {
  on("pestana", (nombre) => { if (nombre === "estadisticas") cargar().catch(() => {}); });
}
