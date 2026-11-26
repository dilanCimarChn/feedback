import { rangoCampana } from './marketing.js';
import { agendaTscp, FRECUENCIA_TSCP, SECUENCIA_EMAIL } from './tscp.js';

export const REDES_TSCP = ['LinkedIn', 'Instagram', 'Facebook', 'TikTok'];
export const LENGUAJES_TSCP = {
  LinkedIn: 'Profesional y concreto: propósito, colaboración y argumentos verificables para quienes toman decisiones.',
  Instagram: 'Cercano y visual: una idea sencilla, beneficio claro y una acción por pieza.',
  Facebook: 'Comunitario y accesible: contexto, utilidad y participación sin jerga.',
  TikTok: 'Directo y conversacional: explicar una idea con claridad y sin promesas exageradas.'
};
export const OBJETIVOS_TSCP = {
  voluntario: 'Acercar TSCP a voluntarios que puedan aportar tiempo, habilidades o presentar la propuesta dentro de su organización.',
  empresa: 'Acercar TSCP a empresas interesadas en colaborar con recursos, servicios o capacidad logística.'
};
const MISION = 'Orquestar el movimiento de recursos excedentes y subutilizados para fortalecer comunidades, reducir el desperdicio y crear impacto medible.';

function texto(valor, maximo, nombre) {
  if (typeof valor !== 'string' || valor.length > maximo) throw new Error(`${nombre}: utiliza un texto de hasta ${maximo} caracteres.`);
  return valor.trim();
}

export function crearConfiguracionTscp(perfil = {}, guardado = {}, hoy) {
  if (!hoy) {
    const ahora = new Date();
    hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  }
  const vocabulario = Array.isArray(perfil.vocabulario_aprobado) && perfil.vocabulario_aprobado.length ? perfil.vocabulario_aprobado : perfil.palabras_clave || [];
  return {
    objetivoTipo: 'voluntario', objetivo: OBJETIVOS_TSCP.voluntario,
    inicio: hoy, cantidad: 3, unidad: 'meses', redes: [...REDES_TSCP],
    idioma: 'Español', pais: 'US', zona: 'America/New_York',
    mision: perfil.mision || MISION, vocabulario,
    manual: perfil.manual_marca || null, marcaConfirmada: false,
    ...guardado,
    lenguajes: { ...LENGUAJES_TSCP, ...(perfil.lenguajes || {}), ...(guardado.lenguajes || {}) }
  };
}

export function validarConfiguracionTscp(entrada, perfil = {}) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new Error('Completa la configuración de campaña.');
  const base = crearConfiguracionTscp(perfil, entrada);
  if (!['voluntario', 'empresa'].includes(base.objetivoTipo)) throw new Error('Elige voluntario o empresa como destinatario.');
  const objetivo = texto(base.objetivo, 1200, 'Objetivo');
  if (objetivo.length < 10) throw new Error('Describe el objetivo de la campaña con al menos diez caracteres.');
  if (!Number.isInteger(Number(base.cantidad))) throw new Error('La duración debe ser un número entero.');
  const cantidad = Number(base.cantidad);
  const rango = rangoCampana(base.inicio, cantidad, base.unidad);
  if (cantidad > ({ dias: 366, semanas: 52, meses: 12, anos: 1 }[base.unidad] || 0)) throw new Error('La duración mínima es un día y la máxima es un año.');
  if (!Array.isArray(base.redes) || !base.redes.length || base.redes.length > 4 || new Set(base.redes).size !== base.redes.length || base.redes.some(red => !REDES_TSCP.includes(red))) throw new Error('Selecciona entre LinkedIn, Instagram, Facebook y TikTok.');
  const idioma = texto(base.idioma, 80, 'Idioma');
  if (!idioma) throw new Error('Indica el idioma de trabajo.');
  if (typeof base.pais !== 'string' || !/^[A-Z]{2}$/.test(base.pais)) throw new Error('El país de referencia debe utilizar dos letras mayúsculas.');
  const zona = texto(base.zona, 80, 'Zona horaria');
  try { new Intl.DateTimeFormat('es', { timeZone: zona }).format(); } catch { throw new Error('La zona horaria no es válida.'); }
  const mision = texto(base.mision || '', 3000, 'Misión');
  if (!Array.isArray(base.vocabulario) || base.vocabulario.length > 40) throw new Error('El vocabulario admite hasta cuarenta términos.');
  const vocabulario = [...new Set(base.vocabulario.map(v => texto(v, 160, 'Vocabulario')).filter(Boolean))];
  const lenguajes = Object.fromEntries(base.redes.map(red => [red, texto(base.lenguajes[red] || '', 700, `Lenguaje de ${red}`)]));
  let manual = null;
  if (base.manual !== null && base.manual !== undefined) {
    if (typeof base.manual !== 'object' || Array.isArray(base.manual)) throw new Error('Los datos del manual de marca no son válidos.');
    manual = { nombre: texto(base.manual.nombre || '', 200, 'Nombre del manual'), analizado: base.manual.analizado === true, fecha: texto(base.manual.fecha || '', 50, 'Fecha del manual') };
  }
  return { objetivoTipo: base.objetivoTipo, objetivo, ...rango, cantidad, unidad: base.unidad,
    redes: REDES_TSCP.filter(red => base.redes.includes(red)), idioma, pais: base.pais, zona,
    mision, vocabulario, lenguajes, manual, marcaConfirmada: base.marcaConfirmada === true };
}

export function crearReferentesTscp() {
  return REDES_TSCP.flatMap(canal => ['Good360', 'TechSoup'].map((nombre, i) => ({
    id: `${canal.toLowerCase()}-${i + 1}`, canal, nombre, url: '', cuenta: '', paginaId: '',
    seguidores: null, publicaciones: [], fechaConsulta: '', periodoDias: 30
  })));
}

const TEMAS = [
  { tema: 'Qué es TSCP y a quién ayuda', proposito: 'Awareness', estructura: ['Presentar el problema que aborda TSCP.', 'Explicar su función con información confirmada.', 'Indicar dónde conocer el proyecto.'] },
  { tema: 'Cómo participar y qué se necesita', proposito: 'Consideration', estructura: ['Identificar a quién se dirige la propuesta.', 'Describir requisitos y pasos confirmados.', 'Señalar información que todavía debe validar el equipo.'] },
  { tema: 'Formas de colaboración', proposito: 'Consideration', estructura: ['Describir la necesidad del segmento.', 'Relacionarla con una forma de colaboración confirmada.', 'Proponer una acción de contacto.'] },
  { tema: 'El equipo y la misión del proyecto', proposito: 'Awareness', estructura: ['Presentar la misión aprobada.', 'Identificar equipo o socios con autorización.', 'Explicar cómo conocer el trabajo del proyecto.'] },
  { tema: 'Próximo paso para colaborar', proposito: 'Conversion', estructura: ['Recordar el beneficio confirmado.', 'Explicar una acción concreta.', 'Comprobar el enlace de destino antes de producir.'] }
];

export function crearGuiaTscp(configuracion, diagnostico = {}) {
  const config = validarConfiguracionTscp(configuracion);
  const segmentos = Array.isArray(diagnostico?.segmentos) ? diagnostico.segmentos : [];
  const fuentes = new Set((diagnostico?.fuentes || []).map(f => f.id));
  const consultado = Date.parse(diagnostico?.consultado);
  const sugerencias = (Array.isArray(diagnostico?.sugerencias) ? diagnostico.sugerencias : []).filter(s => config.redes.includes(s.canal)).map((s, i) => ({ ...s, id: `sugerencia-${i + 1}` }));
  const nombresDias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const frecuencias = config.redes.map(canal => ({ canal, ...FRECUENCIA_TSCP[canal], diasPropuestos: FRECUENCIA_TSCP[canal].diasPropuestos.map(dia => nombresDias[dia]) }));
  const redesConEjemplo = new Set();
  const agenda = agendaTscp(config.inicio, config.fin).filter(p => config.redes.includes(p.red));
  const publicaciones = agenda.map((fila, i) => {
    const base = TEMAS[i % TEMAS.length];
    const segmento = segmentos.find(s => s.canal === fila.red) || segmentos[i % Math.max(segmentos.length, 1)];
    const referencia = (diagnostico?.benchmark || []).find(b => b.canal === fila.red && b.fuentes?.some(id => fuentes.has(id)));
    const distanciaConsulta = (Date.parse(fila.fecha) - consultado) / 86400000;
    const referencias = distanciaConsulta >= -1 && distanciaConsulta <= 30 ? (referencia?.fuentes || []).filter(id => fuentes.has(id)) : [];
    const ejemplo = !redesConEjemplo.has(fila.red) && sugerencias.find(s => s.canal === fila.red);
    redesConEjemplo.add(fila.red);
    return {
      id: `${fila.fecha}-${fila.red}`, fecha: fila.fecha, red: fila.red,
      formato: ejemplo?.formato || (fila.red === 'TikTok' ? 'Video vertical' : fila.red === 'Instagram' ? 'Carrusel o Reel' : 'Post o carrusel'),
      tema: ejemplo?.tema || (i % TEMAS.length === 2 ? (config.objetivoTipo === 'empresa' ? 'Cómo colaborar con recursos o servicios' : 'Cómo aportar tiempo y habilidades') : base.tema),
      proposito: base.proposito,
      segmento: segmento?.segmento || (config.objetivoTipo === 'empresa' ? 'Empresas interesadas en colaborar' : 'Voluntarios interesados en colaborar'),
      objetivo: segmento?.objetivo || config.objetivo,
      cta: ejemplo?.cta || (config.objetivoTipo === 'empresa' ? 'Solicitar información de colaboración' : 'Conocer cómo participar'),
      estructura: ejemplo?.estructura || [...base.estructura], referencias, sugerenciaId: ejemplo?.id || null,
      fundamento: referencias.length ? 'Referencia del diagnóstico por revisar; esta estructura no demuestra rendimiento.' : 'Estructura editorial inicial, pendiente de validar con marketing.'
    };
  });
  return {
    tipo: 'orientativo', estado: 'Propuesta por confirmar con marketing', inicio: config.inicio, fin: config.fin, zona: config.zona,
    frecuencia: Object.fromEntries(frecuencias.map(f => [f.canal, f.propuesta])), frecuencias,
    criterioFrecuencia: 'Fuente: sección 4.3 del flujo de marketing. Son cantidades por canal y por semana completa; no exige publicar todos los días. Los días propuestos por el sistema requieren aprobación de Marketing. Las semanas parciales incluyen solo las fechas dentro de la campaña.',
    publicaciones, sugerencias,
    emails: SECUENCIA_EMAIL.map(([dia, , condicion], i) => ({ dia, condicion,
      objetivo: ['Reconocer el propósito del destinatario', 'Explicar un beneficio confirmado', 'Explicar la comunidad y colaboración', 'Proponer un próximo paso sencillo', 'Cerrar el ciclo y ofrecer preferencias'][i],
      estructura: ['Identificar al destinatario y el contexto.', 'Usar únicamente información aprobada para este objetivo.', 'Proponer una acción y una opción de baja.'] })),
    pendientesPaso2: [
      'Marketing debe confirmar cómo comienza el trabajo después de aprobar configuración y diagnóstico.',
      'Acordar casos de uso, objetivo esperado y qué debe incluir cada entrega.',
      'Confirmar o ajustar la frecuencia por canal antes de producir.',
      'Definir responsables de aprobación, producción y atención de consultas.',
      'Confirmar destinatarios, enlaces, condiciones de salida y baja de la secuencia de email.'
    ],
    limites: ['Los ejemplos de copy, hashtags e ideas son borradores para revisar. El resto del cronograma contiene estructuras; no son piezas finales.',
      'Los hashtags se proponen por afinidad temática, sin acreditar popularidad ni alcance. Cada ejemplo se vincula a una primera salida por canal; las demás requieren desarrollo editorial.',
      'La frecuencia procede del documento de marketing: LinkedIn usa dos de las dos a tres salidas propuestas.',
      'La distribución en lunes, miércoles y viernes es una propuesta del sistema, no una exigencia del flujo ni una medición de los mejores días.',
      'Los cinco emails son una guía relativa a cada contacto, no envíos programados.',
      'No se publican piezas, no se envían correos y no se conocen horarios óptimos sin estadísticas propias.']
  };
}

const celda = valor => String(valor ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
export function exportarGuiaTscp(configuracion, diagnostico = {}, guia = crearGuiaTscp(configuracion, diagnostico)) {
  const config = validarConfiguracionTscp(configuracion);
  const lineas = ['# Agente TSCP · Configuración y diagnóstico', '', `Objetivo: ${config.objetivo}`, `Destinatario: ${config.objetivoTipo}`, `Período: ${config.inicio} a ${config.fin}`, `Canales: ${config.redes.join(', ')}`, '',
    '## Marca y lenguaje', '', `Misión: ${config.mision || 'Pendiente'}`, `Vocabulario: ${config.vocabulario.join(', ') || 'Pendiente'}`, `Manual: ${config.manual?.nombre || 'Pendiente'}`, `Validación institucional: ${config.marcaConfirmada ? 'Confirmada por el equipo' : 'Pendiente'}`, '',
    ...config.redes.map(red => `- ${red}: ${config.lenguajes[red]}`), '', '## Diagnóstico', '',
    `Consulta: ${diagnostico?.consultado || 'Pendiente'}`, ''];
  for (const canal of diagnostico?.canales || []) {
    lineas.push(`### ${canal.canal}`, '', `Estado: ${canal.estado}`, '', '| Referente | Seguidores | Frecuencia observada / semana | Reacciones por publicación | Estado |', '| --- | --- | --- | --- | --- |');
    for (const r of canal.referentes || []) lineas.push(`| ${celda(r.nombre)} | ${celda(r.seguidores ?? 'Sin dato')} | ${celda(r.publicacionesPorSemana ?? 'Sin dato')} | ${celda(r.reaccionesPromedio ?? 'Sin dato')} | ${celda(r.estado)} |`);
    lineas.push('');
  }
  for (const b of diagnostico?.benchmark || []) lineas.push(`- ${b.canal}: ${b.recomendacion || 'Pendiente'} (${b.limite || b.estado || 'Por validar'})`);
  if (diagnostico?.apoyo) {
    lineas.push('', '## Referencias automáticas de apoyo', '', diagnostico.apoyo.limite || 'Inspiración temática; no acredita métricas de los competidores.');
    for (const e of diagnostico.apoyo.estados || []) lineas.push(`- ${e.fuente}: ${e.estado}. ${e.detalle || ''}`);
    for (const f of diagnostico.apoyo.fuentes || []) lineas.push(`- ${f.id} · ${f.canalOrigen}: ${f.texto} · ${f.url} · ${f.alcance || ''}`);
  }
  lineas.push('', '## Segmentos', '', '| Segmento | Necesidad | Objetivo | Canal |', '| --- | --- | --- | --- |');
  for (const s of diagnostico?.segmentos || []) lineas.push(`| ${celda(s.segmento)} | ${celda(s.necesidad)} | ${celda(s.objetivo)} | ${celda(s.canal)} |`);
  lineas.push('', '## Mensaje estratégico', '', diagnostico?.mensaje?.central || 'Pendiente de diagnóstico y validación.');
  for (const a of diagnostico?.mensaje?.apoyos || []) lineas.push(`- ${a.texto} · ${a.estado || 'Por validar'}`);
  for (const v of diagnostico?.mensaje?.variantes || []) lineas.push(`- ${v.segmento}: ${v.mensaje}`);
  lineas.push('', '## Sugerencias de contenido por canal · borradores para revisión', '');
  if (!guia.sugerencias.length) lineas.push('Este diagnóstico no contiene ejemplos. Actualiza el diagnóstico para generarlos.');
  for (const s of guia.sugerencias) lineas.push(`### ${s.canal} · ${s.tema}`, '', `${s.estado} · ${s.id}`, `Formato: ${s.formato}`, `Idea: ${s.idea}`, `Gancho: ${s.gancho}`, '', 'Copy sugerido:', '', s.copy, '', `Hashtags sugeridos: ${s.hashtags.join(' ')}`, `CTA: ${s.cta}`, `Estructura: ${s.estructura.join(' → ')}`, `${s.fundamento} Fuentes: ${s.fuentes.join(', ') || 'Sin fuente vinculada'}`, '');
  lineas.push('', '## Fuentes y pendientes', '');
  for (const f of diagnostico?.fuentes || []) lineas.push(`- ${f.id}: ${f.url || 'Sin enlace'} · ${f.tipo || ''} · ${f.fecha || 'Sin fecha'}`);
  for (const p of diagnostico?.pendientes || []) lineas.push(`- ${typeof p === 'string' ? p : p.detalle || p.mensaje || JSON.stringify(p)}`);
  lineas.push('', '## Frecuencia de publicación', '', guia.criterioFrecuencia, '', '| Canal | Frecuencia del flujo / semana | Propuesta / semana | Días propuestos, por aprobar |', '| --- | --- | --- | --- |');
  for (const f of guia.frecuencias) lineas.push(`| ${f.canal} | ${f.minima === f.maxima ? f.minima : `${f.minima}–${f.maxima}`} | ${f.propuesta} | ${f.diasPropuestos.join(', ')} |`);
  lineas.push('', '## Cronograma orientativo', '', guia.estado, '', '| Fecha | Canal y formato | Tema y propósito | Segmento y objetivo | CTA propuesto | Estructura de trabajo | Referencias |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const p of guia.publicaciones) lineas.push(`| ${p.fecha} | ${p.red} · ${celda(p.formato)} | ${celda(p.tema)} · ${p.proposito}${p.sugerenciaId ? ` · Ejemplo: ${p.sugerenciaId}` : ''} | ${celda(p.segmento)} · ${celda(p.objetivo)} | ${celda(p.cta)} | ${celda(p.estructura.join(' → '))} | ${celda(p.referencias.join(', ') || 'Hipótesis editorial')} |`);
  lineas.push('', '## Estructura de email · máximo cinco correos en veinte días por contacto', '');
  for (const e of guia.emails) lineas.push(`- Día ${e.dia}: ${e.objetivo}. ${e.condicion}. Estructura: ${e.estructura.join(' → ')}`);
  lineas.push('', '## Paso 2 · Pendiente de marketing', '', ...guia.pendientesPaso2.map(p => `- ${p}`), '', ...guia.limites.map(p => `- ${p}`));
  return lineas.join('\n');
}
