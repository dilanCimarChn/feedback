const CLAVE_CODIGO = 'agente-feedback:codigo-acceso';

let solicitarCodigo = null;
let codigoPendiente = null;

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
    response = await fetch(ruta, { method: 'POST', headers, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(70000) });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('El servidor tardó demasiado. Reintenta; tu calendario guardado se conserva.');
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
    if (!codigoPendiente) codigoPendiente = Promise.resolve().then(() => solicitarCodigo(codigo ? 'El código ingresado no es válido.' : '')).finally(() => { codigoPendiente = null; });
    const nuevoCodigo = await codigoPendiente;
    if (nuevoCodigo) {
      guardarCodigo(nuevoCodigo);
      return llamarApi(ruta, cuerpo, true);
    }
  }

  if (!response.ok) {
    const espera = Number(data?.reintentarEn || response.headers?.get('retry-after'));
    let mensaje = data?.error;
    if (!mensaje && response.status === 404) {
      mensaje = 'Esta función todavía no está disponible en el servidor conectado. Actualiza o despliega el backend y vuelve a intentarlo.';
      if (import.meta.env?.DEV) mensaje += ' Para probar los cambios locales utiliza npm run dev:local; el modo conectado a producción necesita la nueva versión publicada.';
    }
    const error = new Error(mensaje || 'Ocurrió un problema al procesar la solicitud. Inténtalo de nuevo.');
    error.status = response.status;
    if (Number.isFinite(espera) && espera > 0) {
      error.reintentarEn = Math.ceil(espera);
      error.message += ` Vuelve a intentar en ${error.reintentarEn} segundos.`;
    }
    throw error;
  }
  return data;
}
