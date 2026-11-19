import { urlReferencia } from '../../src/lib/radar.js';
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
    if (!titulo || catalogo.length >= 60 || !urlReferencia(url)) return;
    catalogo.push({ id: `F${catalogo.length + 1}`, fuente, titulo: String(titulo).slice(0, 300), url: urlReferencia(url), fecha: fecha || null, tipo, observaciones });
  };
  evidencia.noticias?.slice(0, 10).forEach(n => agregar('GDELT', n.titulo, n.url, n.fecha, 'Noticia', { alcanceGeografico: evidencia.alcanceGeografico?.noticias, consulta: evidencia.alcanceGeografico?.consultaNoticias }));
  evidencia.tendencias?.filter(t => t.pertinente !== false).slice(0, 15).forEach(t => agregar('Google Trends', t.tema, t.url, t.fecha, 'Búsqueda general', { volumenBusquedaAproximado: t.volumenAproximado || null, pais: evidencia.pais, pertinencia: 'Coincidencia de términos; validar contexto.' }));
  evidencia.videos?.filter(v => v.pertinente !== false).slice(0, 10).forEach(v => agregar('YouTube', v.titulo, v.url, v.publicado, evidencia.youtube?.modo==='busqueda_tematica'?'Video encontrado por tema':'Video de selección popular', { vistasAcumuladas: v.vistas ?? null, hashtagsObservados: v.hashtags || [], disponibilidadRegional: evidencia.pais, consulta:evidencia.youtube?.consulta,alcance:evidencia.youtube?.alcance }));
  (evidencia.descubrimientos||[evidencia.descubrimiento].filter(Boolean)).forEach(f=>f.items?.filter(i=>i.pertinente!==false).slice(0,10).forEach(i=>agregar(f.fuente,i.titulo,i.url,i.fecha,i.tipoFuente||'Contenido público externo',{formato:i.formato,metricas:i.metricas,hashtagsObservados:i.hashtags||[],alcance:f.alcance,consultado:f.consultado,consulta:i.consulta||i.tema||i.titulo,...(f.fuente==='Instagram'?{texto:typeof i.texto==='string'?i.texto.slice(0,1200):null,textoDisponible:Boolean(i.texto),hashtag:i.hashtag||null}: {})})));
  evidencia.referenciasManuales?.slice(0,10).forEach(r=>agregar(r.plataforma,r.titulo,r.url,r.fecha,r.tipoFuente||'Referencia manual del equipo',{verificada:false,nota:r.nota||'',consultado:r.consultado,...(r.plataforma==='Instagram'?{texto:typeof r.texto==='string'?r.texto.slice(0,1200):null,textoDisponible:Boolean(r.texto),hashtag:r.hashtag||null,tipoOrigen:r.tipoOrigen||null}: {})}));
  return catalogo;
}

export function justificarPieza(pieza, catalogo, consultado) {
  const ids = pieza.referencias ?? [];
  if (!Array.isArray(ids) || ids.length > 3 || ids.some(id => !catalogo.some(f => f.id === id))) throw new Error('La publicación cita fuentes que no fueron consultadas.');
  // Comparar días completos: una campaña local puede seguir en el día anterior al UTC.
  const instante=Date.parse(consultado);
  const diaConsulta=Number.isFinite(instante)?new Date(instante).toISOString().slice(0,10):'';
  const dias = (Date.parse(pieza.fecha) - Date.parse(diaConsulta)) / 86400000;
  // Una señal de hoy no justifica una supuesta tendencia dentro de varios meses.
  const referencias = dias >= -1 && dias <= 30 ? [...new Set(ids)].map(id => catalogo.find(f => f.id === id)) : [];
  const instagramSinTexto=referencias.some(f=>f.fuente==='Instagram'&&f.observaciones?.textoDisponible===false);
  return { referencias, base_contenido: referencias.length ? instagramSinTexto ? 'Enlace de Instagram por revisar · texto no disponible' : 'Referencia consultada · validar pertinencia' : 'Hipótesis editorial · sin fuente reciente vinculada' };
}

export function baseHorario(resumen, pieza) {
  const franja = resumen.franjas.find(f => f.red === pieza.red && f.dia === new Date(pieza.fecha).getUTCDay() && f.hora === pieza.hora.slice(0, 2));
  return franja ? `Histórico importado reciente: ${franja.muestra} publicaciones de esta red en el mismo día y franja, dentro de los últimos 90 días observables. Evidencia limitada; no demuestra una hora óptima.` : 'Prueba inicial: no hay al menos 3 publicaciones recientes de esta red en el mismo día y franja. No es una hora óptima medida.';
}
