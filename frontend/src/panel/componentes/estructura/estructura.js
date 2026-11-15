import "./estructura.css";
import { $, $$ } from "../../../compartido/elementos.js";
import { post, get } from "../../../compartido/peticiones.js";
import { emit, on } from "../../../compartido/eventos.js";
import { mostrarPanel } from "../ingreso/ingreso.js";

const CLAVE_PESTANA = "ik_tab";
const CLAVE_AYUDA = "ik_ayuda";

/** Muestra una pestaña y avisa para que cargue sus datos si hace falta. */
export function irAPestana(nombre) {
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === nombre));
  $$(".tab").forEach((t) => t.classList.toggle("on", t.id === "tab-" + nombre));
  try { localStorage.setItem(CLAVE_PESTANA, nombre); } catch (e) { /* modo privado */ }
  window.scrollTo(0, 0);
  emit("pestana", nombre);
}

/** La pestaña donde se quedó la última vez; la primera vez, Inicio. */
export function pestanaGuardada() {
  let nombre = "inicio";
  try { nombre = localStorage.getItem(CLAVE_PESTANA) || nombre; } catch (e) { /* modo privado */ }
  return $("#tab-" + nombre) ? nombre : "inicio";
}

/** Muestra el aviso rojo mientras siga la contraseña inicial. */
export async function revisarContrasenaInicial() {
  const yo = await get("/api/admin/me");
  $("#pwWarn").classList.toggle("hidden", !yo.defaultPassword);
}

// ---------- Consejos de cada pestaña (se pueden ocultar) ----------
function ponerAyuda(visible) {
  document.body.classList.toggle("sin-ayuda", !visible);
  const boton = $("#toggleAyuda");
  boton.textContent = visible ? "💡 Ayudas: sí" : "💡 Ayudas: no";
  boton.setAttribute("aria-pressed", String(visible));
}

export function iniciarEstructura() {
  $("#tabs").onclick = (e) => { const b = e.target.closest("button[data-tab]"); if (b) irAPestana(b.dataset.tab); };
  $("#goPw").onclick = () => { irAPestana("ajustes"); $("#pwForm").scrollIntoView({ behavior: "smooth" }); };
  $("#logout").onclick = async () => { await post("/api/admin/logout"); mostrarPanel(false); };
  on("ir-a-pestana", irAPestana); // otros componentes piden cambiar de pestaña por aviso

  let ayuda = true;
  try { ayuda = localStorage.getItem(CLAVE_AYUDA) !== "no"; } catch (e) { /* modo privado */ }
  ponerAyuda(ayuda);
  $("#toggleAyuda").onclick = () => {
    ayuda = !ayuda;
    try { localStorage.setItem(CLAVE_AYUDA, ayuda ? "si" : "no"); } catch (e) { /* modo privado */ }
    ponerAyuda(ayuda);
  };
}
