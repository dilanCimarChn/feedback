import { createHash } from 'node:crypto';

export class ErrorServicio extends Error {
  constructor(message, status = 503, retryAfter = 5) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function responderErrorServicio(res, error) {
  if (!(error instanceof ErrorServicio)) return false;
  res.setHeader?.('Retry-After', String(error.retryAfter));
  res.status(error.status).json({ error: error.message, reintentarEn: error.retryAfter });
  return true;
}

// Límites locales a cada proceso: no sustituyen una cola distribuida del despliegue.
export function crearLimitador({ concurrencia = 8, colaMaxima = 100, esperaMs = 8000 } = {}) {
  let activos = 0;
  const cola = [];
  function liberar() {
    const siguiente = cola.shift();
    if (siguiente) { clearTimeout(siguiente.timer); siguiente.resolve(); }
    else activos--;
  }
  return async tarea => {
    if (activos < concurrencia) activos++;
    else {
      if (cola.length >= colaMaxima) throw new ErrorServicio('Hay muchas solicitudes. Intenta de nuevo en unos segundos.');
      await new Promise((resolve, reject) => {
        const entrada = { resolve };
        entrada.timer = setTimeout(() => {
          cola.splice(cola.indexOf(entrada), 1);
          reject(new ErrorServicio('El servicio está ocupado. Tu calendario guardado se conserva.'));
        }, esperaMs);
        cola.push(entrada);
      });
    }
    try { return await tarea(); } finally { liberar(); }
  };
}

// Agrupa solicitudes idénticas en curso y acota tanto resultados como trabajos pendientes.
export function crearCacheAsync({ max = 100, pendientesMax = 100, ttlMs = 900000, ahora = Date.now } = {}) {
  const resultados = new Map(), pendientes = new Map();
  return function consultar(clave, cargar, duracion = ttlMs) {
    const previo = resultados.get(clave);
    if (previo && previo.hasta > ahora()) return Promise.resolve(previo.valor);
    resultados.delete(clave);
    if (pendientes.has(clave)) return pendientes.get(clave);
    if (pendientes.size >= pendientesMax) return Promise.reject(new ErrorServicio('Las fuentes están ocupadas. Intenta de nuevo en unos segundos.'));
    const promesa = Promise.resolve().then(cargar).then(valor => {
      const ttl = typeof duracion === 'function' ? duracion(valor) : duracion;
      if (ttl > 0) {
        if (resultados.size >= max) resultados.delete(resultados.keys().next().value);
        resultados.set(clave, { valor, hasta: ahora() + ttl });
      }
      return valor;
    }).finally(() => pendientes.delete(clave));
    pendientes.set(clave, promesa);
    return promesa;
  };
}

export const limitarFuentes = crearLimitador({ concurrencia: 12, colaMaxima: 100, esperaMs: 2000 });

// Invalida consultas al cambiar cuentas o credenciales sin guardarlas en las claves.
export const huella = valores => createHash('sha256').update(JSON.stringify(valores)).digest('hex');
