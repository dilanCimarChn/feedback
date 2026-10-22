const CLAVE_CODIGO = 'agente-feedback:codigo-acceso';

let solicitarCodigo = null;

// La app registra aquí la función que muestra el modal de código de acceso
export function registrarSolicitudCodigo(fn) {
  solicitarCodigo = fn;
}

function leerCodigo() {
  try {
    return localStorage.getItem(CLAVE_CODIGO) || '';
  } catch {
    return '';
  }
}

function guardarCodigo(codigo) {
  try {
    localStorage.setItem(CLAVE_CODIGO, codigo);
  } catch {
    // Si no hay almacenamiento, se pedirá de nuevo la próxima vez
  }
}

export async function llamarApi(ruta, cuerpo, reintento = false) {
  const headers = { 'Content-Type': 'application/json' };
  const codigo = leerCodigo();
  if (codigo) headers['x-codigo-acceso'] = codigo;

  let response;
  try {
    response = await fetch(ruta, { method: 'POST', headers, body: JSON.stringify(cuerpo) });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }

  if (response.status === 413) {
    throw new Error('Los archivos son demasiado pesados. Sube menos imágenes o un manual más liviano.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Respuesta sin JSON; se maneja con el mensaje genérico
  }

  if (response.status === 401 && data?.codigoRequerido && solicitarCodigo && !reintento) {
    const nuevoCodigo = await solicitarCodigo(codigo ? 'El código ingresado no es válido.' : '');
    if (nuevoCodigo) {
      guardarCodigo(nuevoCodigo);
      return llamarApi(ruta, cuerpo, true);
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Ocurrió un problema al procesar la solicitud. Inténtalo de nuevo.');
  }
  return data;
}
