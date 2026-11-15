// Ajustes del negocio, subida de fotos y respaldo.
const fs = require("fs");
const path = require("path");
const { Router } = require("express");
const { persist } = require("../../base-de-datos/conexion");
const { DB_FILE, UPLOAD_DIR } = require("../../configuracion");
const { today } = require("../../utilidades/validacion");
const { zipStore } = require("../../utilidades/zip");
const { uploadImage } = require("../../intermedios/subida-de-fotos");
const { getSettings, saveSettings } = require("../../servicios/ajustes.servicio");

const router = Router();

router.get("/settings", (req, res) => res.json(getSettings()));
router.put("/settings", (req, res) => {
  const result = saveSettings(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

router.post("/upload", uploadImage, (req, res) => res.json({ url: "/uploads/" + req.file.filename }));

// .zip con la base de datos y todas las fotos subidas
router.get("/backup", (req, res) => {
  persist();
  const files = [{ name: "ikmates.db", data: fs.readFileSync(DB_FILE) }];
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    const full = path.join(UPLOAD_DIR, f);
    if (fs.statSync(full).isFile()) files.push({ name: "uploads/" + f, data: fs.readFileSync(full) });
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="ikmates-respaldo-${today()}.zip"`);
  res.send(zipStore(files));
});

module.exports = router;
