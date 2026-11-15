import { $, esc } from "../../../compartido/elementos.js";
import { post, put, del } from "../../../compartido/peticiones.js";
import { subirFoto } from "../../servicios/subir-foto.js";
import { on } from "../../../compartido/eventos.js";
import { datos, principales, hijas, ordenadas, nombreCompleto, cargarCategorias } from "../../servicios/datos.js";

const decir = (m, ok = false) => { $("#cErr").textContent = m; $("#cErr").className = ok ? "okmsg" : "err"; };
let fotoPara = null; // categoría a la que se le está eligiendo foto

// Miniatura de la foto de portada (solo las principales aparecen en "Comprá por categoría")
const miniatura = (c) => c.parent_id ? "" : c.image
  ? `<img src="${esc(c.image)}" alt="" style="width:46px;height:46px;object-fit:cover;border-radius:8px;flex:none">`
  : `<span style="width:46px;height:46px;border-radius:8px;flex:none;display:grid;place-items:center;background:var(--line)" title="Sin foto">🖼️</span>`;

function dibujar() {
  const padre = $("#cParent").value;
  $("#cParent").innerHTML = `<option value="">Categoría principal (sin padre)</option>` +
    principales().map((c) => `<option value="${c.id}">Dentro de: ${esc(c.name)}</option>`).join("");
  $("#cParent").value = principales().some((c) => String(c.id) === padre) ? padre : "";

  $("#cList").innerHTML = datos.categorias.length
    ? ordenadas().map((c) => {
        const hermanas = c.parent_id ? hijas(c.parent_id) : principales(), i = hermanas.indexOf(c);
        return `<div style="display:flex;gap:8px;align-items:center;padding:10px 0 10px ${c.parent_id ? 28 : 0}px;border-bottom:1px solid var(--line);flex-wrap:wrap" class="acts">
          ${miniatura(c)}<span style="flex:1;min-width:160px;${c.active ? "" : "opacity:.5"}">${c.parent_id ? "↳ " : ""}<strong>${esc(c.name)}</strong> <span class="pill">${c.count} producto${c.count === 1 ? "" : "s"}</span>${c.active ? "" : ` <span class="pill off">Oculta</span>`}</span>
          <button data-cup="${c.id}" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button><button data-cdown="${c.id}" ${i === hermanas.length - 1 ? "disabled" : ""} aria-label="Bajar">↓</button>
          <button data-ctoggle="${c.id}">${c.active ? "Ocultar" : "Mostrar"}</button>${c.parent_id ? "" : `<button data-cfoto="${c.id}">Foto</button>${c.image ? `<button data-csinfoto="${c.id}">Quitar foto</button>` : ""}`}<button data-cedit="${c.id}">Renombrar</button><button class="del" data-cdel="${c.id}">Eliminar</button></div>`;
      }).join("")
    : `<p class="hint" style="margin-top:10px">Todavía no hay categorías.</p>`;
}

export function iniciarCategorias() {
  on("categorias", dibujar);

  $("#cForm").onsubmit = async (e) => {
    e.preventDefault();
    decir("");
    try {
      await post("/api/admin/categories", { name: $("#cName").value, parent_id: $("#cParent").value || null });
      $("#cName").value = "";
      await cargarCategorias();
    } catch (err) { decir(err.message); }
  };

  $("#cList").onclick = async (e) => {
    const d = e.target.dataset, id = d.cup || d.cdown || d.ctoggle || d.cedit || d.cdel || d.cfoto || d.csinfoto, c = datos.categorias.find((x) => x.id == id);
    if (!c) return;
    decir("");
    if (d.cfoto) { fotoPara = c; $("#cFile").value = ""; $("#cFile").click(); return; }
    try {
      if (d.csinfoto) { if (!confirm(`¿Quitar la foto de "${c.name}"?`)) return; await put(`/api/admin/categories/${c.id}`, { name: c.name, active: c.active, image: "" }); }
      if (d.cup || d.cdown) await post(`/api/admin/categories/${c.id}/move`, { dir: d.cup ? -1 : 1 });
      if (d.ctoggle) await put(`/api/admin/categories/${c.id}`, { name: c.name, active: !c.active });
      if (d.cedit) { const nombre = prompt("Nuevo nombre:", c.name); if (nombre === null) return; await put(`/api/admin/categories/${c.id}`, { name: nombre, active: c.active }); }
      if (d.cdel) { if (!confirm(`¿Eliminar "${nombreCompleto(c)}"?`)) return; await del(`/api/admin/categories/${c.id}`); }
      await cargarCategorias();
    } catch (err) { decir(err.message); }
  };

  $("#cFile").onchange = async (e) => {
    const archivo = e.target.files[0], c = fotoPara;
    if (!archivo || !c) return;
    decir("Subiendo foto…", true);
    try {
      const url = await subirFoto(archivo); // se achica antes de subir
      await put(`/api/admin/categories/${c.id}`, { name: c.name, active: c.active, image: url });
      decir("");
      await cargarCategorias();
    } catch (err) { decir(err.message); }
  };
}
