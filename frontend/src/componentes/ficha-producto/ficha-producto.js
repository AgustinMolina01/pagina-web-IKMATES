import "./ficha-producto.css";
import { $, esc } from "../../compartido/elementos.js";
import { money } from "../../compartido/formato.js";
import { findProduct, categoryName, emojiFor, toneFor, stockNote } from "../../servicios/catalogo.servicio.js";
import { discountPct, bestPayment, priceWithDiscount, freeShippingFrom } from "../../servicios/ofertas.servicio.js";
import { addToCart } from "../../servicios/carrito.servicio.js";
import { waLink } from "../../servicios/ajustes.servicio.js";
import { toast } from "../aviso/aviso.js";
import { state, on, emit } from "../../servicios/estado.js";
import { irA, rutaCategoria } from "../../servicios/navegacion.servicio.js";

let product = null, gallery = [], photo = 0, chosen = {}, qty = 1;

/** Otros productos de la misma categoría: ayudan a seguir comprando. */
const related = () => state.products.filter((x) => x.id !== product.id && x.cat === product.cat && !x.soldOut).slice(0, 4);

function render(error = "") {
  const p = product, current = gallery[photo], cat = categoryName(p.cat), note = stockNote(p);
  const off = discountPct(p), pay = bestPayment(), free = freeShippingFrom(), more = related();
  const max = p.stock === null ? 99 : p.stock;
  const consulta = waLink(`Hola IK Mates! Quiero consultar por: ${p.name} (${location.origin}/producto/${p.id})`);
  $("#pmBox").innerHTML = `
    <div class="pm-gal">
      <div class="pm-main ${toneFor(p.cat)}">${current ? `<img src="${esc(current)}" alt="${esc(p.name)}">` : emojiFor(p.cat)}${off ? `<span class="pm-off">−${off}%</span>` : ""}</div>
      ${gallery.length > 1 ? `<div class="pm-thumbs">${gallery.map((g, i) => `<button class="${i === photo ? "on" : ""}" data-pimg="${i}" aria-label="Foto ${i + 1}"><img src="${esc(g)}" alt=""></button>`).join("")}</div>` : ""}
    </div>
    <div class="pm-info">
      ${cat ? `<span class="pm-cat">${esc(cat)}</span>` : ""}
      <h1>${esc(p.name)}</h1>
      <div class="pm-price-row">
        <span class="pm-price">${money(p.price)}</span>
        ${off ? `<s class="pm-old">${money(p.oldPrice)}</s><span class="pm-save">Ahorrás ${money(p.oldPrice - p.price)}</span>` : ""}
      </div>
      ${pay && !p.soldOut ? `<div class="pm-pay"><b>${money(priceWithDiscount(p.price, pay.discount))}</b> pagando con ${esc(pay.name.toLowerCase())} (${pay.discount}% OFF)</div>` : ""}
      ${p.wholesale ? `<div class="wh">Por mayor: ${money(p.wholesale.price)} c/u llevando ${p.wholesale.min} o más</div>` : ""}
      ${p.desc ? `<p class="pm-desc">${esc(p.desc)}</p>` : ""}
      ${p.options.map((g) => `
        <div class="pm-opt"><span class="pm-opt-name">${esc(g.name)}</span>
          <div class="pm-pills">${g.values.map((v) => `<button type="button" class="pm-pill${chosen[g.name] === v.label ? " on" : ""}" data-popt="${esc(g.name)}" data-pval="${esc(v.label)}" ${v.soldOut ? "disabled" : ""}>${esc(v.label)}</button>`).join("")}</div>
        </div>`).join("")}
      ${note ? `<div class="low-stock">🔥 ${note}</div>` : ""}
      <div class="pm-err" id="pmErr" role="alert">${esc(error)}</div>
      ${p.soldOut ? `<button class="btn btn-primary" disabled>Sin stock</button>` : `
      <div class="pm-buy">
        <div class="pm-qty" aria-label="Cantidad"><button data-pqty="-1" aria-label="Menos" ${qty <= 1 ? "disabled" : ""}>−</button><span>${qty}</span><button data-pqty="1" aria-label="Más" ${qty >= max ? "disabled" : ""}>+</button></div>
        <button class="btn btn-primary pm-add" data-padd>Agregar al carrito · ${money(p.price * qty)}</button>
      </div>`}
      <a class="pm-wa" href="${esc(consulta)}" target="_blank" rel="noopener">💬 Consultar por este producto</a>
      <ul class="pm-trust">
        <li>🚚 Envíos a todo el país${free ? ` · gratis desde ${money(free)}` : ""}</li>
        <li>💬 Te asesoramos por WhatsApp</li>
        <li>🔒 No pagás nada hasta confirmar el pedido con nosotros</li>
      </ul>
    </div>
    ${more.length ? `<div class="pm-more"><h3>Más de ${esc(cat || "nuestros productos")}</h3>
      <div class="pm-more-grid">${more.map((x) => `
        <button class="pm-mini" data-open="${x.id}">
          <span class="pm-mini-img ${toneFor(x.cat)}">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : emojiFor(x.cat)}</span>
          <span class="pm-mini-name">${esc(x.name)}</span><span class="pm-mini-price">${money(x.price)}</span>
        </button>`).join("")}</div></div>` : ""}`;
}

/** Migas de pan: Inicio › Mates › Mate Imperial (cada una lleva a su página). */
function renderMigas() {
  const cat = state.categories.find((c) => c.slug === product.cat);
  const padre = cat && cat.parent ? state.categories.find((c) => c.slug === cat.parent) : null;
  $("#prodMigas").innerHTML = [
    `<a href="/">Inicio</a>`,
    padre ? `<a href="${esc(rutaCategoria(padre.slug))}">${esc(padre.name)}</a>` : "",
    cat ? `<a href="${esc(rutaCategoria(cat.slug))}">${esc(cat.name)}</a>` : "",
    `<span aria-current="page">${esc(product.name)}</span>`,
  ].filter(Boolean).join('<span aria-hidden="true">›</span>');
}

/** Muestra el producto de la dirección actual (se llama cada vez que cambia la página). */
function mostrar() {
  if (state.vista.tipo !== "producto") return;
  const p = findProduct(state.vista.id);
  if (!p) {
    // Los productos todavía no llegaron: esperamos. Si ya llegaron y no existe (o está oculto), volvemos al inicio.
    if (state.productsLoaded) irA("/", { reemplazar: true });
    return;
  }
  if (!product || product.id !== p.id) { photo = 0; qty = 1; chosen = {}; }
  product = p;
  gallery = [p.img, ...(p.images || [])].filter(Boolean);
  document.title = `${p.name} | IK Mates`;
  renderMigas();
  render();
}

export function initProductPage() {
  on("vista", mostrar);
  on("products", mostrar);
  on("site", () => { if (state.vista.tipo === "producto" && product) { renderMigas(); render(); } }); // llegaron las categorías o los pagos
  document.addEventListener("click", (e) => {
    if (state.vista.tipo !== "producto" || !product) return;
    const thumb = e.target.closest("[data-pimg]");
    if (thumb) { photo = Number(thumb.dataset.pimg); return render(); }
    const opt = e.target.closest("[data-popt]");
    if (opt) { chosen[opt.dataset.popt] = opt.dataset.pval; return render(); }
    const cantidad = e.target.closest("[data-pqty]");
    if (cantidad) { qty = Math.max(1, qty + Number(cantidad.dataset.pqty)); return render(); }
    if (e.target.closest("[data-padd]")) {
      const result = addToCart(product.id, chosen, qty);
      if (result.error) return render(result.error);
      toast("Agregado al carrito");
      emit("abrir-carrito"); // llevar al cliente directo a terminar la compra
    }
  });
}
