import { resumirMetricas } from '../../src/lib/marketing.js';

export function resumirHistorico(metricas, inicio, ahora = new Date()) {
  const hasta = [inicio, ahora.toISOString().slice(0, 10)].sort()[0];
  const desde = new Date(Date.parse(hasta) - 90 * 86400000).toISOString().slice(0, 10);
  const recientes = metricas.filter(m => !m.pagado && m.fecha >= desde && m.fecha < hasta);
  const franjas = new Map();
  for (const m of recientes) {
    const clave = `${m.red}:${new Date(m.fecha).getUTCDay()}:${m.hora.slice(0, 2)}`;
    const f = franjas.get(clave) || { red: m.red, dia: new Date(m.fecha).getUTCDay(), hora: m.hora.slice(0, 2), muestra: 0, alcance: 0, interacciones: 0, conversiones: 0 };
    f.muestra++; f.alcance += m.alcance; f.interacciones += m.interacciones; f.conversiones += m.conversiones;
    franjas.set(clave, f);
  }
  return { desde, hasta, publicaciones: recientes.length, formatos: resumirMetricas(recientes), franjas: [...franjas.values()].filter(f => f.muestra >= 3) };
}

export function catalogarFuentes(evidencia) {
  const catalogo = [];
  const agregar = (fuente, titulo, url, fecha, tipo, observaciones = {}) => {
    if (!titulo || catalogo.length >= 60) return;
    catalogo.push({ id: `F${catalogo.length + 1}`, fuente, titulo: String(titulo).slice(0, 300), url: /^https?:\/\//.test(url || '') ? url : '', fecha: fecha || null, tipo, observaciones });
  };
  evidencia.noticias?.slice(0, 10).forEach(n => agregar('GDELT', n.titulo, n.url, n.fecha, 'Noticia'));
  evidencia.tendencias?.slice(0, 15).forEach(t => agregar('Google Trends', t.tema, t.url, t.fecha, 'Búsqueda general', { volumenBusquedaAproximado: t.volumenAproximado || null }));
  evidencia.videos?.slice(0, 10).forEach(v => agregar('YouTube', v.titulo, v.url, v.publicado, 'Video popular', { vistasAcumuladas: v.vistas ?? null }));
  evidencia.plataformas?.forEach(p => p.items.slice(0, 5).forEach(i => agregar(p.fuente, i.titulo, i.url, i.fecha, p.fuente === 'X' ? 'Publicación pública' : 'Cuenta autorizada', { formato: i.formato, metricas: i.metricas })));
  return catalogo;
}

export function justificarPieza(pieza, catalogo, consultado) {
  const ids = pieza.referencias ?? [];
  if (!Array.isArray(ids) || ids.length > 3 || ids.some(id => !catalogo.some(f => f.id === id))) throw new Error('La publicación cita fuentes que no fueron consultadas.');
  const dias = (Date.parse(pieza.fecha) - Date.parse(consultado)) / 86400000;
  // Una señal de hoy no justifica una supuesta tendencia dentro de varios meses.
  const referencias = dias >= -1 && dias <= 30 ? [...new Set(ids)].map(id => catalogo.find(f => f.id === id)) : [];
  return { referencias, base_contenido: referencias.length ? 'Referencia consultada · validar pertinencia' : 'Hipótesis editorial · sin fuente reciente vinculada' };
}

export function baseHorario(resumen, pieza) {
  const franja = resumen.franjas.find(f => f.red === pieza.red && f.dia === new Date(pieza.fecha).getUTCDay() && f.hora === pieza.hora.slice(0, 2));
  return franja ? `Histórico importado reciente: ${franja.muestra} publicaciones de esta red en el mismo día y franja, dentro de los últimos 90 días observables. Evidencia limitada; no demuestra una hora óptima.` : 'Prueba inicial: no hay al menos 3 publicaciones recientes de esta red en el mismo día y franja. No es una hora óptima medida.';
}
