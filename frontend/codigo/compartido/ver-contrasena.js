// Botón "Ver / Ocultar" en los campos de contraseña (para que se pueda comprobar lo que se escribió).
import "../estilos/campo-clave.css";

/** Agrega el botón a cada campo de contraseña que todavía no lo tenga dentro de `raiz`. */
export function activarVerContrasena(raiz = document) {
  raiz.querySelectorAll('input[type="password"]').forEach((campo) => {
    if (campo.closest(".clave-wrap")) return;

    const envoltorio = document.createElement("span");
    envoltorio.className = "clave-wrap";
    // El envoltorio toma el espacio de abajo del campo, así el botón queda centrado en el campo y no en el margen
    envoltorio.style.marginBottom = getComputedStyle(campo).marginBottom;
    campo.style.marginBottom = "0";
    campo.parentNode.insertBefore(envoltorio, campo);
    envoltorio.appendChild(campo);

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "clave-ojo";
    boton.textContent = "Ver";
    boton.setAttribute("aria-label", "Mostrar la contraseña");
    boton.setAttribute("aria-pressed", "false");
    boton.addEventListener("click", () => {
      const visible = campo.type === "password";
      campo.type = visible ? "text" : "password";
      boton.textContent = visible ? "Ocultar" : "Ver";
      boton.setAttribute("aria-label", visible ? "Ocultar la contraseña" : "Mostrar la contraseña");
      boton.setAttribute("aria-pressed", String(visible));
      campo.focus();
    });
    envoltorio.appendChild(boton);
  });
}
