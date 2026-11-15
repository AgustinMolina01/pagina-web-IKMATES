// Subida de fotos desde el panel. Antes de subirla, la foto se achica en el navegador:
// una foto de celular de 4-5 MB queda en ~200 KB (máximo 1600 px de lado, JPG de buena calidad).
// Así la tienda carga rápido en el celular y rinde mejor en Google.
import { request } from "../../compartido/peticiones.js";

const LADO_MAXIMO = 1600;
const CALIDAD = 0.82;

/** Carga la imagen del archivo (respetando la orientación de la foto del celular). */
async function leerImagen(archivo) {
  if (window.createImageBitmap) return createImageBitmap(archivo, { imageOrientation: "from-image" });
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

/** Devuelve una versión más liviana de la foto, o la original si no hace falta (o si algo falla). */
export async function achicarFoto(archivo) {
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return archivo; // GIF u otros: tal cual
    const img = await leerImagen(archivo);
    const ancho = img.width, alto = img.height;
    const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));
    // Chica y liviana: no se toca (así un PNG con fondo transparente queda igual)
    if (escala === 1 && archivo.size < 400 * 1024) return archivo;
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(ancho * escala);
    lienzo.height = Math.round(alto * escala);
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#fff"; // las partes transparentes quedan blancas en el JPG
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", CALIDAD));
    if (!blob || blob.size >= archivo.size) return archivo; // si no ganamos nada, va la original
    return new File([blob], archivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return archivo; // navegador sin soporte: se sube la original (el servidor igual limita a 5 MB)
  }
}

/** Achica y sube una foto. Devuelve la dirección pública (/uploads/…). */
export async function subirFoto(archivo) {
  const datosForm = new FormData();
  datosForm.append("image", await achicarFoto(archivo));
  return (await request("POST", "/api/admin/upload", datosForm)).url;
}
