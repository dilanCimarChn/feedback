const CLAVE = 'agente-feedback:configuracion:v1';

export const PERFIL_VACIO = {
  nombre: '',
  descripcion: '',
  colores: [],
  tipografias: { titulos: '', cuerpo: '', notas: '' },
  tono: '',
  publico: '',
  emojis: 'moderado',
  palabras_clave: [],
  palabras_prohibidas: [],
  hashtags: [],
  estilo_visual: '',
  logo: '',
  margenes: 'Dejar al menos 24px libres entre textos o logo y los bordes.',
  referencias: []
};

export const COMPORTAMIENTO_BASE = {
  exigencia: 'equilibrado',
  modo: 'aprobar',
  detalle: 'breve',
  revisar: { margenes: true, colores: true, contexto: true, tipografia: true, gramatica: true },
  redes: ['Instagram'],
  instrucciones: ''
};

export function normalizarConfiguracion(datos) {
  const perfil = datos?.perfil || {};
  const comportamiento = datos?.comportamiento || {};
  return {
    perfil: {
      ...PERFIL_VACIO,
      ...perfil,
      tipografias: { ...PERFIL_VACIO.tipografias, ...perfil.tipografias }
    },
    comportamiento: {
      ...COMPORTAMIENTO_BASE,
      ...comportamiento,
      revisar: { ...COMPORTAMIENTO_BASE.revisar, ...comportamiento.revisar }
    }
  };
}

export function cargarConfiguracion() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return guardado ? normalizarConfiguracion(JSON.parse(guardado)) : null;
  } catch {
    return null;
  }
}

export function guardarConfiguracion(configuracion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(configuracion));
    return true;
  } catch {
    return false;
  }
}

export function borrarConfiguracion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento disponible no hay nada que borrar
  }
}

export function exportarConfiguracion(configuracion) {
  const nombre = (configuracion.perfil.nombre || 'mi-marca')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const blob = new Blob([JSON.stringify(configuracion, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `configuracion-${nombre || 'marca'}.json`;
  enlace.click();
  URL.revokeObjectURL(url);
}

export async function importarConfiguracion(archivo) {
  const datos = JSON.parse(await archivo.text());
  if (!datos || typeof datos !== 'object' || !datos.perfil) {
    throw new Error('El archivo no es una configuración de marca válida.');
  }
  return normalizarConfiguracion(datos);
}
