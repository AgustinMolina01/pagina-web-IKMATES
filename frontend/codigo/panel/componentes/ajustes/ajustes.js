import { $ } from "../../../compartido/elementos.js";
import { get, put, post } from "../../../compartido/peticiones.js";
import { on } from "../../../compartido/eventos.js";

// Campo del servidor → campo de la pantalla
const CAMPOS = {
  whatsapp: "#sWhatsapp", hours: "#sHours", address: "#sAddress",
  instagram: "#sInstagram", facebook: "#sFacebook", tiktok: "#sTiktok", payments: "#sPayments", shipping: "#sShipping", wholesaleNote: "#sWholesale",
  aboutTitle: "#sAboutTitle", aboutText: "#sAboutText", aboutValues: "#sAboutValues", faqText: "#sFaq",
  privacyText: "#sPrivacy", termsText: "#sTerms",
};

const decir = (sel, m, ok = false) => { $(sel).textContent = m; $(sel).className = ok ? "okmsg" : "err"; };

async function cargar() {
  const ajustes = await get("/api/admin/settings");
  for (const [clave, sel] of Object.entries(CAMPOS)) $(sel).value = ajustes[clave] || "";
  $("#mailNew").value = (await get("/api/admin/me")).email || "";
}

export function iniciarAjustes() {
  on("sesion-lista", cargar);

  $("#sForm").onsubmit = async (e) => {
    e.preventDefault();
    $("#sErr").textContent = "";
    $("#sOk").textContent = "";
    const cuerpo = {};
    for (const [clave, sel] of Object.entries(CAMPOS)) cuerpo[clave] = $(sel).value;
    try { await put("/api/admin/settings", cuerpo); $("#sOk").textContent = "✔ Guardado. Ya se ve en la tienda."; await cargar(); }
    catch (err) { decir("#sErr", err.message); }
  };

  $("#mailForm").onsubmit = async (e) => {
    e.preventDefault();
    $("#mailErr").textContent = "";
    $("#mailOk").textContent = "";
    try {
      const r = await post("/api/admin/email", { email: $("#mailNew").value, current: $("#mailPw").value });
      $("#mailNew").value = r.email;
      $("#mailPw").value = "";
      $("#mailOk").textContent = "✔ Listo. La próxima vez entrá con este correo.";
    } catch (err) { decir("#mailErr", err.message); }
  };

  $("#pwForm").onsubmit = async (e) => {
    e.preventDefault();
    $("#pwErr").textContent = "";
    $("#pwOk").textContent = "";
    if ($("#pwNew").value !== $("#pwNew2").value) return decir("#pwErr", "Las dos contraseñas nuevas no coinciden");
    try {
      await post("/api/admin/password", { current: $("#pwCur").value, next: $("#pwNew").value });
      $("#pwForm").reset();
      $("#pwOk").textContent = "✔ Contraseña cambiada.";
      $("#pwWarn").classList.add("hidden");
    } catch (err) { decir("#pwErr", err.message); }
  };
}
