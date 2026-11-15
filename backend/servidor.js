// Punto de entrada: prepara la base de datos y enciende el servidor.
const { PORT } = require("./codigo/configuracion");
const db = require("./codigo/base-de-datos/conexion");
const { migrate } = require("./codigo/base-de-datos/esquema");
const { usingInitialPassword } = require("./codigo/intermedios/autenticacion");
const { createApp } = require("./codigo/aplicacion");

async function main() {
  await db.open();
  migrate();
  createApp().listen(PORT, () => {
    console.log(`IK Mates en http://localhost:${PORT}  |  Admin: http://localhost:${PORT}/admin`);
    if (usingInitialPassword()) console.log("⚠  Usando la contraseña inicial. Cambiala desde el panel (Ajustes) antes de publicar.");
  });
}

main().catch((err) => {
  console.error("No se pudo iniciar el servidor:", err);
  process.exit(1);
});
