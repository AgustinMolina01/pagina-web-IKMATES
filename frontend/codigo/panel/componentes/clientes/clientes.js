import { $, esc } from "../../../compartido/elementos.js";
import { formatDateTime } from "../../../compartido/formato.js";
import { get, post, del } from "../../../compartido/peticiones.js";
import { on } from "../../../compartido/eventos.js";

let clientes = [];

async function cargar() {
  clientes = await get("/api/admin/customers");
  dibujar();
}

function dibujar() {
  const texto = $("#custSearch").value.trim().toLowerCase();
  const lista = clientes.filter((c) => !texto || (c.name + " " + c.email + " " + c.phone).toLowerCase().includes(texto));
  $("#custBody").innerHTML = lista.length
    ? lista.map((c) => `<tr>
        <td><strong>${esc(c.name)}</strong></td><td>${esc(c.email)}</td>
        <td class="hide-m">${c.phone ? `<a href="https://wa.me/${esc(c.phone.length <= 10 ? "549" + c.phone : c.phone)}" target="_blank" rel="noopener">${esc(c.phone)}</a>` : "—"}</td>
        <td>${c.orders}</td><td class="hide-m">${esc(formatDateTime(c.created_at))}</td>
        <td class="acts" style="white-space:nowrap"><button data-creset="${c.id}">Nueva contraseña</button><button class="del" data-cdelete="${c.id}">Eliminar</button></td></tr>`).join("")
    : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">${clientes.length ? "Ningún cliente coincide con la búsqueda." : "Todavía no se registró ningún cliente."}</td></tr>`;
  $("#custCount").textContent = clientes.length ? `${clientes.length} cliente${clientes.length === 1 ? "" : "s"} registrado${clientes.length === 1 ? "" : "s"}` : "";
}

export function iniciarClientes() {
  on("pestana", (nombre) => { if (nombre === "clientes") cargar(); });
  $("#custSearch").addEventListener("input", dibujar);

  $("#custBody").onclick = async (e) => {
    const reiniciar = e.target.dataset.creset, borrar = e.target.dataset.cdelete;
    const c = clientes.find((x) => x.id == (reiniciar || borrar));
    if (!c) return;
    try {
      if (reiniciar && confirm(`¿Generar una contraseña temporal para ${c.name}? La que tenía deja de funcionar.`)) {
        const r = await post(`/api/admin/customers/${c.id}/reset-password`);
        $("#custMsg").innerHTML = `<div class="preview"><b>Contraseña temporal de ${esc(c.name)}:</b> <code style="font-size:1.1rem;background:#fff;padding:3px 8px;border-radius:6px">${esc(r.password)}</code><br>Pasásela por WhatsApp. Se muestra una sola vez: si la perdés, generá otra.</div>`;
      }
      if (borrar && confirm(`¿Eliminar la cuenta de ${c.name}? Sus pedidos quedan registrados, pero sin cuenta asociada.`)) {
        await del(`/api/admin/customers/${c.id}`);
        $("#custMsg").innerHTML = "";
        await cargar();
      }
    } catch (err) { alert(err.message); }
  };
}
