// Arma la aplicación Express (sin encenderla, para poder probarla).
const path = require("path");
const express = require("express");
const { PUBLIC_DIR, UPLOAD_DIR } = require("./configuracion");
const publicRoutes = require("./rutas/tienda.rutas");
const accountRoutes = require("./rutas/cuenta.rutas");
const seoRoutes = require("./rutas/posicionamiento.rutas");
const adminRoutes =require("./rutas/panel/index");

function createApp() {
  const app = express();
  app.set("trust proxy", 1); // detrás de Render/Railway: IP y HTTPS reales
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));

  // Cabeceras de seguridad básicas
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use("/uploads", express.static(UPLOAD_DIR));
  app.use("/api/account", accountRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", publicRoutes);
  app.use("/api", (req, res) => res.status(404).json({ error: "No existe" })); // ninguna /api/... cae en los archivos

  // Sitio (frontend) y panel
  app.use(seoRoutes); // antes de los archivos: "/" y /producto/:id llevan sus propias etiquetas
  app.use(express.static(PUBLIC_DIR));
  app.get("/admin", (req, res) => {
    res.setHeader("X-Robots-Tag", "noindex");
    res.sendFile(path.join(PUBLIC_DIR, "panel.html"));
  });

  // Error inesperado: nunca mostrar detalles internos al navegador
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Ocurrió un error inesperado" });
  });
  return app;
}

module.exports = { createApp };
