// Contenido de la portada: publicaciones (carrusel) y mensajes de la barra superior.
const { Router } = require("express");
const { all, run } = require("../../base-de-datos/conexion");
const { isActive, text, safeLink, isDate } = require("../../utilidades/validacion");

const banners = Router();
const announcements = Router();

// ---------- Publicaciones (carrusel) ----------
function cleanBanner(b) {
  const image = String(b.image || "");
  if (!image) return { error: "Subí una imagen para la publicación" };
  const start = String(b.startDate || ""), end = String(b.endDate || "");
  if ((start && !isDate(start)) || (end && !isDate(end))) return { error: "Fecha inválida" };
  if (start && end && end < start) return { error: "La fecha de fin no puede ser anterior a la de inicio" };
  return { values: [image.slice(0, 300), text(b.title, 120), safeLink(b.link), isActive(b), start, end] };
}

banners.get("/", (req, res) => res.json(all("SELECT * FROM banners ORDER BY id DESC")));
banners.post("/", (req, res) => {
  const clean = cleanBanner(req.body);
  if (clean.error) return res.status(400).json({ error: clean.error });
  res.json({ id: run("INSERT INTO banners(image,title,link,active,start_date,end_date) VALUES(?,?,?,?,?,?)", clean.values) });
});
banners.put("/:id", (req, res) => {
  const clean = cleanBanner(req.body);
  if (clean.error) return res.status(400).json({ error: clean.error });
  run("UPDATE banners SET image=?,title=?,link=?,active=?,start_date=?,end_date=? WHERE id=?", [...clean.values, Number(req.params.id)]);
  res.json({ ok: true });
});
banners.delete("/:id", (req, res) => {
  run("DELETE FROM banners WHERE id=?", [Number(req.params.id)]);
  res.json({ ok: true });
});

// ---------- Barra superior en movimiento ----------
const cleanAnnouncement = (b) => text(b.text, 140);

announcements.get("/", (req, res) => res.json(all("SELECT * FROM announcements ORDER BY id")));
announcements.post("/", (req, res) => {
  const msg = cleanAnnouncement(req.body);
  if (!msg) return res.status(400).json({ error: "Escribí el texto" });
  res.json({ id: run("INSERT INTO announcements(text,active) VALUES(?,?)", [msg, isActive(req.body)]) });
});
announcements.put("/:id", (req, res) => {
  const msg = cleanAnnouncement(req.body);
  if (!msg) return res.status(400).json({ error: "Escribí el texto" });
  run("UPDATE announcements SET text=?, active=? WHERE id=?", [msg, isActive(req.body), Number(req.params.id)]);
  res.json({ ok: true });
});
announcements.delete("/:id", (req, res) => {
  run("DELETE FROM announcements WHERE id=?", [Number(req.params.id)]);
  res.json({ ok: true });
});

module.exports = { banners, announcements };
