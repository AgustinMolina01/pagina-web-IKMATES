// API pública: lo que usa la tienda sin iniciar sesión.
const { Router } = require("express");
const { all } = require("../base-de-datos/conexion");
const { LIMITS } = require("../configuracion");
const { today } = require("../utilidades/validacion");
const { createLimiter } = require("../utilidades/limitador");
const { getCustomer } = require("../intermedios/autenticacion");
const { listProducts } = require("../servicios/productos.servicio");
const { getSettings } = require("../servicios/ajustes.servicio");
const { publicCategories } = require("../servicios/categorias.servicio");
const { listShipping, listPayments, buildOrder, saveOrder } = require("../servicios/compras.servicio");
const { createWithdrawal } = require("../servicios/arrepentimiento.servicio");

const router = Router();
const orderLimiter = createLimiter({ max: LIMITS.ordersPerHour, windowMs: 60 * 60 * 1000 }); // pedidos por hora y por conexión

router.get("/products", (req, res) => res.json(listProducts({ onlyActive: true })));
// Los textos legales son largos y se leen en /privacidad y /terminos: no viajan con cada carga de la tienda
function publicSettings() {
  const { privacyText, termsText, ...resto } = getSettings(); // (faqText sí viaja: se muestra en el inicio)
  return resto;
}
router.get("/settings", (req, res) => res.json(publicSettings()));

// Todo lo que necesita la portada en una sola llamada
router.get("/site", (req, res) => {
  const t = today();
  res.json({
    categories: publicCategories(),
    announcements: all("SELECT text FROM announcements WHERE active=1 ORDER BY id").map((r) => r.text),
    banners: all(
      `SELECT id,image,title,link FROM banners WHERE active=1
       AND (COALESCE(start_date,'')='' OR start_date<=?) AND (COALESCE(end_date,'')='' OR end_date>=?) ORDER BY id DESC`, [t, t]),
    settings: publicSettings(),
    shipping: listShipping({ onlyActive: true }),
    payments: listPayments({ onlyActive: true }),
  });
});

// Cotización: el carrito muestra totales calculados por el servidor (mismas reglas que el pedido real)
router.post("/quote", (req, res) => {
  const order = buildOrder(req.body, { strict: !!req.body.strict });
  if (order.error) return res.status(400).json({ error: order.error });
  res.json(order);
});

// Botón de arrepentimiento: el cliente pide cancelar una compra y recibe un código
const withdrawalLimiter = createLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
router.post("/arrepentimiento", (req, res) => {
  if (!withdrawalLimiter.consume(req.ip)) return res.status(429).json({ error: "Demasiadas solicitudes seguidas. Probá en un rato o escribinos por WhatsApp." });
  const r = createWithdrawal(req.body || {});
  if (r.error) return res.status(400).json({ error: r.error });
  res.json(r);
});

router.post("/orders", (req, res) => {
  if (!orderLimiter.consume(req.ip)) return res.status(429).json({ error: "Demasiados pedidos seguidos. Probá en un rato." });
  const order = buildOrder(req.body);
  if (order.error) return res.status(400).json({ error: order.error });
  const customer = getCustomer(req);
  res.json({ id: saveOrder(order, customer && customer.id), ...order });
});

module.exports = router;
