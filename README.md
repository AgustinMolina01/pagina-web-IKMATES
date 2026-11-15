# IK Mates – Tienda de mates + panel de administración

Tienda online con carrito que cierra el pedido por WhatsApp, cuentas de clientes y un panel para que la dueña maneje todo sola.

- **frontend/** → lo que ve el navegador (tienda y panel). Cada parte de la página es un **componente**: una carpeta con su HTML, su CSS y su JS.
- **backend/** → servidor y base de datos (Node.js + Express + SQLite).
- **pruebas/** → pruebas automáticas del servidor y de las pantallas.

## Estructura

```
Pag IKmates/
├─ frontend/
│  ├─ armar.js                      Herramienta que junta todo y genera la carpeta armado/
│  ├─ publico/                      Archivos que se copian tal cual (logo, imágenes). logo.png y banners de ejemplo
│  │  └─ img/
│  ├─ armado/                       (se genera sola, no se toca) El sitio listo para publicar
│  └─ codigo/
│     ├─ paginas/                   Cómo se arma cada página con sus componentes
│     │  ├─ tienda.pagina.html
│     │  └─ panel.pagina.html
│     ├─ estilos/                   Colores, botones y base compartidos
│     ├─ compartido/                Utilidades: peticiones al servidor, formato de precios, avisos entre componentes
│     ├─ servicios/                 Lógica de la tienda: catálogo, carrito, cuenta, ajustes
│     ├─ componentes/               ← LA TIENDA, una carpeta por parte de la página
│     │  ├─ barra-anuncios/         Mensajes en movimiento de arriba de todo
│     │  ├─ encabezado/             Buscador, nombre, cuenta y carrito
│     │  ├─ menu-productos/         Desplegable grande de categorías
│     │  ├─ pagina-categoria/       Página de una categoría (/categoria/mates)
│     │  ├─ beneficios/             Franja de 4 beneficios
│     │  ├─ carrusel/               Publicaciones en movimiento
│     │  ├─ catalogo/               Destacados y secciones de productos
│     │  ├─ tarjeta-producto/       Cada producto en la grilla
│     │  ├─ ficha-producto/         Página de un producto (/producto/12): fotos, variantes, stock
│     │  ├─ como-comprar/           Pasos, formas de pago y envíos
│     │  ├─ nosotros/               "Quiénes somos" (texto editable en Ajustes)
│     │  ├─ preguntas-frecuentes/   Preguntas y respuestas (editables en Ajustes)
│     │  ├─ contacto/               Datos del local y mapa
│     │  ├─ pie-de-pagina/
│     │  ├─ boton-whatsapp/         Botón verde flotante
│     │  ├─ carrito/                Pedido, entrega, pago y totales
│     │  ├─ cuenta/                 Ingresar, crear cuenta y "Mis pedidos"
│     │  └─ aviso/                  Mensajitos ("Agregado al carrito")
│     ├─ panel/                     ← EL PANEL DE ADMINISTRACIÓN
│     │  ├─ estilos/  servicios/
│     │  └─ componentes/            ingreso · estructura · productos · formulario-producto ·
│     │                             cambio-precios · importar-planilla · categorias ·
│     │                             publicaciones · pedidos · clientes · envios-y-pagos · cupones ·
│     │                             estadisticas · ajustes  (servicios/subir-foto.js achica las fotos)
│     ├─ principal-tienda.js        Arranque de la tienda
│     └─ panel/principal-panel.js   Arranque del panel
│
├─ backend/
│  ├─ servidor.js                   Enciende el servidor
│  ├─ datos/ikmates.db              Base de datos (productos, categorías, pedidos, clientes, ajustes…)
│  ├─ fotos-subidas/                Fotos que sube ella desde el panel
│  └─ codigo/
│     ├─ configuracion.js           Puerto, carpetas, límites
│     ├─ aplicacion.js              Arma el servidor (rutas, seguridad)
│     ├─ base-de-datos/             Conexión y estructura de las tablas
│     ├─ utilidades/                Validaciones, contraseñas, límite de intentos, respaldo .zip
│     ├─ intermedios/               Sesiones (panel y clientes) y subida de fotos
│     ├─ servicios/                 Reglas del negocio: productos, categorías, compras, ajustes
│     └─ rutas/                     Direcciones de la API
│        ├─ tienda.rutas.js · cuenta.rutas.js
│        └─ panel/                  productos · categorias · contenido · envios-y-pagos · pedidos · clientes · sistema
│
├─ pruebas/
│  ├─ ejecutar.js                   Corre las pruebas
│  ├─ ayudas/                       Servidor de prueba, cliente y navegador simulado
│  ├─ api/                          Pruebas del servidor
│  └─ pantallas/                    Pruebas de la tienda y del panel
│
└─ package.json · .gitignore · README.md
```

## Puesta en marcha

```
npm run instalar-todo     (solo la primera vez)
npm start                 (arma el sitio y enciende el servidor)
```
- Tienda: http://localhost:3000
- Panel: http://localhost:3000/admin

Otros comandos: `npm run armar` (solo generar el sitio) · `npm run desarrollo` (se rearma solo al guardar) · `npm test` (todas las pruebas).

> Abrí la tienda siempre desde http://localhost:3000. Si abrís un archivo con doble clic no cargan productos ni carrito, porque dependen del servidor.

## Cómo se trabaja con los componentes

Cada carpeta de `componentes/` tiene el mismo formato (como en Angular):

```
carrito/
├─ carrito.html     la estructura
├─ carrito.css      el diseño
└─ carrito.js       el comportamiento (importa su propio CSS)
```
Para **agregar una parte nueva** a la tienda: crear su carpeta, sumarla en `paginas/tienda.pagina.html` con `<!-- @include componentes/mi-parte/mi-parte.html -->` y llamar a su función de inicio desde `principal-tienda.js`. Los componentes no se llaman entre sí: se avisan con eventos (`on` / `emit` de `compartido/eventos.js`).

## Ingreso al panel (correo y contraseña)
Correo inicial: `admin@ikmates.com` · contraseña inicial: `ikmates2024`. Se cambian en **Ajustes** (*Correo de ingreso* y *Cambiar contraseña*). El correo es solo un dato de ingreso: el sistema no envía mails. Si lo olvidás, apagá el servidor, borrá la fila `admin_email` de la tabla `meta` de `backend/datos/ikmates.db` y vuelve el inicial. Variables opcionales para el primer arranque: `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

### Contraseña
La inicial es `ikmates2024`. **Cambiala apenas entres**: Ajustes → Cambiar contraseña. Mientras siga la inicial, el panel muestra un aviso rojo. Si la olvidás: apagá el servidor, borrá la fila `pw` de la tabla `meta` de `backend/datos/ikmates.db` y volvé a entrar con la inicial.

## Qué puede hacer ella en el panel

Cada pestaña empieza con una **guía corta** (3 pasos) y se puede ocultar con el botón *💡 Ayudas* de arriba. Las pestañas están en este orden: Inicio · Pedidos · Productos · Categorías · Publicidad · Envíos y pagos · Cupones · Clientes · Estadísticas · Ajustes.

| Pestaña | Funciones |
|---|---|
| **Inicio** | Resumen (pedidos nuevos, stock, clientes) y un mapa de qué hace cada parte. |
| **Productos** | Crear, editar, **duplicar**, ordenar y eliminar. Varias fotos. **Variantes** (color, virola…, con opciones agotables). **Stock en cantidades** (se descuenta con cada pedido y se devuelve al cancelar). Precio por mayor. Destacados. Buscador y filtros (incluye "poco stock"). Acciones sobre varios a la vez. **Cambio de precios** con vista previa. **Carga desde planilla** (CSV). |
| **Categorías** | Solo el nombre, en dos niveles (categoría y subcategoría). Ocultar, renombrar, ordenar. **Foto de portada** para "Comprá por categoría". |
| **Publicidad** | Publicidad de arriba (carrusel con fechas de inicio y fin) y mensajes de la barra en movimiento. |
| **Pedidos** | Cada pedido queda registrado con variantes, forma de pago, cupón y entrega (con provincia). Estados nuevo / atendido / cancelado. Debajo, las **solicitudes del botón de arrepentimiento**. |
| **Clientes** | Cuentas registradas, buscador, contraseña temporal si la olvidan, baja de cuenta. |
| **Envíos y pagos** | Formas de entrega (costo fijo, **a coordinar**, gratis, **gratis desde un monto**, **costo según la provincia**, pide dirección) y de pago (con **descuento**, ej: 10% por transferencia). |
| **Cupones** | Códigos de descuento (% o monto fijo) con compra mínima, vencimiento y cantidad de usos. Muestra cuántas veces se usó cada uno. |
| **Estadísticas** | Ventas por mes (últimos 6), productos más vendidos, formas de pago y entrega, provincias y cupones usados. Los pedidos cancelados no cuentan. |
| **Ajustes** | WhatsApp, horario, dirección, redes, textos de "Cómo comprar", **"Quiénes somos"** y **preguntas frecuentes**. Cambiar contraseña. **Respaldo** (.zip). |

**Fotos livianas:** toda foto que se sube desde el panel (productos, publicidad, categorías) se achica sola en el navegador antes de subirla (máximo 1600 px, JPG): una foto de celular de 4-5 MB queda en ~200 KB.

### Compras (lo que ve el cliente)
- Si un producto tiene variantes, elige color/virola antes de agregar.
- Si tiene poco stock, ve "¡Últimas N unidades!". Si se agota, no puede comprarlo.
- En el carrito elige cómo recibir el pedido y cómo pagar; los totales (descuento, envío, mayorista) los calcula **el servidor**, nunca el navegador.
- El pedido queda registrado y se abre WhatsApp con el detalle completo.

### Carga desde planilla
Productos → *Cargar desde planilla* → *Descargar plantilla de ejemplo*. Columnas obligatorias: `categoria`, `nombre`, `precio`. Opcionales: `descripcion`, `etiqueta`, `stock`, `opciones` (ej: `Color: Negro|Rojo; Virola: Acero|Alpaca`), `sin_stock`, `destacado`, `precio_mayorista`, `minimo_mayorista`. Guardar como **CSV**. Subcategoría: `Mates > Clásicos`. Acepta precios argentinos (`18.600,00`).

## Cuentas de clientes
Ingresar / Crear cuenta (con el logo). Comprar **no exige** cuenta. Contraseñas con hash (scrypt), límite de intentos, mensaje de error igual exista o no el email. No se envían emails: si olvidan la contraseña, la dueña genera una temporal desde el panel. Al guardar datos personales conviene sumar una política de privacidad al publicar.

## Pensada para vender
- **Ofertas:** en el producto, "Precio anterior" → la tienda lo muestra tachado con el % de descuento (−20%) y el ahorro.
- **Descuento por forma de pago** (ej: 10% por transferencia): se destaca en la barra en movimiento, en cada tarjeta ("$900 con transferencia") y en la ficha. Sale de lo cargado en *Envíos y pagos*.
- **Envío gratis desde un monto:** se destaca en la barra en movimiento y el carrito muestra una barra "Te faltan $X para envío gratis".
- **Ficha del producto:** cantidad, total en el botón, consulta por WhatsApp de ese producto, garantías de compra y productos relacionados. Al agregar se abre el carrito para terminar la compra.
- **Celular:** barra fija "Ver mi pedido · total", botón de compra fijo en la ficha y recordatorio si dejó productos en el carrito.
- **Orden de la tienda:** nombre de la marca → barra en movimiento → publicidad (carrusel) → beneficios → "Comprá por categoría" → productos. No hay portada con texto grande: arriba va la publicidad que ella carga.
- **Cada categoría y cada producto tienen su página** (`/categoria/mates`, `/producto/12`) con migas de pan, botón "atrás" y link para compartir. La categoría permite ordenar por precio y ver sus subcategorías.

## Buscadores y compartir el link
- Cada producto tiene su propio link (`/producto/12`): al abrirlo se muestra su ficha, y al pegarlo en WhatsApp o Instagram sale con foto, nombre y precio.
- `/sitemap.xml` y `/robots.txt` se generan solos (el panel queda excluido). Datos estructurados para Google (producto, precio, stock, local).
- **Política de privacidad** (`/privacidad`) y **Términos** (`/terminos`): ella los edita en Ajustes → Textos legales. Son un texto base: conviene que los revise un profesional.
- **Botón de arrepentimiento** (`/arrepentimiento`, Resolución 424/2020): está en el pie de todas las páginas. El cliente completa nombre y contacto, recibe un código (ARR-000001) y la solicitud aparece en Panel → Pedidos.
- **Defensa del Consumidor:** link al formulario oficial de reclamos en el pie. Falta el **QR de data fiscal** de ARCA: lo tiene que generar la dueña con su clave fiscal.
- Al publicar con dominio propio, definir la variable `SITE_URL` (ej: `https://ikmates.com.ar`) para que los links del sitemap y de las vistas previas salgan con ese dominio.

## Pruebas
`npm test` arma el sitio y corre las pruebas (~80): el servidor (login, productos, variantes, stock, envíos, descuentos, cuentas, respaldo, seguridad) y las pantallas de la tienda y del panel en un navegador simulado. Cada archivo de pruebas levanta su propio servidor con una base de datos temporal: no tocan los datos reales.

## Datos y respaldo
- **Respaldo:** panel → Ajustes → *Descargar respaldo* (.zip con la base y las fotos). También se pueden copiar `backend/datos/` y `backend/fotos-subidas/`.
- Estas dos carpetas y `frontend/armado/` están en `.gitignore`: no se suben a un repositorio.

## Publicar online
Necesita un hosting con **Node.js** y **disco persistente** para `backend/datos/` y `backend/fotos-subidas/` (Render, Railway, un VPS). Comando de inicio: `npm start`. Si el hosting da HTTPS, la sesión del panel se marca como segura sola. Variables opcionales: `SITE_URL`, `PORT`, `ADMIN_PASSWORD` (contraseña inicial), `DATA_DIR`, `UPLOAD_DIR`.
