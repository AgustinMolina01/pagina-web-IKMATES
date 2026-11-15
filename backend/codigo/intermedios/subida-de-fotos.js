// Subida de fotos desde el panel: solo imágenes, hasta 5 MB, con nombre aleatorio.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { UPLOAD_DIR, MAX_UPLOAD_BYTES } = require("../configuracion");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => cb(null, /\.(jpe?g|png|webp|gif)$/i.test(file.originalname) && /^image\//.test(file.mimetype)),
});

/** Middleware para un solo archivo en el campo "image". Responde con JSON si algo falla. */
const uploadImage = (req, res, next) =>
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Archivo inválido (usá JPG, PNG o WEBP de hasta 5 MB)" });
    next();
  });

module.exports = { uploadImage };
