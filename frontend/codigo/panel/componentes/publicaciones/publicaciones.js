import { $, esc } from "../../../compartido/elementos.js";
import { get, post, put, del } from "../../../compartido/peticiones.js";
import { subirFoto } from "../../servicios/subir-foto.js";
import { on } from "../../../compartido/eventos.js";

let banners = [], imagen = "", mensajes = [];

const decir = (sel, m, ok = false) => { $(sel).textContent = m; $(sel).className = ok ? "okmsg" : "err"; };
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fecha = (s) => s.split("-").reverse().join("/");

// ---------- Publicaciones (carrusel) ----------
const miniatura = () => { $("#bThumb").innerHTML = imagen ? `<img src="${esc(imagen)}" style="width:100%;height:100%;object-fit:cover" alt="">` : "🖼️"; };

async function cargarBanners() {
  banners = await get("/api/admin/banners");
  const t = hoy();
  $("#bList").innerHTML = banners.length
    ? banners.map((b) => {
        const estado = !b.active ? `<span class="pill off">Oculta</span>`
          : b.start_date && b.start_date > t ? `<span class="pill">Programada desde ${fecha(b.start_date)}</span>`
          : b.end_date && b.end_date < t ? `<span class="pill off">Vencida el ${fecha(b.end_date)}</span>`
          : `<span class="pill green">En vigencia${b.end_date ? " hasta " + fecha(b.end_date) : ""}</span>`;
        return `<div style="border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff">
          <img src="${esc(b.image)}" alt="" style="width:100%;aspect-ratio:21/8;object-fit:cover;display:block">
          <div style="padding:10px" class="acts">${estado}<div style="margin-top:8px"><button data-bedit="${b.id}">Editar</button><button class="del" data-bdel="${b.id}">Eliminar</button></div></div></div>`;
      }).join("")
    : `<p class="hint">Todavía no hay publicaciones.</p>`;
}

function limpiarBanner() {
  $("#bForm").reset();
  $("#bId").value = "";
  imagen = "";
  miniatura();
  $("#bCancel").classList.add("hidden");
  $("#bErr").textContent = "";
}

// ---------- Mensajes de la barra superior ----------
async function cargarMensajes() {
  mensajes = await get("/api/admin/announcements");
  $("#aList").innerHTML = mensajes.length
    ? mensajes.map((a) => `<div style="display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);flex-wrap:wrap" class="acts">
        <span style="flex:1;min-width:180px;${a.active ? "" : "opacity:.5"}">${esc(a.text)}</span>
        <button data-atoggle="${a.id}">${a.active ? "Ocultar" : "Mostrar"}</button><button data-aedit="${a.id}">Editar</button><button class="del" data-adel="${a.id}">Eliminar</button></div>`).join("")
    : `<p class="hint" style="margin-top:10px">No hay mensajes: la barra no se mostrará.</p>`;
}

export function iniciarPublicaciones() {
  on("sesion-lista", () => { cargarBanners(); cargarMensajes(); });

  $("#bFile").onchange = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    decir("#bErr", "Subiendo imagen…", true);
    try { imagen = await subirFoto(archivo); miniatura(); $("#bErr").textContent = ""; }
    catch (err) { decir("#bErr", err.message); e.target.value = ""; }
  };

  $("#bForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = $("#bId").value;
    const cuerpo = { image: imagen, title: $("#bTitle").value, link: $("#bLink").value, active: $("#bActive").checked, startDate: $("#bStart").value, endDate: $("#bEnd").value };
    try { await (id ? put(`/api/admin/banners/${id}`, cuerpo) : post("/api/admin/banners", cuerpo)); limpiarBanner(); cargarBanners(); }
    catch (err) { decir("#bErr", err.message); }
  };
  $("#bCancel").onclick = limpiarBanner;

  $("#bList").onclick = async (e) => {
    const editar = e.target.dataset.bedit, borrar = e.target.dataset.bdel;
    if (editar) {
      const b = banners.find((x) => x.id == editar);
      if (!b) return;
      $("#bId").value = b.id; $("#bTitle").value = b.title; $("#bLink").value = b.link; $("#bActive").checked = !!b.active;
      $("#bStart").value = b.start_date || ""; $("#bEnd").value = b.end_date || "";
      imagen = b.image; miniatura();
      $("#bCancel").classList.remove("hidden");
      $("#bForm").scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (borrar && confirm("¿Eliminar esta publicación?")) { await del(`/api/admin/banners/${borrar}`); cargarBanners(); }
  };

  $("#aForm").onsubmit = async (e) => {
    e.preventDefault();
    $("#aErr").textContent = "";
    try { await post("/api/admin/announcements", { text: $("#aText").value }); $("#aText").value = ""; cargarMensajes(); }
    catch (err) { decir("#aErr", err.message); }
  };

  $("#aList").onclick = async (e) => {
    const d = e.target.dataset, a = mensajes.find((x) => x.id == (d.atoggle || d.aedit || d.adel));
    if (!a) return;
    try {
      if (d.atoggle) await put(`/api/admin/announcements/${a.id}`, { text: a.text, active: !a.active });
      if (d.aedit) { const t = prompt("Editar mensaje:", a.text); if (t === null) return; await put(`/api/admin/announcements/${a.id}`, { text: t, active: !!a.active }); }
      if (d.adel) { if (!confirm("¿Eliminar este mensaje?")) return; await del(`/api/admin/announcements/${a.id}`); }
      cargarMensajes();
    } catch (err) { decir("#aErr", err.message); }
  };
}
