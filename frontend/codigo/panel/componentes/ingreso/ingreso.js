import "./ingreso.css";
import { $ } from "../../../compartido/elementos.js";
import { post } from "../../../compartido/peticiones.js";
import { emit } from "../../../compartido/eventos.js";

/** Muestra el panel (true) o la pantalla de ingreso (false). */
export function mostrarPanel(sesionIniciada) {
  $("#loginView").classList.toggle("hidden", sesionIniciada);
  $("#appView").classList.toggle("hidden", !sesionIniciada);
}

export function iniciarIngreso() {
  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault();
    $("#loginErr").textContent = "";
    try {
      await post("/api/admin/login", { email: $("#email").value, password: $("#pass").value });
      $("#pass").value = "";
      mostrarPanel(true);
      emit("sesion-iniciada");
    } catch (err) {
      $("#loginErr").textContent = err.message;
    }
  };
}
