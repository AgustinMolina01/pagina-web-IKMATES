// Aviso corto que aparece abajo y se va solo ("Agregado al carrito").
import "./aviso.css";

let element, timer;

export function toast(message) {
  if (!element) {
    element = document.createElement("div");
    element.className = "toast";
    element.setAttribute("role", "status");
    document.body.appendChild(element);
  }
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => element.classList.remove("show"), 2400);
}
