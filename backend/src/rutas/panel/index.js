// Todas las rutas del panel bajo /api/admin. Solo login y logout son públicas.
const { Router } = require("express");
const { requireAdmin } = require("../../intermedios/autenticacion");
const auth = require("./ingreso.rutas");
const products = require("./productos.rutas");
const categories = require("./categorias.rutas");
const content = require("./contenido.rutas");
const checkout = require("./envios-y-pagos.rutas");
const orders = require("./pedidos.rutas");
const customers = require("./clientes.rutas");
const system = require("./sistema.rutas");
const coupons = require("./cupones.rutas");
const withdrawals = require("./arrepentimientos.rutas");
const stats = require("./estadisticas.rutas");

const router = Router();

router.use(auth.open);          // /login, /logout
router.use(requireAdmin);       // desde acá hace falta sesión
router.use(auth.protectedRoutes); // /me, /password

router.use("/products", products);
router.use("/categories", categories);
router.use("/banners", content.banners);
router.use("/announcements", content.announcements);
router.use("/shipping", checkout.shipping);
router.use("/payments", checkout.payments);
router.use("/orders", orders);
router.use("/customers", customers);
router.use("/coupons", coupons);
router.use("/withdrawals", withdrawals);
router.use("/stats", stats);
router.use("/", system);        // /settings, /upload, /backup

module.exports = router;
