import "./boton-whatsapp.css";
import { $ } from "../../compartido/elementos.js";
import { on } from "../../servicios/estado.js";
import { helloLink } from "../../servicios/ajustes.servicio.js";

export function initWhatsappFloat() {
  on("settings", () => { $("#waFloat").href = helloLink(); });
}
