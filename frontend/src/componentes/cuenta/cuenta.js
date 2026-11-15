import "./cuenta.css";
import { activarVerContrasena } from "../../compartido/ver-contrasena.js";
import { $, esc } from "../../compartido/elementos.js";
import { money, formatDate } from "../../compartido/formato.js";
import { state, on } from "../../servicios/estado.js";
import { waLink } from "../../servicios/ajustes.servicio.js";
import { register, login, logout, myOrders } from "../../servicios/cuenta.servicio.js";
import { closeCart } from "../carrito/carrito.js";
import { toast } from "../aviso/aviso.js";

const STATUS = { nuevo: "Enviado", atendido: "Atendido", cancelado: "Cancelado" };
const firstName = () => state.account.name.split(" ")[0];

// ---------- Botón del encabezado ----------
function renderButton() {
  const a = state.account;
  $("#acctLabel").textContent = a ? firstName() : "Ingresar";
  $("#acctHello").textContent = a ? a.email : "";
  $("#acctTip").innerHTML = a ? "" : `<button class="link-btn" data-acct-open>Ingresá o creá tu cuenta para guardar tus pedidos</button>`;
}

// ---------- Ventana ----------
const modal = () => $("#amodal");
function openModal(html) {
  $("#amBox").innerHTML = html;
  activarVerContrasena($("#amBox"));
  modal().hidden = false;
  document.body.classList.add("no-scroll");
}
function closeModal() {
  modal().hidden = true;
  document.body.classList.remove("no-scroll");
}

function authView(tab = "login") {
  const reg = tab === "register";
  openModal(`
    <button class="pm-x" data-aclose aria-label="Cerrar">✕</button>
    <div class="am-head"><img src="/img/logo.png" alt="IK Mates"><h2>${reg ? "Creá tu cuenta" : "Ingresá a tu cuenta"}</h2>
      <p>${reg ? "Guardá tus pedidos y comprá más rápido." : "Mirá tus pedidos y comprá más rápido."}</p></div>
    <div class="am-tabs"><button data-atab="login" class="${reg ? "" : "on"}">Ingresar</button><button data-atab="register" class="${reg ? "on" : ""}">Crear cuenta</button></div>
    <form id="authForm" data-mode="${tab}" novalidate>
      ${reg ? `<label>Nombre</label><input name="name" autocomplete="name" maxlength="60">` : ""}
      <label>Email</label><input name="email" type="email" autocomplete="email">
      ${reg ? `<label>WhatsApp (opcional)</label><input name="phone" type="tel" autocomplete="tel" placeholder="Con código de área, ej: 3412147956">` : ""}
      <label>Contraseña</label><input name="password" type="password" autocomplete="${reg ? "new-password" : "current-password"}">
      ${reg ? `<p class="am-note">Mínimo 8 caracteres. Al crear tu cuenta aceptás la <a href="/privacidad" target="_blank" rel="noopener">política de privacidad</a> y los <a href="/terminos" target="_blank" rel="noopener">términos</a>.</p>` : ""}
      <div class="am-err" id="amErr" role="alert"></div>
      <button class="btn btn-primary full" type="submit">${reg ? "Crear cuenta" : "Ingresar"}</button>
      ${reg ? "" : `<p class="am-note">¿Olvidaste tu contraseña? <a href="${esc(waLink("Hola IK Mates! Olvidé la contraseña de mi cuenta."))}" target="_blank" rel="noopener">Escribinos por WhatsApp</a> y te ayudamos.</p>`}
    </form>`);
  const first = $("#authForm input");
  if (first) first.focus();
}

async function ordersView() {
  openModal(`<button class="pm-x" data-aclose aria-label="Cerrar">✕</button><div class="am-head"><h2>Mis pedidos</h2></div><div class="am-orders" id="amOrders">Cargando…</div>`);
  try {
    const orders = await myOrders();
    $("#amOrders").innerHTML = orders.length
      ? orders.map((o) => {
          const d = o.details || {}, extra = [d.payment && d.payment.name, d.shipping && d.shipping.name].filter(Boolean).join(" · ");
          return `<div class="am-ord"><div class="am-ord-h"><b>Pedido #${o.id}</b><span>${esc(formatDate(o.created_at))}</span></div>
            <ul>${o.items.map((i) => `<li>${i.qty} × ${esc(i.name)}${i.options && i.options.length ? ` (${esc(i.options.join(", "))})` : ""}</li>`).join("")}</ul>
            ${extra ? `<div class="am-ord-extra">${esc(extra)}</div>` : ""}
            <div class="am-ord-f"><b>${money(o.total)}</b><span class="st st-${esc(o.status)}">${esc(STATUS[o.status] || o.status)}</span></div></div>`;
        }).join("")
      : "<p>Todavía no hiciste pedidos desde tu cuenta.</p>";
  } catch (e) {
    $("#amOrders").textContent = "No pudimos cargar tus pedidos. Probá de nuevo.";
  }
}

export function initAccount() {
  on("account", renderButton);

  const menu = $("#acctMenu"), button = $("#acctBtn");
  const setMenu = (open) => { menu.classList.toggle("open", open); button.setAttribute("aria-expanded", open); };

  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "authForm") return;
    e.preventDefault();
    const form = e.target, data = Object.fromEntries(new FormData(form)), submit = form.querySelector("button[type=submit]");
    $("#amErr").textContent = "";
    submit.disabled = true;
    try {
      const mode = form.dataset.mode;
      await (mode === "register" ? register(data) : login(data));
      closeModal();
      toast(mode === "register" ? `¡Hola, ${firstName()}! Tu cuenta está lista.` : `¡Hola de nuevo, ${firstName()}!`);
    } catch (err) {
      $("#amErr").textContent = err.message;
      submit.disabled = false;
    }
  });

  document.addEventListener("click", async (e) => {
    if (e.target.closest("#acctBtn")) {
      if (state.account) setMenu(!menu.classList.contains("open")); else authView("login");
      return;
    }
    if (!e.target.closest(".acct")) setMenu(false);
    if (e.target.closest("[data-aclose]")) return closeModal();
    const tab = e.target.closest("[data-atab]");
    if (tab) return authView(tab.dataset.atab);
    if (e.target.closest("[data-acct-open]")) { closeCart(); return authView("login"); }
    const item = e.target.closest("[data-acct]");
    if (!item) return;
    setMenu(false);
    if (item.dataset.acct === "orders") return ordersView();
    if (item.dataset.acct === "logout") { await logout(); toast("Cerraste sesión"); }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeModal();
    setMenu(false);
  });
}
