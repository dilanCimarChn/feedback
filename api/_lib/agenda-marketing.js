import { REDES, DIAS } from '../../src/lib/marketing.js';
import { resumirHistorico } from './precision-marketing.js';

const DIA = 86400000;
const PESOS = [30, 25, 18, 12, 9, 6];
const FORMATOS = {
  Facebook: ['Reel', 'Carrusel', 'Imagen', 'Historia'],
  Instagram: ['Carrusel', 'Reel', 'Historia', 'Imagen'],
  TikTok: ['Clip'], X: ['Texto', 'Imagen', 'Clip'],
  LinkedIn: ['Carrusel', 'Imagen', 'Clip'], YouTube: ['Clip']
};
// Franjas editoriales para comparar, sin atribuirles actividad de audiencia medida.
const HORAS_PRUEBA = {
  Facebook: ['09:00', '13:00', '18:00'], Instagram: ['12:00', '18:00', '20:00'],
  TikTok: ['13:00', '19:00', '21:00'], X: ['09:00', '12:00', '17:00'],
  LinkedIn: ['08:30', '12:30', '17:30'], YouTube: ['12:00', '18:00', '20:00']
};

function fechaValida(fecha) {
  return typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    Number.isFinite(Date.parse(fecha)) && new Date(fecha).toISOString().slice(0, 10) === fecha;
}

function cuotas(total, diasConPublicaciones, redes) {
  const cantidades = redes.map((_, i) => i < total ? 1 : 0);
  const pesos=redes.map(r=>PESOS[REDES.indexOf(r)]);
  for (let n = Math.min(total, redes.length); n < total; n++) {
    let elegida = -1;
    for (let i = 0; i < redes.length; i++) {
      if (cantidades[i] >= diasConPublicaciones) continue;
      if (elegida < 0 || pesos[i] / (cantidades[i] + 1) > pesos[elegida] / (cantidades[elegida] + 1)) elegida = i;
    }
    if (elegida < 0) throw new Error('No hay suficientes días para esa cantidad de publicaciones.');
    cantidades[elegida]++;
  }
  return cantidades;
}

// Gale-Ryser: las cuotas restantes deben caber sin repetir una red el mismo día.
function cabenCuotas(restantes, limites) {
  const ordenadas = [...restantes].sort((a, b) => b - a);
  let acumulado = 0;
  for (let k = 1; k <= restantes.length; k++) {
    acumulado += ordenadas[k - 1];
    if (acumulado > limites[k]) return false;
  }
  return true;
}

function distribuirRedes(fechas, cantidades, total, redes) {
  let restantes = [...cantidades], procesadas = 0;
  // Para cada sufijo de fechas, capacidad disponible para cualquier grupo de k redes.
  const limites = Array(fechas.length + 1);
  limites[fechas.length] = Array(redes.length + 1).fill(0);
  for (let d = fechas.length - 1; d >= 0; d--) {
    limites[d] = limites[d + 1].map((limite, k) => limite + Math.min(k, fechas[d].cantidad));
  }
  for (let d = 0; d < fechas.length; d++) {
    const dia = fechas[d], avance = procesadas + dia.cantidad;
    let mejor = null, mejorPuntaje = -Infinity;
    // Seis redes implican como máximo 20 combinaciones del tamaño requerido.
    for (let mascara = 1; mascara < 1 << redes.length; mascara++) {
      const indices = redes.map((_, i) => i).filter(i => mascara & (1 << i));
      if (indices.length !== dia.cantidad || indices.some(i => restantes[i] === 0)) continue;
      const despues = restantes.map((n, i) => n - (indices.includes(i) ? 1 : 0));
      if (!cabenCuotas(despues, limites[d + 1])) continue;
      // El déficit acumulado distribuye las redes de menor peso durante toda la campaña.
      const puntaje = indices.reduce((suma, i) => {
        const publicadas = cantidades[i] - restantes[i];
        const deficit = avance * cantidades[i] / total - publicadas;
        const arranque = procesadas < Math.min(total, redes.length) && publicadas === 0 ? 1000 - i : 0;
        return suma + deficit + arranque;
      }, 0);
      if (puntaje > mejorPuntaje) { mejor = indices; mejorPuntaje = puntaje; }
    }
    if (!mejor) throw new Error('No se pudo distribuir la agenda sin repetir una red el mismo día.');
    dia.redes = mejor.map(i => { restantes[i]--; return redes[i]; });
    procesadas = avance;
  }
}

/** Una agenda global permite continuar bloques sin cambiar las cuotas del mes. */
export function crearAgenda({ inicio, fin, origen = inicio, finCampana = fin,
  cantidadPublicaciones, totalPublicaciones, metricas = [], zona = 'UTC', redes = REDES }) {
  if (![inicio, fin, origen, finCampana].every(fechaValida) || origen > inicio || inicio > fin || fin > finCampana) {
    throw new Error('El rango de la agenda no es válido.');
  }
  const dias = (Date.parse(fin) - Date.parse(inicio)) / DIA + 1;
  let diasCampana = (Date.parse(finCampana) - Date.parse(origen)) / DIA + 1;
  if (dias < 1 || dias > 31 || diasCampana > 366) throw new Error('La agenda admite bloques de hasta 31 días y campañas de hasta un año.');
  new Intl.DateTimeFormat('es', { timeZone: zona }).format();
  if(!Array.isArray(redes)||!redes.length||redes.some(r=>!REDES.includes(r))||new Set(redes).size!==redes.length)throw new Error('Selecciona al menos una plataforma válida.');
  redes=REDES.filter(r=>redes.includes(r));
  // Una petición sin cuota global corresponde a un bloque independiente.
  if (totalPublicaciones === undefined) {
    origen = inicio; finCampana = fin; diasCampana = dias;
    totalPublicaciones = cantidadPublicaciones ?? Math.max(1, Math.round(dias * 5 / 7));
  }
  if (!Number.isInteger(totalPublicaciones) || totalPublicaciones < 0 || totalPublicaciones > 366 || totalPublicaciones > diasCampana * redes.length) {
    throw new Error('La cantidad total de publicaciones no es válida para este período.');
  }
  const desde = (Date.parse(inicio) - Date.parse(origen)) / DIA;
  const esperadas = Math.round(totalPublicaciones * (desde + dias) / diasCampana) - Math.round(totalPublicaciones * desde / diasCampana);
  if (cantidadPublicaciones !== undefined && (!Number.isInteger(cantidadPublicaciones) || cantidadPublicaciones < 0 || cantidadPublicaciones > 120 || cantidadPublicaciones !== esperadas)) {
    throw new Error('La cantidad del bloque no coincide con la distribución de la campaña.');
  }
  if (esperadas > 120 || esperadas > dias * redes.length) throw new Error('Reduce la cantidad de publicaciones de este bloque.');
  if (!totalPublicaciones || !esperadas) return [];

  const fechas = Array.from({ length: diasCampana }, (_, i) => ({
    fecha: new Date(Date.parse(origen) + i * DIA).toISOString().slice(0, 10),
    cantidad: Math.round(totalPublicaciones * (i + 1) / diasCampana) - Math.round(totalPublicaciones * i / diasCampana),
    redes: []
  })).filter(d => d.cantidad);
  distribuirRedes(fechas, cuotas(totalPublicaciones, fechas.length,redes), totalPublicaciones,redes);
  const resumen = resumirHistorico(metricas, inicio);
  const ocurrencias = Object.fromEntries(REDES.map(red => [red, 0]));
  const agenda = [];
  for (const dia of fechas) {
    for (const red of dia.redes) {
      const numero = ocurrencias[red]++;
      const diaSemana = new Date(`${dia.fecha}T00:00:00Z`).getUTCDay();
      const franja = resumen.franjas.filter(f => f.red === red && f.dia === diaSemana)
        .sort((a, b) => b.alcance / b.muestra - a.alcance / a.muestra || b.muestra - a.muestra || a.hora.localeCompare(b.hora))[0];
      const hora = franja ? `${franja.hora}:00` : HORAS_PRUEBA[red][numero % HORAS_PRUEBA[red].length];
      const base_horario = franja
        ? `Histórico importado: ${franja.muestra} publicaciones orgánicas de ${red} en ${DIAS[diaSemana]}, franja ${hora}–${franja.hora}:59, alcance medio ${Math.round(franja.alcance / franja.muestra)}. Hora de ${zona}; muestra de los últimos 90 días observables. No mide personas conectadas ni demuestra una hora óptima.`
        : `Prueba inicial: ${DIAS[diaSemana]} a las ${hora} en ${zona}, ${red}. Franja editorial para comparar con otros horarios; sin datos suficientes de esta cuenta para ese día. No es un pico de conexión medido.`;
      agenda.push({ fecha: dia.fecha, hora, red, formato: FORMATOS[red][numero % FORMATOS[red].length], base_horario });
    }
  }
  return agenda.filter(p => p.fecha >= inicio && p.fecha <= fin)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora) || REDES.indexOf(a.red) - REDES.indexOf(b.red));
}

export function herramientaPara(red, formato, pais = '') {
  if (red === 'Facebook' || red === 'Instagram') return {
    nombre: 'Meta Business Suite', url: 'https://business.facebook.com/',
    uso: `Preparar el ${formato}, programarlo y comparar sus resultados con otras piezas de la misma cuenta. Revisar las opciones disponibles para tu cuenta.`
  };
  if (red === 'TikTok') return {
    nombre: 'TikTok Creative Center', url: 'https://ads.tiktok.com/business/creativecenter/',
    uso: `Revisar hashtags y referencias pertinentes al tema, filtrando por ${pais || 'el país de la audiencia'}, antes de producir el clip. Validar vigencia y permisos de los recursos elegidos.`
  };
  if (red === 'YouTube') return {
    nombre: 'YouTube Studio', url: 'https://studio.youtube.com/',
    uso: 'Preparar el clip, revisar subtítulos y comparar retención y fuentes de tráfico en las analíticas del canal.'
  };
  if (red === 'LinkedIn') return {
    nombre: 'Analíticas de página de LinkedIn', url: 'https://www.linkedin.com/help/linkedin/answer/a567573',
    uso: 'Comparar las publicaciones de tu página y revisar si generan visitas y acciones del público objetivo. Requiere acceso de administrador.'
  };
  return {
    nombre: 'Google Sheets · seguimiento manual', url: 'https://docs.google.com/spreadsheets/',
    uso: 'Usar la opción gratuita para registrar los conteos visibles y el CSV de este calendario, y comparar publicaciones de la misma cuenta. No requiere contratar analíticas ni API de X.'
  };
}
