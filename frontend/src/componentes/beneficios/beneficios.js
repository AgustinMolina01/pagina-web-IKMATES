import "./beneficios.css";
import { $ } from "../../compartido/elementos.js";
import { money } from "../../compartido/formato.js";
import { on } from "../../servicios/estado.js";
import { bestPayment, freeShippingFrom } from "../../servicios/ofertas.servicio.js";

// Los beneficios que ella configuró (descuento por forma de pago y envío gratis) se destacan solos acá.
function render() {
  const pay = bestPayment(), free = freeShippingFrom();
  if (free) {
    $("#benEnvioTitulo").textContent = "Envío gratis";
    $("#benEnvioTexto").textContent = `En compras desde ${money(free)}`;
  } else {
    $("#benEnvioTitulo").textContent = "Envíos a todo el país";
    $("#benEnvioTexto").textContent = "Recibí tu compra donde estés";
  }
  if (pay) {
    $("#benPagoTitulo").textContent = `${pay.discount}% OFF`;
    $("#benPagoTexto").textContent = `Pagando con ${pay.name.toLowerCase()}`;
  } else {
    $("#benPagoTitulo").textContent = "Pagá como prefieras";
    $("#benPagoTexto").textContent = "Coordinamos el pago con vos";
  }
}

export function initBenefits() {
  on("site", render);
}
