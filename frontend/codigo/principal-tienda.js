// Punto de entrada de la tienda: junta los estilos, enciende cada componente y carga los datos.

// 1) Estilos comunes (el orden importa: los componentes se apoyan en estos)
import "./estilos/variables.css";
import "./estilos/base.css";
import "./estilos/botones.css";
import "./estilos/secciones.css";
import "./estilos/ventanas.css";

// 2) Componentes (cada uno trae su propio CSS)
import { initAnnounceBar } from "./componentes/barra-anuncios/barra-anuncios.js";
import { initSiteHeader } from "./componentes/encabezado/encabezado.js";
import { initMegaMenu } from "./componentes/menu-productos/menu-productos.js";
import { initBenefits } from "./componentes/beneficios/beneficios.js";
import { initCategoryTiles } from "./componentes/categorias-destacadas/categorias-destacadas.js";
import { initBannerSlider } from "./componentes/carrusel/carrusel.js";
import { initCatalog } from "./componentes/catalogo/catalogo.js";
import { initProductPage } from "./componentes/ficha-producto/ficha-producto.js";
import { initCategoryPage } from "./componentes/pagina-categoria/pagina-categoria.js";
import { initHowToBuy } from "./componentes/como-comprar/como-comprar.js";
import { initAbout } from "./componentes/nosotros/nosotros.js";
import { initFaq } from "./componentes/preguntas-frecuentes/preguntas-frecuentes.js";
import { initContact } from "./componentes/contacto/contacto.js";
import { initSiteFooter } from "./componentes/pie-de-pagina/pie-de-pagina.js";
import { initWhatsappFloat } from "./componentes/boton-whatsapp/boton-whatsapp.js";
import { initCart } from "./componentes/carrito/carrito.js";
import { initAccount } from "./componentes/cuenta/cuenta.js";

// 3) Servicios
import { emit } from "./servicios/estado.js";
import { applySettings } from "./servicios/ajustes.servicio.js";
import { loadCart, refreshQuote } from "./servicios/carrito.servicio.js";
import { loadSite, loadProducts } from "./servicios/catalogo.servicio.js";
import { loadAccount } from "./servicios/cuenta.servicio.js";
import { iniciarNavegacion } from "./servicios/navegacion.servicio.js";

// Cada componente se engancha a los avisos (eventos) que le interesan
[initAnnounceBar, initSiteHeader, initMegaMenu, initBenefits, initBannerSlider, initCategoryTiles, initCatalog, initCategoryPage, initProductPage,
  initHowToBuy, initAbout, initFaq, initContact, initSiteFooter, initWhatsappFloat, initCart, initAccount].forEach((iniciar) => iniciar());

// Primera pantalla con los valores por defecto, y después los datos reales
iniciarNavegacion(); // muestra la página de la dirección actual (inicio, categoría o producto)
loadCart();
applySettings();
emit("settings");
emit("site");
emit("cart");
loadProducts();
loadSite();
loadAccount();
refreshQuote();
