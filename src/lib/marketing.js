export const REDES = ['Instagram', 'Facebook', 'TikTok', 'X', 'LinkedIn', 'YouTube'];
export const FORMATOS_MARKETING = ['Reel', 'Clip', 'Carrusel', 'Imagen', 'Historia', 'Texto'];
export const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function rangoCampana(inicio, cantidad, unidad) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio || '') || !Number.isFinite(Date.parse(inicio)) || new Date(inicio).toISOString().slice(0,10)!==inicio || !Number.isInteger(cantidad) || cantidad<1) throw new Error('Indica una fecha y duración válidas.');
  const d=new Date(`${inicio}T00:00:00Z`), limite=new Date(d);
  if(unidad==='dias' || unidad==='semanas') limite.setUTCDate(limite.getUTCDate()+cantidad*(unidad==='semanas'?7:1));
  else if(unidad==='meses' || unidad==='anos') {
    const dia=d.getUTCDate(); limite.setUTCDate(1); limite.setUTCMonth(limite.getUTCMonth()+cantidad*(unidad==='anos'?12:1));
    const ultimo=new Date(Date.UTC(limite.getUTCFullYear(),limite.getUTCMonth()+1,0)).getUTCDate();
    limite.setUTCDate(Math.min(dia,ultimo));
  } else throw new Error('Duración no válida.');
  const dias=(limite-d)/86400000;
  if(dias>366 || dias<1 || d.getUTCFullYear()<2020 || limite.getUTCFullYear()>2101) throw new Error('Elige una campaña de hasta un año (366 días).');
  limite.setUTCDate(limite.getUTCDate()-1);
  return {inicio,fin:limite.toISOString().slice(0,10),dias};
}

export function dividirCampana(inicio,fin) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(inicio || '') || !/^\d{4}-\d{2}-\d{2}$/.test(fin || '') || !Number.isFinite(Date.parse(inicio)) || !Number.isFinite(Date.parse(fin)) || inicio>fin || (Date.parse(fin)-Date.parse(inicio))/86400000>365) throw new Error('Rango de campaña no válido.');
  const bloques=[]; let cursor=inicio;
  while(cursor<=fin) {
    const d=new Date(`${cursor}T00:00:00Z`), ultimo=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10);
    const hasta=ultimo<fin?ultimo:fin;
    bloques.push({inicio:cursor,fin:hasta}); cursor=new Date(Date.parse(hasta)+86400000).toISOString().slice(0,10);
  }
  return bloques;
}

export function crearFechas(mes, dias) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || !dias.length) throw new Error('Elige un mes y al menos un día de publicación.');
  const [ano, numero] = mes.split('-').map(Number);
  if (ano < 2020 || ano > 2100) throw new Error('El año debe estar entre 2020 y 2100.');
  const cantidad = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return Array.from({ length: cantidad }, (_, i) => new Date(Date.UTC(ano, numero - 1, i + 1)))
    .filter(d => dias.includes(d.getUTCDay())).map(d => d.toISOString().slice(0, 10));
}

export function validarMetricas(datos) {
  if (!Array.isArray(datos) || !datos.length || datos.length > 300) throw new Error('Importa entre 1 y 300 publicaciones en un arreglo JSON.');
  return datos.map((p, i) => {
    if (!REDES.includes(p.red) || !FORMATOS_MARKETING.includes(p.formato) || !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '') || !Number.isFinite(Date.parse(p.fecha)) || new Date(p.fecha).toISOString().slice(0,10) !== p.fecha || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.hora || '')) throw new Error(`Publicación ${i + 1}: revisa red, formato, fecha (AAAA-MM-DD) y hora (HH:mm).`);
    const numeros = {};
    for (const campo of ['alcance', 'interacciones', 'conversiones']) {
      if (typeof p[campo] !== 'number' || !Number.isFinite(p[campo]) || p[campo] < 0 || p[campo] > 1e12) throw new Error(`Publicación ${i + 1}: ${campo} debe ser un número mayor o igual a cero.`);
      numeros[campo] = p[campo];
    }
    return { red: p.red, formato: p.formato, fecha: p.fecha, hora: p.hora, ...numeros, pagado: p.pagado === true, hashtags: typeof p.hashtags === 'string' ? p.hashtags.slice(0, 300) : '' };
  });
}

export function importarCsv(texto) {
  const filas = [], fila = [];
  let celda = '', comillas = false;
  const limpio = texto.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  const separador = limpio.split('\n')[0].includes(';') ? ';' : ',';
  for (let i=0; i<limpio.length; i++) {
    const c=limpio[i];
    if (c === '"') {
      if (comillas && limpio[i+1] === '"') { celda+='"'; i++; }
      else comillas=!comillas;
    } else if (!comillas && (c === separador || c === '\n')) {
      fila.push(celda.trim()); celda='';
      if (c === '\n') { if (fila.some(Boolean)) filas.push([...fila]); fila.length=0; }
    } else celda+=c;
  }
  if (comillas) throw new Error('El CSV contiene comillas sin cerrar.');
  fila.push(celda.trim()); if (fila.some(Boolean)) filas.push(fila);
  const cabecera = filas.shift() || [];
  const requeridos = ['red','formato','fecha','hora','alcance','interacciones','conversiones'];
  if (requeridos.some(c => !cabecera.includes(c))) throw new Error('Faltan columnas. Usa la plantilla CSV y conserva los encabezados.');
  return validarMetricas(filas.map(f => {
    const obj = Object.fromEntries(cabecera.map((c,i) => [c,f[i] || '']));
    for (const c of ['alcance','interacciones','conversiones']) obj[c] = obj[c] === '' ? NaN : Number(obj[c]);
    obj.pagado = ['true','si','sí','1'].includes(String(obj.pagado).toLowerCase());
    return obj;
  }));
}

export function resumirMetricas(datos, desde = '0000-00-00', hasta = '9999-12-31') {
  const filas = datos.filter(p => !p.pagado && p.fecha >= desde && p.fecha <= hasta);
  const grupos = new Map();
  for (const p of filas) {
    const clave = `${p.red} · ${p.formato}`;
    const g = grupos.get(clave) || { red: p.red, formato: p.formato, publicaciones: 0, alcance: 0, interacciones: 0, conversiones: 0 };
    g.publicaciones++; g.alcance += p.alcance; g.interacciones += p.interacciones; g.conversiones += p.conversiones;
    grupos.set(clave, g);
  }
  return [...grupos.values()].map(g => ({ ...g, alcanceMedio: g.alcance / g.publicaciones, tasaInteraccion: g.alcance ? g.interacciones / g.alcance * 100 : null })).sort((a,b) => b.alcanceMedio - a.alcanceMedio);
}

export function descargarArchivo(nombre, contenido, tipo = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a'); a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function calendarioCsv(plan) {
  const campos = ['campana', 'mensaje', 'proposito', 'publico_objetivo', 'url_cta', 'fecha', 'hora', 'red', 'formato', 'pilar', 'titulo', 'gancho', 'guion', 'copy', 'hashtags', 'palabras_clave', 'cta', 'metrica', 'motivo', 'base_horario', 'visual', 'distribucion'];
  const celda = v => {
    let s = Array.isArray(v) ? v.join(' ') : String(v ?? '');
    if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + ['zona_horaria,' + campos.join(','), ...plan.publicaciones.map(p => [plan.zona, ...campos.map(c => p[c])].map(celda).join(','))].join('\r\n');
}
