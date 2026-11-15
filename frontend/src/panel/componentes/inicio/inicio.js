import "./inicio.css";
import { $ } from "../../../compartido/elementos.js";
import { get } from "../../../compartido/peticiones.js";
import { on, emit } from "../../../compartido/eventos.js";
import { datos } from "../../servicios/datos.js";

const POCO_STOCK = 5;
function dibujarResumen(pedidos, clientes) {
  const nuevos = pedidos.orders.filter((o) => o.status === "nuevo").length;
  const agotados = datos.productos.filter((p) => p.soldOut).length;
  const pocos = datos.productos.filter((p) => !p.soldOut && p.stock !== null && p.stock <= POCO_STOCK).length;
  const tarjeta = (numero, texto, ir) => `<button class="stat" data-ir="${ir}"><b>${numero}</b><span>${texto}</span></button>`;
  $("#inResumen").innerHTML =
    tarjeta(nuevos, nuevos === 1 ? "pedido nuevo sin atender" : "pedidos nuevos sin atender", "pedidos") +
    tarjeta(datos.productos.length, "productos cargados", "productos") +
    tarjeta(agotados + pocos, `con poco stock o agotados${agotados + pocos ? " (revisalos)" : ""}`, "productos") +
    tarjeta(clientes.length, "clientes con cuenta", "clientes");
}

async function cargar() {
  const [pedidos, clientes] = await Promise.all([get("/api/admin/orders"), get("/api/admin/customers")]);
  dibujarResumen(pedidos, clientes);
}

export function iniciarInicio() {
  // Se actualiza cada vez que entra a la pestaña
  on("pestana", (nombre) => { if (nombre === "inicio") cargar().catch(() => {}); });
  $("#tab-inicio").addEventListener("click", (e) => {
    const destino = e.target.closest("[data-ir]");
    if (destino) emit("ir-a-pestana", destino.dataset.ir);
  });
}
