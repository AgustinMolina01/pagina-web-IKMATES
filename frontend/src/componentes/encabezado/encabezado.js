import "./encabezado.css";
import { $ } from "../../compartido/elementos.js";
import { state, emit } from "../../servicios/estado.js";
import { irA } from "../../servicios/navegacion.servicio.js";

// ----- Buscador -----
function initSearch() {
  const input = $("#search");
  const run = () => {
    state.query = input.value;
    if (state.query.trim() && state.vista.tipo !== "inicio") irA("/"); // los resultados se muestran en el inicio
    emit("query");
  };
  input.addEventListener("input", run);
  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    run();
    if (state.query.trim()) $("#productos").scrollIntoView({ behavior: "smooth" });
  });
  // "Ver todos los productos" limpia la búsqueda
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-all]") && state.query) { input.value = ""; run(); }
  });
}

export function initSiteHeader() {
  initSearch();
}
