// Estadísticas de ventas para el panel: ventas por mes, productos más vendidos, formas de pago y entrega, cupones.
// Se calculan con los pedidos registrados (los cancelados no cuentan).
const { Router } = require("express");
const { all } = require("../../base-de-datos/conexion");
const { orderRow } = require("../../servicios/compras.servicio");

const router = Router();
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Los últimos `n` meses como "AAAA-MM", del más viejo al actual. */
function ultimosMeses(n) {
  const d = new Date(), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Suma por clave: { clave: { count, total } } → lista ordenada de mayor a menor. */
function ranking(map, by = "count") {
  return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b[by] - a[by]);
}
const sumar = (map, key, total) => {
  const v = map.get(key) || { count: 0, total: 0 };
  v.count += 1; v.total += total;
  map.set(key, v);
};

router.get("/", (req, res) => {
  const pedidos = all("SELECT * FROM orders ORDER BY id").map(orderRow);
  const validos = pedidos.filter((o) => o.status !== "cancelado");

  const meses = ultimosMeses(6);
  const porMes = new Map(meses.map((m) => [m, { count: 0, total: 0 }]));
  const productos = new Map(), pagos = new Map(), entregas = new Map(), provincias = new Map(), cupones = new Map();

  for (const o of validos) {
    const mes = String(o.created_at).slice(0, 7);
    if (porMes.has(mes)) { const v = porMes.get(mes); v.count += 1; v.total += o.total; }
    for (const l of o.items) {
      const p = productos.get(l.id) || { name: l.name, qty: 0, total: 0 };
      p.name = l.name; p.qty += l.qty; p.total += l.subtotal;
      productos.set(l.id, p);
    }
    const d = o.details || {};
    if (d.payment) sumar(pagos, d.payment.name, o.total);
    if (d.shipping) sumar(entregas, d.shipping.name, o.total);
    if (d.shipping && d.shipping.province) sumar(provincias, d.shipping.province, o.total);
    if (d.coupon) {
      const c = cupones.get(d.coupon.code) || { count: 0, total: 0, discount: 0 };
      c.count += 1; c.total += o.total; c.discount += d.coupon.discount || 0;
      cupones.set(d.coupon.code, c);
    }
  }

  const total = validos.reduce((n, o) => n + o.total, 0);
  const actual = porMes.get(meses[meses.length - 1]), anterior = porMes.get(meses[meses.length - 2]);
  res.json({
    resumen: {
      pedidos: validos.length, total, ticketPromedio: validos.length ? Math.round(total / validos.length) : 0,
      cancelados: pedidos.length - validos.length, mesActual: actual, mesAnterior: anterior,
    },
    porMes: meses.map((m) => ({ mes: m, nombre: `${MESES[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`, ...porMes.get(m) })),
    masVendidos: [...productos.values()].sort((a, b) => b.qty - a.qty || b.total - a.total).slice(0, 10),
    pagos: ranking(pagos), entregas: ranking(entregas), provincias: ranking(provincias).slice(0, 10),
    cupones: [...cupones.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.count - a.count),
  });
});

module.exports = router;
