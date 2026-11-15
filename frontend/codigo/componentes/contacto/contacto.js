import "./contacto.css";
import { $ } from "../../compartido/elementos.js";
import { formatPhone } from "../../compartido/formato.js";
import { state, on } from "../../servicios/estado.js";
import { helloLink } from "../../servicios/ajustes.servicio.js";

function render() {
  const s = state.settings, place = encodeURIComponent(s.address);
  $("#waNum").textContent = formatPhone(s.whatsapp);
  $("#waDirect").href = helloLink();
  $("#mapLink").href = `https://www.google.com/maps/search/?api=1&query=${place}`;
  const src = `https://maps.google.com/maps?q=${place}&z=16&output=embed`;
  if ($("#mapFrame").getAttribute("src") !== src) $("#mapFrame").src = src; // no recarga el mapa si no cambió
}

export function initContact() {
  on("settings", render);
}
