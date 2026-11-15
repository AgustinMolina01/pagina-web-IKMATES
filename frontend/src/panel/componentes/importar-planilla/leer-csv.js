// Lee un archivo CSV (el que guarda Excel o Google Sheets) y lo convierte en filas de productos.

// Nombres de columna aceptados → nombre interno
const COLUMNAS = {
  categoria: "categoria", nombre: "nombre", producto: "nombre", titulo: "nombre", precio: "precio", descripcion: "descripcion", etiqueta: "etiqueta",
  stock: "stock", cantidad: "stock", opciones: "opciones", variantes: "opciones",
  sin_stock: "sin_stock", agotado: "sin_stock", destacado: "destacado",
  precio_mayorista: "precio_mayorista", mayorista: "precio_mayorista",
  minimo_mayorista: "minimo_mayorista", cantidad_mayorista: "minimo_mayorista", minimo: "minimo_mayorista",
};

/** "Categoría" → "categoria" (sin acentos, minúsculas, guiones bajos). */
const claveColumna = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Texto CSV → matriz de filas. Entiende ";" (Excel en español) y ",", comillas y saltos de línea dentro de comillas. */
export function leerCsv(texto) {
  texto = texto.replace(/^﻿/, ""); // marca de Excel
  const primera = texto.split(/\r?\n/)[0] || "";
  const separador = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ";" : ",";
  const filas = [];
  let fila = [], celda = "", entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') { if (texto[i + 1] === '"') { celda += '"'; i++; } else entreComillas = false; }
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === separador) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda);
      if (fila.some((x) => x.trim())) filas.push(fila);
      fila = []; celda = "";
    } else celda += c;
  }
  fila.push(celda);
  if (fila.some((x) => x.trim())) filas.push(fila);
  return filas;
}

/** Matriz → lista de productos { categoria, nombre, precio, … }. Lanza un Error claro si faltan columnas. */
export function productosDesdeCsv(texto) {
  const tabla = leerCsv(texto);
  if (tabla.length < 2) throw new Error("La planilla está vacía o no tiene filas debajo de los títulos.");
  const columnas = tabla[0].map((t) => COLUMNAS[claveColumna(t)] || null);
  if (!["nombre", "precio", "categoria"].every((c) => columnas.includes(c))) {
    throw new Error("Faltan columnas. La primera fila debe tener al menos: categoria, nombre y precio. Bajá la plantilla de ejemplo.");
  }
  return tabla.slice(1).map((fila) => {
    const producto = {};
    columnas.forEach((col, i) => { if (col) producto[col] = (fila[i] || "").trim(); });
    return producto;
  });
}

export const PLANTILLA =
  "﻿categoria;nombre;descripcion;precio;etiqueta;stock;opciones;sin_stock;destacado;precio_mayorista;minimo_mayorista\r\n" +
  "Mates;Mate Imperial;Cuero y alpaca;28500;Más vendido;12;Color: Negro|Rojo;;si;24000;6\r\n" +
  "Mate Uruguayo > Camionero Uruguayo;Camionero negro;Virola de acero;17900;;;;;;;\r\n" +
  "Yerbas;Yerba Canarias 1 kg;;13000;;;;si;;;\r\n";
