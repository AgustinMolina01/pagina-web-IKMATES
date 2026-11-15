// Punto de entrada del panel de administración: estilos, componentes y arranque.

// Estilos comunes (los mismos de la tienda) y propios del panel
import "../estilos/variables.css";
import "../estilos/base.css";
import "../estilos/botones.css";
import "../estilos/secciones.css";
import "./estilos/formularios.css";
import "./estilos/paneles-y-tablas.css";

import { get, setUnauthorizedHandler } from "../compartido/peticiones.js";
import { emit, on } from "../compartido/eventos.js";
import { activarVerContrasena } from "../compartido/ver-contrasena.js";
import { cargarCategorias, cargarProductos } from "./servicios/datos.js";

import { iniciarIngreso, mostrarPanel } from "./componentes/ingreso/ingreso.js";
import { iniciarEstructura, irAPestana, pestanaGuardada, revisarContrasenaInicial } from "./componentes/estructura/estructura.js";
import { iniciarInicio } from "./componentes/inicio/inicio.js";
import { iniciarProductos } from "./componentes/productos/productos.js";
import { iniciarFormularioProducto } from "./componentes/formulario-producto/formulario-producto.js";
import { iniciarCambioPrecios } from "./componentes/cambio-precios/cambio-precios.js";
import { iniciarImportarPlanilla } from "./componentes/importar-planilla/importar-planilla.js";
import { iniciarCategorias } from "./componentes/categorias/categorias.js";
import { iniciarPublicaciones } from "./componentes/publicaciones/publicaciones.js";
import { iniciarPedidos } from "./componentes/pedidos/pedidos.js";
import { iniciarClientes } from "./componentes/clientes/clientes.js";
import { iniciarEnviosYPagos } from "./componentes/envios-y-pagos/envios-y-pagos.js";
import { iniciarAjustes } from "./componentes/ajustes/ajustes.js";
import { iniciarCupones } from "./componentes/cupones/cupones.js";
import { iniciarEstadisticas } from "./componentes/estadisticas/estadisticas.js";

/** Carga todo lo que necesita el panel después de ingresar. */
async function cargarTodo() {
  await revisarContrasenaInicial();
  await cargarCategorias();
  await cargarProductos();
  emit("sesion-lista"); // publicaciones, pedidos y ajustes cargan lo suyo
  irAPestana(pestanaGuardada());
}

[iniciarIngreso, iniciarEstructura, iniciarInicio, iniciarProductos, iniciarFormularioProducto, iniciarCambioPrecios, iniciarImportarPlanilla,
  iniciarCategorias, iniciarPublicaciones, iniciarPedidos, iniciarClientes, iniciarEnviosYPagos, iniciarCupones, iniciarEstadisticas, iniciarAjustes].forEach((iniciar) => iniciar());

activarVerContrasena(); // botón "Ver" en el ingreso y en los formularios de contraseña
on("sesion-iniciada", cargarTodo);
setUnauthorizedHandler(() => mostrarPanel(false)); // si la sesión vence, vuelve al ingreso

// ¿Ya hay una sesión abierta? Entra directo; si no, muestra el ingreso.
get("/api/admin/me")
  .then(() => { mostrarPanel(true); return cargarTodo(); })
  .catch(() => mostrarPanel(false));
