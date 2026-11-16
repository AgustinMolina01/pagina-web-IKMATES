// Tablas, migraciones y datos iniciales. Se puede ejecutar muchas veces sin problema.
const crypto = require("crypto");
const { one, exec, addCol, getMeta, setMeta, persist } = require("./conexion");

function createTables() {
  exec(`CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)`);
  exec(`CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT)`);

  exec(`CREATE TABLE IF NOT EXISTS categories(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1)`);
  addCol("categories", "parent_id", "INTEGER");
  addCol("categories", "image", "TEXT DEFAULT ''"); // foto de portada en "Comprá por categoría"

  exec(`CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price INTEGER NOT NULL,
    image TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  addCol("products", "sold_out", "INTEGER DEFAULT 0");
  addCol("products", "wholesale_price", "INTEGER");
  addCol("products", "old_price", "INTEGER"); // precio anterior (tachado) para mostrar ofertas
  addCol("products", "wholesale_min", "INTEGER");
  addCol("products", "featured", "INTEGER DEFAULT 0");
  addCol("products", "sort", "INTEGER DEFAULT 0");
  addCol("products", "images", "TEXT DEFAULT '[]'");
  addCol("products", "stock", "INTEGER");            // NULL = sin control de cantidad
  addCol("products", "options", "TEXT DEFAULT '[]'"); // variantes: [{ name, values:[{label, soldOut}] }]
  exec("UPDATE products SET sort=id WHERE sort IS NULL OR sort=0");

  exec(`CREATE TABLE IF NOT EXISTS announcements(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    active INTEGER DEFAULT 1)`);

  exec(`CREATE TABLE IF NOT EXISTS banners(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image TEXT NOT NULL,
    title TEXT DEFAULT '',
    link TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  addCol("banners", "start_date", "TEXT DEFAULT ''");
  addCol("banners", "end_date", "TEXT DEFAULT ''");

  exec(`CREATE TABLE IF NOT EXISTS customers(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT DEFAULT '',
    pw TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);

  exec(`CREATE TABLE IF NOT EXISTS orders(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    items TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT DEFAULT 'nuevo')`);
  addCol("orders", "customer_id", "INTEGER");
  addCol("orders", "details", "TEXT DEFAULT '{}'"); // subtotal, descuento, envío y forma de pago

  exec(`CREATE TABLE IF NOT EXISTS shipping_methods(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price INTEGER,            -- NULL = a coordinar por WhatsApp
    free_from INTEGER,        -- envío gratis si la compra llega a este monto
    needs_address INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    sort INTEGER DEFAULT 0)`);

  exec(`CREATE TABLE IF NOT EXISTS payment_methods(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    discount INTEGER DEFAULT 0, -- % de descuento sobre los productos
    active INTEGER DEFAULT 1,
    sort INTEGER DEFAULT 0)`);
  // Costo por provincia: {"Santa Fe": 3000, "Córdoba": 5000, …}. Vacío = costo único (columna price).
  addCol("shipping_methods", "province_prices", "TEXT DEFAULT ''");

  // Botón de arrepentimiento (Resolución 424/2020): pedidos de cancelación de una compra
  exec(`CREATE TABLE IF NOT EXISTS withdrawals(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,     -- email o WhatsApp
    order_ref TEXT DEFAULT '', -- número de pedido, si lo sabe
    reason TEXT DEFAULT '',
    status TEXT DEFAULT 'nueva')`);

  // Cupones de descuento
  exec(`CREATE TABLE IF NOT EXISTS coupons(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    kind TEXT NOT NULL DEFAULT 'percent', -- 'percent' (%) o 'amount' ($)
    value INTEGER NOT NULL,
    min_total INTEGER,          -- compra mínima para usarlo
    max_uses INTEGER,           -- NULL = sin límite
    uses INTEGER DEFAULT 0,
    expires TEXT DEFAULT '',    -- AAAA-MM-DD, último día válido
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
}

// Datos iniciales (una sola vez; si ella los borra, no vuelven a aparecer).
function seed() {
  if (!getMeta("secret")) setMeta("secret", crypto.randomBytes(32).toString("hex"));
  if (!getMeta("csecret")) setMeta("csecret", crypto.randomBytes(32).toString("hex"));

  if (one("SELECT COUNT(*) AS n FROM categories").n === 0) {
    [["mates", "Mates"], ["yerba", "Yerba"], ["combos", "Combos"]]
      .forEach((c, i) => exec("INSERT INTO categories(slug,name,sort) VALUES(?,?,?)", [c[0], c[1], i + 1]));
  }
  if (!getMeta("banners_seeded")) {
    [["/img/banner-2x1.png", "Promoción 2x1", "#mates"], ["/img/banner-cybermonday.png", "Cyber Monday", "#mates"]]
      .forEach((b) => exec("INSERT INTO banners(image,title,link) VALUES(?,?,?)", b));
    setMeta("banners_seeded", "1");
  }
  if (!getMeta("promo_banners_migrated")) {
    const anteriores = ["/img/banner-combos.svg", "/img/banner-yerba.svg", "/img/banner-mates.svg"];
    if (one("SELECT COUNT(*) AS n FROM banners WHERE image IN (?,?,?)", anteriores).n) {
      exec("DELETE FROM banners WHERE image IN (?,?,?)", anteriores);
      [["/img/banner-2x1.png", "Promoción 2x1", "#mates"], ["/img/banner-cybermonday.png", "Cyber Monday", "#mates"]]
        .forEach((b) => exec("INSERT INTO banners(image,title,link) VALUES(?,?,?)", b));
    }
    setMeta("promo_banners_migrated", "1");
  }
  if (one("SELECT COUNT(*) AS n FROM announcements").n === 0) {
    ["ENVÍOS A TODO EL PAÍS", "COMBOS LISTOS PARA REGALAR", "PEDÍ POR WHATSAPP Y TE ASESORAMOS"]
      .forEach((t) => exec("INSERT INTO announcements(text) VALUES(?)", [t]));
  }
  if (one("SELECT COUNT(*) AS n FROM products").n === 0) {
    const demo = [
      ["mates", "Mate Imperial", "Cuero y alpaca, virola reforzada. Un clásico elegante.", 28500, "Más vendido"],
      ["mates", "Mate Calabaza", "Calabaza natural curada, boca ancha, ideal para el día a día.", 14900, ""],
      ["yerba", "Yerba Tradicional 1 kg", "Sabor equilibrado, con palo, molienda clásica.", 7900, ""],
      ["yerba", "Yerba Suave 1 kg", "Sin palo, más suave y de gran rendimiento.", 8600, "Suave"],
      ["combos", "Combo Inicio", "Mate calabaza + bombilla + 500 g de yerba.", 21900, "Ideal regalo"],
      ["combos", "Combo Imperial", "Mate imperial + bombilla de alpaca + 1 kg de yerba.", 37500, ""],
    ];
    demo.forEach((p, i) => exec("INSERT INTO products(category,name,description,price,tag,sort) VALUES(?,?,?,?,?,?)", [...p, i + 1]));
  }
  if (!getMeta("checkout_seeded")) {
    exec("INSERT INTO shipping_methods(name,description,price,needs_address,sort) VALUES(?,?,?,?,?)", ["Retiro en el local", "Retirás tu pedido sin costo.", 0, 0, 1]);
    exec("INSERT INTO shipping_methods(name,description,price,needs_address,sort) VALUES(?,?,?,?,?)", ["Envío a domicilio", "El costo se coordina por WhatsApp según tu zona.", null, 1, 2]);
    exec("INSERT INTO payment_methods(name,description,discount,sort) VALUES(?,?,?,?)", ["Transferencia bancaria", "Te pasamos los datos por WhatsApp.", 0, 1]);
    exec("INSERT INTO payment_methods(name,description,discount,sort) VALUES(?,?,?,?)", ["Efectivo", "Pagás al retirar o al recibir.", 0, 2]);
    setMeta("checkout_seeded", "1");
  }
}

function migrate() {
  createTables();
  seed();
  persist();
}

module.exports = { migrate };
