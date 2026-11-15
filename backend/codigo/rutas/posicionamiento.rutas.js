// Posicionamiento en buscadores (SEO) y vista previa al compartir el link:
//   • "/", "/categoria/:slug" y "/producto/:id" devuelven la tienda con título, descripción e imagen propios (WhatsApp, Instagram y Google no ejecutan JavaScript).
//   • /sitemap.xml y /robots.txt
//   • /privacidad y /terminos (textos editables desde el panel)
//   • /arrepentimiento (botón de arrepentimiento, Resolución 424/2020)
const fs = require("fs");
const path = require("path");
const { Router } = require("express");
const { PUBLIC_DIR, SITE_URL } = require("../configuracion");
const { listProducts } = require("../servicios/productos.servicio");
const { getSettings } = require("../servicios/ajustes.servicio");
const { publicCategories } = require("../servicios/categorias.servicio");

const router = Router();
const NOMBRE = "IK Mates";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Dentro de <script type="application/ld+json"> hay que evitar que un "<" cierre la etiqueta
const jsonSeguro = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");
const recortar = (t, n) => { const s = String(t || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const pesos = (n) => "$" + Number(n).toLocaleString("es-AR");

function baseUrl(req) {
  return (SITE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
}
const absoluta = (base, url) => (/^https?:\/\//i.test(url) ? url : base + (String(url).startsWith("/") ? "" : "/") + url);

function leerTienda() {
  try { return fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8"); } catch { return null; }
}

function etiquetas({ titulo, descripcion, url, imagen, tipo = "website", extra = "" }) {
  return `<!--seo:inicio-->
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descripcion)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="${tipo}">
  <meta property="og:site_name" content="${NOMBRE}">
  <meta property="og:locale" content="es_AR">
  <meta property="og:title" content="${esc(titulo)}">
  <meta property="og:description" content="${esc(descripcion)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(imagen)}">
  <meta name="twitter:card" content="summary_large_image">${extra}
  <!--seo:fin-->`;
}

function enviarTienda(res, etiq) {
  const html = leerTienda();
  if (!html) return res.status(503).send("El sitio todavía no está armado. Ejecutá: npm run armar");
  res.type("html").send(html.replace(/<!--seo:inicio-->[\s\S]*?<!--seo:fin-->/, () => etiq));
}

function jsonLdNegocio(base, ajustes) {
  return `\n  <script type="application/ld+json">${jsonSeguro({
    "@context": "https://schema.org", "@type": "Store", name: NOMBRE, url: base + "/", image: base + "/img/logo.png",
    address: ajustes.address, openingHours: ajustes.hours, telephone: "+" + ajustes.whatsapp,
  })}</script>`;
}

function paginaInicio(req, res) {
  const base = baseUrl(req), a = getSettings();
  enviarTienda(res, etiquetas({
    titulo: `${NOMBRE} | Mates, yerba y combos en Rosario`,
    descripcion: "Mates, yerba y combos seleccionados, con envíos a todo el país. Hacé tu pedido en minutos por WhatsApp.",
    url: base + "/", imagen: base + "/img/logo.png", extra: jsonLdNegocio(base, a),
  }));
}
router.get("/", paginaInicio);
router.get("/index.html", paginaInicio);

// Cada producto tiene su propio link; la tienda abre la ficha sola (ver ficha-producto.js)
router.get("/producto/:id", (req, res) => {
  const base = baseUrl(req);
  const id = Number(req.params.id);
  const p = Number.isInteger(id) ? listProducts({ onlyActive: true }).find((x) => x.id === id) : null;
  if (!p) return res.redirect(302, "/");
  const foto = p.img || (p.images || [])[0];
  const url = `${base}/producto/${p.id}`;
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, url,
    image: [foto ? absoluta(base, foto) : base + "/img/logo.png"],
    description: recortar(p.desc || p.name, 300),
    offers: { "@type": "Offer", priceCurrency: "ARS", price: p.price, url,
      availability: p.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" },
  };
  enviarTienda(res, etiquetas({
    titulo: `${p.name} | ${NOMBRE}`,
    descripcion: recortar(`${pesos(p.price)}. ${p.desc || "Pedilo por WhatsApp."}`, 160),
    url, imagen: foto ? absoluta(base, foto) : base + "/img/logo.png", tipo: "product",
    extra: `\n  <script type="application/ld+json">${jsonSeguro(ld)}</script>`,
  }));
});

// Cada categoría (y subcategoría) tiene su página: /categoria/mates
router.get("/categoria/:slug", (req, res) => {
  const base = baseUrl(req);
  const categorias = publicCategories();
  const cat = categorias.find((c) => c.slug === req.params.slug);
  if (!cat) return res.redirect(302, "/");
  const slugs = [cat.slug, ...categorias.filter((c) => c.parent === cat.slug).map((c) => c.slug)];
  const productos = listProducts({ onlyActive: true }).filter((p) => slugs.includes(p.cat));
  const foto = (productos.find((p) => p.img) || {}).img;
  const nombres = productos.slice(0, 3).map((p) => p.name).join(", ");
  enviarTienda(res, etiquetas({
    titulo: `${cat.name} | ${NOMBRE}`,
    descripcion: recortar(`Comprá ${cat.name.toLowerCase()} en ${NOMBRE}, Rosario. ${productos.length} ${productos.length === 1 ? "producto" : "productos"}${nombres ? ": " + nombres : ""}. Pedí por WhatsApp.`, 160),
    url: `${base}/categoria/${cat.slug}`, imagen: foto ? absoluta(base, foto) : base + "/img/logo.png",
  }));
});

router.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});

router.get("/sitemap.xml", (req, res) => {
  const base = baseUrl(req);
  const urls = ["/", "/privacidad", "/terminos", "/arrepentimiento", ...publicCategories().map((c) => `/categoria/${c.slug}`), ...listProducts({ onlyActive: true }).map((p) => `/producto/${p.id}`)];
  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(base + u)}</loc></url>`).join("\n") + "\n</urlset>\n");
});

// ---------- Páginas legales ----------
/** "## Título" → subtítulo; las líneas en blanco separan párrafos. Todo escapado. */
function textoAHtml(texto) {
  const salida = [];
  let parrafo = [];
  const cerrarParrafo = () => { if (parrafo.length) salida.push(`<p>${parrafo.map(esc).join("<br>")}</p>`); parrafo = []; };
  for (const linea of String(texto || "").split(/\r?\n/)) {
    const l = linea.trim();
    if (l.startsWith("## ")) { cerrarParrafo(); salida.push(`<h2>${esc(l.slice(3))}</h2>`); }
    else if (!l) cerrarParrafo();
    else parrafo.push(l);
  }
  cerrarParrafo();
  return salida.join("\n");
}

/** Página simple (legales y arrepentimiento) con el estilo de la tienda. */
function paginaSimple(req, titulo, cuerpo, descripcion = `${titulo} de ${NOMBRE}.`) {
  const base = baseUrl(req);
  return `<!doctype html>
<html lang="es"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titulo)} | ${NOMBRE}</title>
  <meta name="description" content="${esc(descripcion)}">
  <link rel="canonical" href="${esc(base + req.path)}">
  <link rel="icon" href="/img/logo.png">
  <link rel="stylesheet" href="/assets/tienda.css">
  <style>
    .legal{max-width:760px;margin:0 auto;padding:40px 20px 60px;line-height:1.7}
    .legal h1{font-family:'Playfair Display',serif;margin:10px 0 24px}
    .legal h2{font-size:1.15rem;margin:26px 0 6px}
    .legal p{margin:0 0 10px}
    .legal .volver{display:inline-block;margin-bottom:10px;text-decoration:underline}
    .arr-form{display:grid;gap:12px;margin-top:20px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:22px}
    .arr-form label{font-weight:600;font-size:.9rem}
    .arr-form input,.arr-form textarea{width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:10px;font:inherit;margin-top:4px;background:#fff;color:var(--ink)}
    .arr-err{color:var(--danger);font-weight:600;min-height:1em}
    .arr-ok{background:#eef4e6;border:1px solid #cfdcbf;border-radius:var(--radius);padding:20px;margin-top:20px}
    .arr-ok b{font-size:1.25rem}
  </style>
</head><body>
  <main class="legal">
    <a class="volver" href="/">← Volver a la tienda</a>
    <h1>${esc(titulo)}</h1>
    ${cuerpo}
  </main>
</body></html>`;
}

function paginaLegal(titulo, campo) {
  return (req, res) => res.type("html").send(paginaSimple(req, titulo, textoAHtml(getSettings()[campo])));
}
router.get("/privacidad", paginaLegal("Política de privacidad", "privacyText"));
router.get("/terminos", paginaLegal("Términos y condiciones", "termsText"));

// Botón de arrepentimiento (Resolución 424/2020): formulario simple, sin pedir que inicie sesión
router.get("/arrepentimiento", (req, res) => {
  const cuerpo = `
    <p>Si compraste en ${NOMBRE} y te arrepentiste, podés pedir la cancelación de tu compra dentro de los <b>10 días corridos</b> desde que recibiste el producto (Ley 24.240 de Defensa del Consumidor), siempre que esté sin uso y en su envoltorio.</p>
    <p>Completá el formulario: te damos un <b>código de solicitud</b> al instante y te contactamos para coordinar la devolución y el reintegro.</p>
    <form class="arr-form" id="arrForm">
      <div><label for="arrName">Nombre y apellido *</label><input id="arrName" maxlength="80" required autocomplete="name"></div>
      <div><label for="arrContact">Email o WhatsApp *</label><input id="arrContact" maxlength="120" required></div>
      <div><label for="arrOrder">Número de pedido (si lo tenés)</label><input id="arrOrder" maxlength="40" placeholder="Ej: 125"></div>
      <div><label for="arrReason">Comentario (opcional)</label><textarea id="arrReason" rows="3" maxlength="1000"></textarea></div>
      <div class="arr-err" id="arrErr" role="alert"></div>
      <button class="btn btn-primary" type="submit">Enviar solicitud de arrepentimiento</button>
    </form>
    <div class="arr-ok" id="arrOk" hidden role="status"></div>
    <script>
      document.getElementById("arrForm").onsubmit = async function (e) {
        e.preventDefault();
        var v = function (id) { return document.getElementById(id).value; };
        var err = document.getElementById("arrErr"), btn = this.querySelector("button");
        err.textContent = ""; btn.disabled = true;
        try {
          var r = await fetch("/api/arrepentimiento", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: v("arrName"), contact: v("arrContact"), orderRef: v("arrOrder"), reason: v("arrReason") }) });
          var d = await r.json();
          if (!r.ok) throw new Error(d.error || "No se pudo enviar");
          this.hidden = true;
          var ok = document.getElementById("arrOk");
          ok.innerHTML = "✔ Recibimos tu solicitud.<br>Tu código es <b></b><br>Guardalo: te contactamos dentro de las 24 hs hábiles.";
          ok.querySelector("b").textContent = d.code;
          ok.hidden = false;
        } catch (x) { err.textContent = x.message; btn.disabled = false; }
      };
    </script>`;
  res.type("html").send(paginaSimple(req, "Botón de arrepentimiento", cuerpo, `Cancelá tu compra en ${NOMBRE}: botón de arrepentimiento.`));
});

module.exports = router;
