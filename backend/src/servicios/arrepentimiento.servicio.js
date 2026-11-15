// Botón de arrepentimiento (Resolución 424/2020 de la Secretaría de Comercio Interior):
// el cliente pide cancelar una compra desde la tienda y recibe un código para seguirla.
const { all, run, exec, persist } = require("../base-de-datos/conexion");
const { text, oneLine } = require("../utilidades/validacion");

const STATUSES = ["nueva", "resuelta"];

/** "ARR-000012": el código que se le muestra al cliente. */
const codeFor = (id) => "ARR-" + String(id).padStart(6, "0");

const withdrawalRow = (r) => ({
  id: r.id, code: codeFor(r.id), created_at: r.created_at, name: r.name, contact: r.contact,
  orderRef: r.order_ref, reason: r.reason, status: r.status,
});

/** Registra la solicitud. Devuelve { id, code } o { error }. */
function createWithdrawal(b = {}) {
  const name = oneLine(b.name, 80), contact = oneLine(b.contact, 120);
  if (name.length < 3) return { error: "Escribí tu nombre y apellido" };
  if (contact.length < 6) return { error: "Dejanos un email o WhatsApp para contactarte" };
  const id = run("INSERT INTO withdrawals(name,contact,order_ref,reason) VALUES(?,?,?,?)",
    [name, contact, oneLine(b.orderRef, 40), text(b.reason, 1000)]);
  return { id, code: codeFor(id) };
}

const listWithdrawals = () => all("SELECT * FROM withdrawals ORDER BY id DESC LIMIT 300").map(withdrawalRow);

function setWithdrawalStatus(id, status) {
  if (!STATUSES.includes(status)) return false;
  exec("UPDATE withdrawals SET status=? WHERE id=?", [status, id]);
  persist();
  return true;
}

function removeWithdrawal(id) {
  exec("DELETE FROM withdrawals WHERE id=?", [id]);
  persist();
}

module.exports = { createWithdrawal, listWithdrawals, setWithdrawalStatus, removeWithdrawal, codeFor };
