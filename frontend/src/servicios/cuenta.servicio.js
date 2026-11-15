// Cuenta del cliente: registro, ingreso, salida y sus pedidos.
import { get, post } from "../compartido/peticiones.js";
import { state, emit } from "./estado.js";

export async function loadAccount() {
  try {
    state.account = (await get("/api/account/me")).customer || null;
  } catch (e) {
    state.account = null;
  }
  emit("account");
}

async function enter(url, data) {
  state.account = (await post(url, data)).customer;
  emit("account");
  return state.account;
}
export const register = (data) => enter("/api/account/register", data);
export const login = (data) => enter("/api/account/login", data);

export async function logout() {
  try { await post("/api/account/logout"); } catch (e) { /* igual se cierra acá */ }
  state.account = null;
  emit("account");
}

export const myOrders = () => get("/api/account/orders");
