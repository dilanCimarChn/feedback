export function leerComoDataUrl(archivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`No fue posible leer el archivo ${archivo.name}.`));
    reader.readAsDataURL(archivo);
  });
}

// Redimensiona y comprime a JPEG para no superar el límite de tamaño del servidor
export async function comprimirImagen(archivo, { lado = 1280, calidad = 0.82 } = {}) {
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No fue posible abrir la imagen ${archivo.name}.`));
      img.src = url;
    });

    const escala = Math.min(1, lado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(imagen.naturalWidth * escala);
    canvas.height = Math.round(imagen.naturalHeight * escala);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', calidad);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const esImagen = archivo => /^image\/(png|jpe?g|webp)$/.test(archivo.type);
