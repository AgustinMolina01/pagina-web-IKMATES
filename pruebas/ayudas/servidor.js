// Levanta un servidor real con base de datos temporal y en un puerto libre, para cada archivo de pruebas.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

async function startServer(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ikmates-test-"));
  const port = 3200 + Math.floor(Math.random() * 700);
  const child = spawn(process.execPath, [path.join(ROOT, "backend", "servidor.js")], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, UPLOAD_DIR: path.join(dir, "fotos-subidas"), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));

  const base = `http://localhost:${port}`;
  const deadline = Date.now() + 15000;
  for (;;) {
    try { if ((await fetch(base + "/api/site")).ok) break; } catch (e) { /* todavía arrancando */ }
    if (Date.now() > deadline) { child.kill(); throw new Error("El servidor no arrancó:\n" + log); }
    await new Promise((r) => setTimeout(r, 150));
  }
  return {
    base, dir,
    stop: () => new Promise((resolve) => {
      child.once("exit", () => { fs.rmSync(dir, { recursive: true, force: true }); resolve(); });
      child.kill();
    }),
  };
}

module.exports = { startServer, ROOT };
