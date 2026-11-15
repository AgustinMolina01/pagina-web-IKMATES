// Avisos entre componentes: quien cambia algo avisa con emit("evento"); quien necesita enterarse escucha con on("evento", fn).
// Así los componentes no dependen unos de otros.
const escuchas = new Map();

export function on(evento, fn) {
  if (!escuchas.has(evento)) escuchas.set(evento, []);
  escuchas.get(evento).push(fn);
}

export function emit(evento, dato) {
  (escuchas.get(evento) || []).forEach((fn) => fn(dato));
}
