// Conexión a SQLite (sql.js) y helpers de consulta.
// sql.js trabaja en memoria: después de cada escritura se guarda el archivo completo.
const fs = require("fs");
const initSqlJs = require("sql.js");
const { DATA_DIR, DB_FILE } = require("../configuracion");

let db = null;

async function open() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
  return db;
}

// Guarda en un archivo temporal y lo renombra: si el programa se corta a mitad, no queda la base rota.
function persist() {
  const data = Buffer.from(db.export());
  const tmp = DB_FILE + ".tmp";
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    fs.writeFileSync(DB_FILE, data); // algunos sistemas de archivos no permiten renombrar encima
  }
}

/** Devuelve todas las filas de una consulta como objetos. */
function all(sql, params = []) {
  const st = db.prepare(sql);
  st.bind(params);
  const rows = [];
  while (st.step()) rows.push(st.getAsObject());
  st.free();
  return rows;
}
const one = (sql, params = []) => all(sql, params)[0];

/** Ejecuta sin guardar (para agrupar varias escrituras y guardar una sola vez con persist()). */
const exec = (sql, params = []) => db.run(sql, params);

/** Ejecuta, guarda y devuelve el id insertado. */
function run(sql, params = []) {
  db.run(sql, params);
  const id = one("SELECT last_insert_rowid() AS id").id;
  persist();
  return id;
}

/** Agrupa varias escrituras: se guarda una sola vez al final. */
function write(fn) {
  const out = fn();
  persist();
  return out;
}

const hasCol = (table, col) => all(`PRAGMA table_info(${table})`).some((c) => c.name === col);
const addCol = (table, col, def) => { if (!hasCol(table, col)) exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); };
const getMeta = (k) => (one("SELECT v FROM meta WHERE k=?", [k]) || {}).v;
const setMeta = (k, v) => exec("INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", [k, v]);

module.exports = { open, persist, all, one, exec, run, write, hasCol, addCol, getMeta, setMeta };
