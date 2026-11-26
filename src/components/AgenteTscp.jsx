import { useEffect, useMemo, useRef, useState } from 'react';
import { llamarApi } from '../lib/api';
import { leerComoDataUrl } from '../lib/archivos';
import { descargarArchivo } from '../lib/marketing';
import { useGuardadoDiferido } from '../lib/useGuardadoDiferido';
import ConexionesApis from './ConexionesApis';
import SugerenciasTscp from './SugerenciasTscp';
import FrecuenciaTscp from './FrecuenciaTscp';
import ApoyoTscp from './ApoyoTscp';
import { REDES_TSCP, OBJETIVOS_TSCP, crearConfiguracionTscp, validarConfiguracionTscp, crearReferentesTscp, crearGuiaTscp, exportarGuiaTscp } from '../lib/agente-tscp';
import './agente-tscp.css';

const CLAVE = 'agente-feedback:tscp:v2';
const UNIDADES = { dias: 'días', semanas: 'semanas', meses: 'meses' };

function leerGuardado() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; }
  catch { return {}; }
}

function texto(valor, alternativa = 'Pendiente') {
  if (typeof valor === 'string') return valor.trim() || alternativa;
  if (Array.isArray(valor)) return valor.map(v => texto(v, '')).filter(Boolean).join(' · ') || alternativa;
  if (valor && typeof valor === 'object') return texto(valor.texto || valor.descripcion || valor.nombre || valor.estado, alternativa);
  return alternativa;
}

function numero(valor, decimales = 0) {
  if (valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor))) return 'No disponible';
  return new Intl.NumberFormat('es', { maximumFractionDigits: decimales }).format(Number(valor));
}

function enlaceSeguro(valor) {
  try { const url = new URL(valor); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

function fechaConsulta(valor) {
  if (!valor || !Number.isFinite(Date.parse(valor))) return 'Fecha no informada';
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(valor));
}

function referentesConMetricas(canal) {
  if (Number.isInteger(canal.referentesConMetricas)) return canal.referentesConMetricas;
  const tieneNumero = valor => typeof valor === 'number' && Number.isFinite(valor);
  return (canal.referentes || []).filter(ref => tieneNumero(ref.seguidores) || (ref.publicaciones || []).some(p => ['likes', 'comentarios', 'compartidos', 'reacciones'].some(k => tieneNumero(p[k])))).length;
}

function fusionarReferencias(actuales, resueltas, canales) {
  const resultado = actuales.map(ref => ({ ...ref }));
  for (const resuelta of Array.isArray(resueltas) ? resueltas : []) {
    if (!resuelta || !canales.includes(resuelta.canal) || typeof resuelta.id !== 'string') continue;
    const indice = resultado.findIndex(ref => ref.id === resuelta.id && ref.canal === resuelta.canal);
    if (indice < 0) {
      if (resultado.filter(ref => ref.canal === resuelta.canal).length >= 3 || !resuelta.nombre) continue;
      resultado.push({ id: resuelta.id, canal: resuelta.canal, nombre: resuelta.nombre, url: enlaceSeguro(resuelta.url) || '', cuenta: resuelta.cuenta || '', paginaId: resuelta.paginaId || '', identificacion: resuelta.identificacion || null, seguidores: null, publicaciones: [], fechaConsulta: '', periodoDias: 30 });
      continue;
    }
    const actual = resultado[indice];
    const tieneDatosManuales = actual.seguidores !== null && actual.seguidores !== undefined && actual.seguidores !== '' || Boolean(actual.publicaciones?.length);
    const sustituir = Boolean(resuelta.identificacion?.sustituye);
    if (sustituir && (actual.url || actual.cuenta || actual.paginaId || tieneDatosManuales)) continue;
    const url = !actual.url ? enlaceSeguro(resuelta.url) || '' : actual.url;
    const mismaCuenta = !actual.cuenta || !resuelta.cuenta || actual.cuenta.toLowerCase().replace(/^@/, '') === resuelta.cuenta.toLowerCase().replace(/^@/, '');
    const mismoPerfil = !actual.url || !resuelta.url || actual.url.replace(/\/$/, '') === resuelta.url.replace(/\/$/, '');
    resultado[indice] = { ...actual, nombre: sustituir ? resuelta.nombre || actual.nombre : actual.nombre, url,
      cuenta: mismaCuenta && mismoPerfil ? actual.cuenta || resuelta.cuenta || '' : actual.cuenta,
      paginaId: mismoPerfil ? actual.paginaId || resuelta.paginaId || '' : actual.paginaId,
      identificacion: mismoPerfil && mismaCuenta ? resuelta.identificacion || actual.identificacion : actual.identificacion };
  }
  return resultado;
}

function Fuentes({ fuentes, catalogo = [] }) {
  const lista = Array.isArray(fuentes) ? fuentes : fuentes ? [fuentes] : [];
  if (!lista.length) return <span className="tscp-ayuda">Sin fuente vinculada</span>;
  return <ul className="tscp-fuentes">{lista.map((dato, indice) => {
    const fuente = typeof dato === 'string' ? catalogo.find(item => item.id === dato) || dato : dato;
    const url = enlaceSeguro(typeof fuente === 'string' ? fuente : fuente?.url);
    const titulo = typeof fuente === 'string' ? fuente : texto(fuente?.titulo || fuente?.nombre || fuente?.fuente || fuente?.tipo || fuente?.origen, `Fuente ${indice + 1}`);
    return <li key={`${url || titulo}-${indice}`}>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{titulo}</a> : titulo}{fuente && typeof fuente === 'object' && <span className="tscp-subtexto">{texto(fuente.tipo || fuente.origen, 'Fuente por clasificar')} · {fechaConsulta(fuente.fecha || fuente.consultado)}</span>}</li>;
  })}</ul>;
}

function Tabla({ titulo, children, id }) {
  return <div className="tscp-tabla-grupo"><h4 className="tscp-titulo-tabla">{titulo}</h4><div className="tscp-tabla" tabIndex={0} role="region" aria-label={titulo} id={id}><table><caption className="tscp-solo-lector">{titulo}</caption>{children}</table></div></div>;
}

function Lista({ valores }) {
  const lista = Array.isArray(valores) ? valores : valores ? [valores] : [];
  return lista.length ? <ul className="tscp-lista">{lista.map((valor, indice) => <li key={indice}>{texto(valor)}</li>)}</ul> : <p className="tscp-ayuda">Sin observaciones adicionales.</p>;
}

function PublicacionesMuestra({ publicaciones }) {
  if (!Array.isArray(publicaciones) || !publicaciones.length) return null;
  return <details className="tscp-muestra"><summary>Ver publicaciones de la muestra · {publicaciones.length}</summary><ul className="tscp-publicaciones">{publicaciones.map((publicacion, indice) => {
    const url = enlaceSeguro(publicacion.url);
    return <li key={`${publicacion.url || indice}`}>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer">Abrir publicación {indice + 1}</a> : <strong>Publicación {indice + 1} · enlace no disponible</strong>}
      <span className="tscp-subtexto">{fechaConsulta(publicacion.fecha)} · {texto(publicacion.formato, 'Formato no informado')}</span>
      <p>{texto(publicacion.texto, 'Texto no disponible; no se atribuye contenido a este enlace.')}</p>
      <dl><dt>Likes</dt><dd>{numero(publicacion.likes)}</dd><dt>Reacciones</dt><dd>{numero(publicacion.reacciones)}</dd><dt>Comentarios</dt><dd>{numero(publicacion.comentarios)}</dd><dt>Compartidos</dt><dd>{numero(publicacion.compartidos)}</dd></dl>
      <span className="tscp-subtexto">Procedencia: {texto(publicacion.procedencia, 'No informada')}</span>
    </li>;
  })}</ul></details>;
}

export default function AgenteTscp({ perfil = {}, comportamiento = {}, contexto, onConfigurar, onActualizarMarca }) {
  const [guardado] = useState(leerGuardado);
  const [configuracion, setConfiguracion] = useState(() => crearConfiguracionTscp(perfil, guardado.configuracion || {}));
  const [referentes, setReferentes] = useState(() => Array.isArray(guardado.referentes) ? guardado.referentes : crearReferentesTscp());
  const [diagnostico, setDiagnostico] = useState(() => Array.isArray(guardado.diagnostico?.canales) ? guardado.diagnostico : null);
  const [contextoDiagnostico, setContextoDiagnostico] = useState(guardado.contextoDiagnostico || null);
  const [borradoresMetricas, setBorradoresMetricas] = useState(guardado.borradoresMetricas || {});
  const [ocupado, setOcupado] = useState(false);
  const [leyendoManual, setLeyendoManual] = useState(false);
  const [error, setError] = useState('');
  const [avisoManual, setAvisoManual] = useState('');
  const [avisoGuardado, setAvisoGuardado] = useState('');
  const [limiteGuia, setLimiteGuia] = useState(12);
  const resultadoRef = useRef(null);
  const enCurso = useRef(false);
  const perfilAnterior = useRef(perfil);
  const bloqueado = ocupado || leyendoManual;

  useEffect(() => {
    const anterior = crearConfiguracionTscp(perfilAnterior.current);
    const nuevo = crearConfiguracionTscp(perfil);
    perfilAnterior.current = perfil;
    setConfiguracion(actual => {
      const mision = !actual.mision || actual.mision === anterior.mision ? nuevo.mision : actual.mision;
      const vocabulario = !actual.vocabulario?.length || JSON.stringify(actual.vocabulario) === JSON.stringify(anterior.vocabulario) ? nuevo.vocabulario : actual.vocabulario;
      return { ...actual, mision, vocabulario, manual: perfil.manual_marca || actual.manual || null,
        marcaConfirmada: mision !== actual.mision || JSON.stringify(vocabulario) !== JSON.stringify(actual.vocabulario) ? false : actual.marcaConfirmada };
    });
  }, [perfil]);

  const perfilSolicitud = useMemo(() => ({
    nombre: perfil.nombre || 'TSCP', descripcion: perfil.descripcion || '', mision: perfil.mision || '', publico: perfil.publico || '',
    tono: perfil.tono || '', colores: perfil.colores || [], tipografias: perfil.tipografias || {},
    estilo_visual: perfil.estilo_visual || '', palabras_clave: perfil.palabras_clave || [],
    palabras_prohibidas: perfil.palabras_prohibidas || [], vocabulario_aprobado: perfil.vocabulario_aprobado || [], instrucciones: comportamiento.instrucciones || '',
  }), [perfil, comportamiento.instrucciones]);
  const firmaActual = JSON.stringify({ configuracion, referentes, perfil: perfilSolicitud });
  const cambiado = Boolean(diagnostico && (contextoDiagnostico?.firma !== firmaActual || Object.keys(borradoresMetricas).some(id => referentes.some(ref => ref.id === id && configuracion.redes.includes(ref.canal)))));
  const datosGuardar = useMemo(() => ({ configuracion, referentes, diagnostico, contextoDiagnostico, borradoresMetricas }), [configuracion, referentes, diagnostico, contextoDiagnostico, borradoresMetricas]);
  useGuardadoDiferido(CLAVE, datosGuardar, mensaje => setAvisoGuardado(mensaje ? 'No se pudo guardar en este navegador. Descarga el diagnóstico para conservarlo.' : ''));

  let rango = null;
  try { rango = validarConfiguracionTscp(configuracion); } catch { /* Se informa el detalle al enviar. */ }
  const guia = useMemo(() => {
    if (!diagnostico || !contextoDiagnostico) return null;
    try { return crearGuiaTscp(contextoDiagnostico.configuracion, diagnostico); }
    catch { return null; }
  }, [diagnostico, contextoDiagnostico]);
  const canalesElegidos = REDES_TSCP.filter(canal => configuracion.redes.includes(canal));
  const actualizar = (campo, valor) => setConfiguracion(actual => ({ ...actual, [campo]: valor, ...(['mision', 'vocabulario'].includes(campo) ? { marcaConfirmada: false } : {}) }));
  const actualizarReferente = (id, campo, valor) => setReferentes(actuales => actuales.map(ref => ref.id === id ? { ...ref, [campo]: valor, ...(['url', 'cuenta', 'paginaId', 'nombre'].includes(campo) ? { identificacion: null } : {}) } : ref));

  const agregarReferente = canal => setReferentes(actuales => {
    if (actuales.filter(ref => ref.canal === canal).length >= 3) return actuales;
    return [...actuales, { id: crypto.randomUUID(), canal, nombre: '', url: '', cuenta: '', paginaId: '', seguidores: null, publicaciones: [], fechaConsulta: '', periodoDias: 30 }];
  });

  const prepararReferentes = () => referentes.filter(ref => configuracion.redes.includes(ref.canal)).map(ref => {
    if (!Object.hasOwn(borradoresMetricas, ref.id)) return ref;
    let publicaciones;
    try { publicaciones = JSON.parse(borradoresMetricas[ref.id] || '[]'); }
    catch { throw new Error(`Revisa las publicaciones de ${ref.nombre || ref.canal}: el JSON no es válido.`); }
    if (!Array.isArray(publicaciones) || publicaciones.some(p => !p || typeof p !== 'object' || Array.isArray(p))) throw new Error(`Las publicaciones de ${ref.nombre || ref.canal} deben ser un arreglo de objetos.`);
    return { ...ref, publicaciones };
  }).filter(ref => ref.nombre?.trim() || ref.url?.trim() || ref.cuenta?.trim() || ref.paginaId?.trim());

  const generar = async evento => {
    evento.preventDefault();
    if (enCurso.current) return;
    setError('');
    try {
      validarConfiguracionTscp(configuracion);
      const referencias = prepararReferentes();
      const referenciasGuardadas = referentes.map(ref => referencias.find(preparada => preparada.id === ref.id) || ref);
      const snapshot = JSON.parse(JSON.stringify({ configuracion, referentes: referencias, perfil: perfilSolicitud }));
      snapshot.firma = JSON.stringify({ configuracion, referentes: referenciasGuardadas, perfil: perfilSolicitud });
      enCurso.current = true;
      setOcupado(true);
      setReferentes(referenciasGuardadas);
      setBorradoresMetricas(actuales => Object.fromEntries(Object.entries(actuales).filter(([id]) => !referencias.some(ref => ref.id === id))));
      const respuesta = await llamarApi('/api/diagnostico-tscp', { configuracion: snapshot.configuracion, perfil: snapshot.perfil, referentes: snapshot.referentes });
      if (!respuesta || !Array.isArray(respuesta.canales)) throw new Error('El diagnóstico no llegó completo. Puedes volver a intentarlo con la misma configuración.');
      if (Array.isArray(respuesta.referenciasResueltas)) {
        const actualizadas = fusionarReferencias(referenciasGuardadas, respuesta.referenciasResueltas, snapshot.configuracion.redes);
        snapshot.referentes = actualizadas.filter(ref => snapshot.configuracion.redes.includes(ref.canal));
        snapshot.firma = JSON.stringify({ configuracion: snapshot.configuracion, referentes: actualizadas, perfil: snapshot.perfil });
        setReferentes(actualizadas);
      }
      setDiagnostico(respuesta);
      setContextoDiagnostico(snapshot);
      setLimiteGuia(12);
      requestAnimationFrame(() => resultadoRef.current?.focus());
    } catch (fallo) { setError(fallo.message || 'No se pudo preparar el diagnóstico.'); }
    finally { enCurso.current = false; setOcupado(false); }
  };

  const analizarManual = async evento => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo || bloqueado) return;
    setError(''); setAvisoManual('');
    if ((!archivo.type && !/\.pdf$/i.test(archivo.name)) || (archivo.type && archivo.type !== 'application/pdf')) return setError('Selecciona un manual en PDF.');
    if (archivo.size > 2 * 1024 * 1024) return setError('El manual debe pesar hasta 2 MB. Usa las páginas de misión, identidad y tono.');
    setLeyendoManual(true);
    try {
      const documento = await leerComoDataUrl(archivo);
      const resultado = await llamarApi('/api/analizar-marca', { documento, imagenes: [], descripcion: perfil.descripcion || '' });
      if (!resultado?.perfil) throw new Error('No se pudo extraer la identidad del manual.');
      const aprendido = Object.fromEntries(Object.entries(resultado.perfil).filter(([, valor]) => Array.isArray(valor) ? valor.length : typeof valor === 'string' ? valor.trim() : valor && typeof valor === 'object' ? Object.values(valor).some(Boolean) : Boolean(valor)));
      const manual = { nombre: archivo.name, analizado: true, fecha: new Date().toISOString() };
      const actualizado = { ...perfil, ...aprendido, tipografias: { ...perfil.tipografias, ...aprendido.tipografias }, manual_marca: manual };
      const guardado = await onActualizarMarca?.(actualizado);
      if (guardado === false) throw new Error('Se analizó el manual, pero no se pudo guardar la marca. Vuelve a intentarlo.');
      setConfiguracion(actual => ({ ...actual, mision: aprendido.mision || aprendido.descripcion || actual.mision, vocabulario: aprendido.vocabulario_aprobado?.length ? aprendido.vocabulario_aprobado : aprendido.palabras_clave?.length ? aprendido.palabras_clave : actual.vocabulario, manual, marcaConfirmada: false }));
      setAvisoManual('Manual analizado. Revisa la misión y el vocabulario antes de confirmarlos.');
    } catch (fallo) { setError(fallo.message || 'No se pudo analizar el manual.'); }
    finally { setLeyendoManual(false); }
  };

  const exportar = tipo => {
    if (!diagnostico || !contextoDiagnostico || !guia) return;
    const nombre = `tscp-${contextoDiagnostico.configuracion.inicio}`;
    if (tipo === 'json') descargarArchivo(`${nombre}.json`, JSON.stringify({ version: 2, configuracion: contextoDiagnostico.configuracion, referentes: contextoDiagnostico.referentes, diagnostico, guia }, null, 2), 'application/json');
    else descargarArchivo(`${nombre}.md`, exportarGuiaTscp(contextoDiagnostico.configuracion, diagnostico, guia), 'text/markdown;charset=utf-8');
  };

  const nombreReferente = id => (contextoDiagnostico?.referentes || referentes).find(ref => ref.id === id)?.nombre || id || 'Referente por confirmar';
  return <section className="agente-tscp" aria-label="Campaña y diagnóstico TSCP">
    <form className="panel-card tscp-panel" onSubmit={generar}>
      <h3>Paso 0 · Configura la campaña</h3>
      <fieldset className="tscp-formulario" disabled={bloqueado}>
        <legend className="tscp-solo-lector">Configuración de la campaña</legend>
        <div className="tscp-campos-iniciales">
          <label>Destinatario<select aria-label="Destinatario" value={configuracion.objetivoTipo} onChange={e => setConfiguracion(actual => ({ ...actual, objetivoTipo: e.target.value, objetivo: !actual.objetivo.trim() || actual.objetivo === OBJETIVOS_TSCP[actual.objetivoTipo] ? OBJETIVOS_TSCP[e.target.value] : actual.objetivo }))}><option value="voluntario">Voluntario</option><option value="empresa">Empresa</option></select></label>
          <label>Objetivo de la campaña<textarea aria-label="Objetivo de la campaña" required maxLength={1200} value={configuracion.objetivo} onChange={e => actualizar('objetivo', e.target.value)} placeholder="Qué quieres conseguir y con qué público" rows={2} /></label>
          <label>Fecha de inicio<input aria-label="Fecha de inicio" required type="date" min="2020-01-01" max="2100-12-31" value={configuracion.inicio} onChange={e => actualizar('inicio', e.target.value)} /></label>
          <div className="tscp-duracion"><label>Duración<input aria-label="Duración" required type="number" min="1" max={configuracion.unidad === 'meses' ? 12 : configuracion.unidad === 'semanas' ? 52 : 366} value={configuracion.cantidad} onChange={e => actualizar('cantidad', e.target.value === '' ? '' : Number(e.target.value))} /></label><label><span className="tscp-solo-lector">Unidad de duración</span><select aria-label="Unidad de duración" value={configuracion.unidad} onChange={e => actualizar('unidad', e.target.value)}>{Object.entries(UNIDADES).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}</select></label></div>
        </div>
        <p className="tscp-ayuda">De 1 a 366 días.{rango && ` Período: ${configuracion.inicio} → ${rango.fin} · ${rango.dias} días.`} Revisa que el objetivo corresponda al destinatario elegido.</p>
        <fieldset className="tscp-canales"><legend>Canales de la campaña</legend>{REDES_TSCP.map(canal => <label key={canal}><input type="checkbox" checked={configuracion.redes.includes(canal)} onChange={e => actualizar('redes', REDES_TSCP.filter(red => red === canal ? e.target.checked : configuracion.redes.includes(red)))} />{canal}</label>)}</fieldset>

        <details className="tscp-detalle"><summary>Marca, lenguaje y contexto · {perfil.nombre || 'TSCP'}</summary>
          <p className="tscp-ayuda">Partimos del perfil de marca guardado. Revisa estos datos para esta campaña.</p>
          <div className="tscp-grid-dos"><label>Misión<textarea aria-label="Misión" maxLength={3000} value={configuracion.mision || ''} onChange={e => actualizar('mision', e.target.value)} placeholder="Qué hace TSCP, para quién y por qué" /></label><label>Vocabulario de la marca<textarea aria-label="Vocabulario de la marca" maxLength={2000} value={(configuracion.vocabulario || []).join('\n')} onChange={e => actualizar('vocabulario', e.target.value.split('\n'))} placeholder="Una palabra o expresión por línea" /></label></div>
          <div className="tscp-grid-dos">{canalesElegidos.map(canal => <label key={canal}>Lenguaje en {canal}<input maxLength={500} value={configuracion.lenguajes?.[canal] || ''} onChange={e => actualizar('lenguajes', { ...configuracion.lenguajes, [canal]: e.target.value })} placeholder="Tono, estilo y forma de dirigirse al público" /></label>)}</div>
          <div className="tscp-grid-tres"><label>Idioma<input maxLength={80} value={configuracion.idioma || ''} onChange={e => actualizar('idioma', e.target.value)} /></label><label>País de referencia<select value={configuracion.pais} onChange={e => actualizar('pais', e.target.value)}>{[['US', 'Estados Unidos'], ['BO', 'Bolivia'], ['AR', 'Argentina'], ['CL', 'Chile'], ['CO', 'Colombia'], ['MX', 'México'], ['PE', 'Perú'], ['ES', 'España'], ['CA', 'Canadá'], ['GB', 'Reino Unido'], ['BR', 'Brasil'], ['DE', 'Alemania'], ['FR', 'Francia'], ['IN', 'India'], ['AU', 'Australia'], ['ZA', 'Sudáfrica'], ['KE', 'Kenia']].map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}</select></label><label>Zona horaria<input required maxLength={80} value={configuracion.zona || ''} onChange={e => actualizar('zona', e.target.value)} placeholder="America/New_York" /></label></div>
          <div className="tscp-manual"><div><strong>Manual de marca</strong><p>{configuracion.manual?.nombre ? `${configuracion.manual.nombre} · ${configuracion.manual.analizado ? 'Analizado' : 'Pendiente de analizar'}` : 'No hay un manual registrado en esta campaña.'}</p></div><div className="tscp-acciones">{onActualizarMarca && <label className="tscp-archivo">{leyendoManual ? 'Analizando manual…' : 'Analizar manual PDF'}<input disabled={bloqueado} type="file" accept="application/pdf,.pdf" onChange={analizarManual} /></label>}{onConfigurar && <button type="button" className="btn-secundario" onClick={onConfigurar}>Editar perfil de marca</button>}</div></div>
          <p className="tscp-ayuda">PDF de hasta 2 MB. Se conserva la identidad extraída y el nombre del manual; el archivo no se guarda en este navegador.</p>
          {avisoManual && <p role="status">{avisoManual}</p>}
          <label className="tscp-confirmacion"><input type="checkbox" checked={Boolean(configuracion.marcaConfirmada)} onChange={e => actualizar('marcaConfirmada', e.target.checked)} />He revisado la misión y el vocabulario de esta campaña.</label>
        </details>

        <details className="tscp-detalle"><summary>Referentes para el diagnóstico · hasta 3 por canal</summary>
          <p className="tscp-ayuda">Good360 y TechSoup son candidatos propuestos por Marketing. Al preparar el diagnóstico se buscan sus perfiles y otras referencias con las fuentes disponibles. Puedes ajustar los resultados o aportar datos del equipo.</p>
          {canalesElegidos.map(canal => {
            const lista = referentes.filter(ref => ref.canal === canal);
            return <fieldset className="tscp-referentes" key={canal}><legend>{canal} · {lista.length}/3 candidatos</legend>
              {lista.map((ref, indice) => <div className="tscp-referente" key={ref.id}>
                <div className="tscp-grid-tres"><label>Referente {indice + 1}<input maxLength={160} value={ref.nombre || ''} onChange={e => actualizarReferente(ref.id, 'nombre', e.target.value)} placeholder="Nombre por confirmar" /></label><label>Enlace del perfil<input type="url" maxLength={1000} value={ref.url || ''} onChange={e => actualizarReferente(ref.id, 'url', e.target.value)} placeholder="https://…" /></label>{canal === 'Facebook' ? <label>ID de página, si lo tienes<input maxLength={100} value={ref.paginaId || ''} onChange={e => actualizarReferente(ref.id, 'paginaId', e.target.value)} /></label> : <label>Cuenta, si la conoces<input maxLength={120} value={ref.cuenta || ''} onChange={e => actualizarReferente(ref.id, 'cuenta', e.target.value)} placeholder="Sin @ ni URL" /></label>}</div>
                {ref.identificacion?.sustituye && <p className="tscp-ayuda">Alternativa a {ref.identificacion.sustituye}: {texto(ref.identificacion.motivo, 'Se propone otra organización con perfil localizado.')}</p>}
                <details className="tscp-datos-manuales"><summary>Añadir observaciones del equipo (opcional)</summary><p className="tscp-ayuda">Estos datos se identificarán como aportados por el equipo. Usa la fecha en que observaste la cuenta; no sustituyen una consulta del proveedor.</p><div className="tscp-grid-dos"><label>Seguidores observados<input type="number" min="0" step="1" value={ref.seguidores ?? ''} onChange={e => actualizarReferente(ref.id, 'seguidores', e.target.value === '' ? null : Number(e.target.value))} /></label><label>Fecha de observación<input type="date" value={(ref.fechaConsulta || '').slice(0, 10)} onChange={e => actualizarReferente(ref.id, 'fechaConsulta', e.target.value)} /></label></div><label>Publicaciones observadas (JSON)<textarea aria-label="Publicaciones observadas (JSON)" className="tscp-json" value={borradoresMetricas[ref.id] ?? (ref.publicaciones?.length ? JSON.stringify(ref.publicaciones, null, 2) : '')} onChange={e => setBorradoresMetricas(actuales => ({ ...actuales, [ref.id]: e.target.value }))} placeholder={'[{"fecha":"AAAA-MM-DD","url":"https://…","reacciones":12,"comentarios":3,"compartidos":1,"cta":"Learn more","formato":"Carrusel"}]'} spellCheck={false} /></label></details>
                <button type="button" className="btn-texto tscp-quitar" onClick={() => setReferentes(actuales => actuales.filter(item => item.id !== ref.id))} aria-label={`Quitar ${ref.nombre || `referente ${indice + 1}`} de ${canal}`}>Quitar referente</button>
              </div>)}
              {lista.length < 3 && <button type="button" className="btn-secundario" onClick={() => agregarReferente(canal)}>Añadir {lista.length === 2 ? 'tercer ' : ''}referente de {canal}</button>}
            </fieldset>;
          })}
        </details>

        {contexto?.referencias?.length > 0 && <details className="tscp-detalle"><summary>Referencias de inspiración recibidas · {contexto.referencias.length}</summary><p className="tscp-ayuda">Estos enlaces vienen de Fuentes y tendencias. Son inspiración para revisar con el equipo; no sustituyen los perfiles ni las métricas del diagnóstico de referentes.</p><Fuentes fuentes={contexto.referencias} /></details>}
        <div className="tscp-pie-formulario"><div><strong>Paso 1 · Diagnóstico y guía orientativa</strong><p className="tscp-ayuda">Revisamos los referentes disponibles y proponemos segmentación, mensaje y estructura de trabajo.</p></div><button type="submit" className="btn-guardar">{ocupado ? 'Preparando diagnóstico…' : 'Preparar diagnóstico y guía'}</button></div>
      </fieldset>
    </form>

    {(error || avisoGuardado) && <p className="tscp-error" role="alert">{error || avisoGuardado}</p>}
    {ocupado && <p className="tscp-estado" role="status">Buscando perfiles y referencias con las fuentes disponibles para apoyar las sugerencias.</p>}

    {diagnostico && <section className="panel-card tscp-panel tscp-resultados" ref={resultadoRef} tabIndex={-1} aria-label="Resultado del diagnóstico">
      <div className="tscp-cabecera-resultados"><div><h3>Paso 1 · Diagnóstico de la campaña</h3><p className="tscp-ayuda">{fechaConsulta(diagnostico.consultado)} · {contextoDiagnostico?.configuracion.inicio}{guia?.fin && ` → ${guia.fin}`}</p><p className="tscp-ayuda"><strong>Guía estratégica:</strong> {texto(diagnostico.estadoGuia, 'Pendiente de validación')}</p></div><div className="tscp-acciones"><button type="button" className="btn-secundario" disabled={!guia} onClick={() => exportar('json')}>Descargar diagnóstico JSON</button><button type="button" className="btn-secundario" disabled={!guia} onClick={() => exportar('markdown')}>Descargar guía Markdown</button></div></div>
      {diagnostico.estadoGuia === 'Pendiente' && <p className="tscp-aviso" role="status">La guía estratégica está pendiente. {diagnostico.falloGuia?.causa || 'Puedes revisar los datos y volver a intentarlo.'} Se conservan las observaciones disponibles. El cronograma inferior es solo una estructura editorial inicial.</p>}
      {!guia && <p className="tscp-aviso" role="status">No se pudo recuperar una configuración válida para esta guía. Revisa la campaña y prepara nuevamente el diagnóstico.</p>}
      {cambiado && <p className="tscp-aviso" role="status">La configuración cambió. Este diagnóstico y sus descargas conservan los datos de la consulta anterior; vuelve a prepararlo para aplicar los cambios.</p>}
      <div className="tscp-estados">{diagnostico.canales.map(canal => <p key={canal.canal}>
        <strong>{canal.canal}</strong>
        <span>{canal.estado === 'Pendiente' && diagnostico.apoyo?.fuentes?.length ? 'Apoyo temático disponible' : texto(canal.estado)}</span>
        <small>{canal.referentesIdentificados ?? canal.referentesSeleccionados ?? (canal.referentes || []).filter(ref => ref.url).length}/3 perfiles localizados · {canal.candidatos ?? (canal.referentes || []).length} candidatos</small>
        <small>{referentesConMetricas(canal)} perfiles con métricas disponibles. {texto(canal.detalle || canal.limite, 'Los enlaces localizados y las métricas leídas se comprueban por separado.')}</small>
      </p>)}</div>
      <ApoyoTscp apoyo={diagnostico.apoyo} />
      <Tabla titulo="Referentes y métricas disponibles">
        <thead><tr><th scope="col">Canal y referente</th><th scope="col">Seguidores</th><th scope="col">Publicaciones / semana</th><th scope="col">Reacciones medias</th><th scope="col">Estado y fuentes</th></tr></thead>
        <tbody>{diagnostico.canales.flatMap(canal => (canal.referentes?.length ? canal.referentes : [{ id: `${canal.canal}-pendiente`, nombre: 'Referentes pendientes', estado: canal.estado }]).map((ref, indice) => <tr key={`${canal.canal}-${ref.id || indice}`}>
          <th scope="row">{canal.canal}<span className="tscp-subtexto">{enlaceSeguro(ref.url) ? <a href={enlaceSeguro(ref.url)} target="_blank" rel="noopener noreferrer">{texto(ref.nombre, nombreReferente(ref.id))}</a> : texto(ref.nombre, nombreReferente(ref.id))}</span>{ref.identificacion && <span className="tscp-subtexto">{texto(ref.identificacion.estado, 'Perfil localizado')} · {texto(ref.identificacion.origen, 'Origen por confirmar')}</span>}{ref.identificacion?.sustituye && <span className="tscp-subtexto">Alternativa a {ref.identificacion.sustituye}: {texto(ref.identificacion.motivo, 'Perfil de otra organización localizado.')}</span>}<PublicacionesMuestra publicaciones={ref.publicaciones} /></th>
          <td>{numero(ref.seguidores)}<span className="tscp-subtexto">{texto(ref.procedenciaSeguidores, 'Sin procedencia informada')}</span></td>
          <td>{numero(ref.publicacionesPorSemana, 1)}{ref.resumen?.frecuencia?.muestra > 0 && <span className="tscp-subtexto">Muestra: {ref.resumen.frecuencia.muestra} publicaciones con fecha</span>}</td>
          <td>{numero(ref.reaccionesPromedio, 1)}</td>
          <td><strong>{texto(ref.estado, canal.estado)}</strong><details className="tscp-alcance"><summary>Alcance y fuentes</summary>{ref.detalle && <p className="tscp-ayuda">{ref.detalle}</p>}{ref.identificacion && <p className="tscp-ayuda">Identificación: {enlaceSeguro(ref.identificacion.url) ? <a href={enlaceSeguro(ref.identificacion.url)} target="_blank" rel="noopener noreferrer">{texto(ref.identificacion.origen)}</a> : texto(ref.identificacion.origen)} · {fechaConsulta(ref.identificacion.consultado)}</p>}<p className="tscp-ayuda">{texto(ref.limite, 'Frecuencia y reacciones describen la muestra disponible.')}</p>{(ref.fechaConsulta || ref.consultado) && <p className="tscp-ayuda">Observación: {fechaConsulta(ref.fechaConsulta || ref.consultado)}</p>}<Fuentes fuentes={ref.fuentes} catalogo={diagnostico.fuentes} /></details></td>
        </tr>))}</tbody>
      </Tabla>
      <p className="tscp-ayuda">“No disponible” significa que falta una lectura o una observación válida; no significa cero. Una muestra de publicaciones no representa toda la actividad de la cuenta ni garantiza rendimiento.</p>

      <Tabla titulo="Benchmark de contenido y llamados a la acción"><thead><tr><th scope="col">Referente y canal</th><th scope="col">Contenido y criterio de CTA</th><th scope="col">Recomendación para TSCP</th><th scope="col">Evidencia y límites</th></tr></thead><tbody>{(diagnostico.benchmark || []).length ? diagnostico.benchmark.map((fila, indice) => <tr key={`${fila.referenteId}-${fila.canal}-${indice}`}><th scope="row">{nombreReferente(fila.referenteId)}<span className="tscp-subtexto">{fila.canal}</span></th><td>{texto(fila.tipoContenido)}<p><strong>CTA / criterio:</strong> {texto(fila.cta, 'Sin CTA observado')}</p></td><td>{texto(fila.recomendacion)}<span className="tscp-subtexto">{texto(fila.estado, 'Propuesta por validar')}</span></td><td><Fuentes fuentes={fila.fuentes} catalogo={diagnostico.fuentes} /><p className="tscp-ayuda">{texto(fila.limite, 'Validar pertinencia para esta campaña.')}</p></td></tr>) : <tr><td colSpan={4}>Benchmark pendiente: confirma perfiles o incorpora observaciones con fuente.</td></tr>}</tbody></Tabla>

      <Tabla titulo="Segmentos, necesidades y objetivos propuestos"><thead><tr><th scope="col">Segmento</th><th scope="col">Necesidad</th><th scope="col">Objetivo</th><th scope="col">Canal y tono</th></tr></thead><tbody>{(diagnostico.segmentos || []).length ? diagnostico.segmentos.map((fila, indice) => <tr key={`${fila.segmento}-${indice}`}><th scope="row">{texto(fila.segmento)}</th><td>{texto(fila.necesidad)}</td><td>{texto(fila.objetivo)}</td><td>{texto(fila.canal)}<span className="tscp-subtexto">{texto(fila.tono)}</span></td></tr>) : <tr><td colSpan={4}>Segmentación pendiente de diagnóstico y revisión con Marketing.</td></tr>}</tbody></Tabla>
      <div className="tscp-mensaje"><h4>Mensaje central propuesto</h4><blockquote>{texto(diagnostico.mensaje?.central)}</blockquote><p className="tscp-ayuda">Base estratégica para desarrollar las piezas con Marketing.</p>{diagnostico.mensaje?.apoyos?.length > 0 && <ul className="tscp-apoyos">{diagnostico.mensaje.apoyos.map((apoyo, indice) => <li key={indice}><strong>{texto(apoyo.texto)}</strong><span className="tscp-subtexto">{texto(apoyo.estado, 'Por validar')}</span><Fuentes fuentes={apoyo.fuentes} catalogo={diagnostico.fuentes} /></li>)}</ul>}</div>
      {diagnostico.mensaje?.variantes?.length > 0 && <Tabla titulo="Variantes del mensaje por segmento"><thead><tr><th scope="col">Segmento</th><th scope="col">Enfoque del mensaje</th></tr></thead><tbody>{diagnostico.mensaje.variantes.map((variante, indice) => <tr key={indice}><th scope="row">{texto(variante.segmento)}</th><td>{texto(variante.mensaje)}</td></tr>)}</tbody></Tabla>}

      {guia && <SugerenciasTscp sugerencias={guia.sugerencias} catalogo={diagnostico.fuentes} />}

      {guia && <section className="tscp-guia" aria-label="Guía orientativa para Marketing"><h3>Guía orientativa para Marketing</h3><p>{guia.estado || 'Propuesta por confirmar con Marketing'}. Este cronograma plantea objetivos, formatos y estructuras; las piezas finales quedan pendientes de producción y aprobación.</p><FrecuenciaTscp guia={guia} /><Tabla titulo={`Cronograma orientativo · ${(guia.publicaciones || []).length} salidas`} id="tscp-cronograma"><thead><tr><th scope="col">Fecha</th><th scope="col">Objetivo</th><th scope="col">Canal y formato</th><th scope="col">Tema y estructura</th><th scope="col">Segmento y CTA propuesto</th></tr></thead><tbody>{(guia.publicaciones || []).slice(0, limiteGuia).map((fila, indice) => <tr key={fila.id || `${fila.fecha}-${fila.red}-${indice}`}><th scope="row"><time dateTime={fila.fecha}>{fila.fecha}</time></th><td>{texto(fila.objetivo)}<span className="tscp-subtexto">{texto(fila.proposito)}</span></td><td>{fila.red}<span className="tscp-subtexto">{fila.formato}</span></td><td><strong>{texto(fila.tema)}</strong><details className="tscp-alcance"><summary>Ver estructura de trabajo</summary><Lista valores={fila.estructura} />{fila.sugerenciaId && <p><a href={`#${fila.sugerenciaId}`} onClick={() => { const ejemplo = document.getElementById(fila.sugerenciaId); if (ejemplo) ejemplo.open = true; }}>Ver ejemplo de copy y hashtags</a></p>}</details></td><td>{texto(fila.segmento)}<span className="tscp-subtexto">{texto(fila.cta)}</span></td></tr>)}</tbody></Tabla>{(guia.publicaciones || []).length > limiteGuia && <div className="tscp-acciones"><p className="tscp-ayuda">Mostrando {limiteGuia} de {guia.publicaciones.length}. Las descargas incluyen todo el período.</p><button type="button" className="btn-secundario" aria-controls="tscp-cronograma" onClick={() => setLimiteGuia(actual => actual + 12)}>Mostrar otras 12 salidas</button></div>}
        {guia.emails?.length > 0 && <details className="tscp-detalle"><summary>Email de apoyo · estructura por contacto</summary><p className="tscp-ayuda">Días relativos al primer contacto. Confirmar lista, responsable, condiciones y baja antes de redactar o enviar.</p><Tabla titulo="Estructura orientativa de seguimiento por email"><thead><tr><th scope="col">Día</th><th scope="col">Objetivo</th><th scope="col">Condición</th><th scope="col">Estructura</th></tr></thead><tbody>{guia.emails.map((email, indice) => <tr key={`${email.dia}-${indice}`}><th scope="row">{email.dia}</th><td>{texto(email.objetivo)}</td><td>{texto(email.condicion)}</td><td><Lista valores={email.estructura} /></td></tr>)}</tbody></Tabla></details>}
        <h4>Pendientes del paso 2 · Marketing</h4><Lista valores={guia.pendientesPaso2} />
      </section>}

      <details className="tscp-detalle"><summary>Pendientes de validación y alcance de las fuentes</summary><h4>Por confirmar con el equipo</h4><Lista valores={diagnostico.pendientes} /><h4>Límites del diagnóstico</h4><Lista valores={diagnostico.limites} />{guia?.limites?.length > 0 && <><h4>Alcance de la guía</h4><Lista valores={guia.limites} /></>}</details>
    </section>}
    <ConexionesApis />
    <p className="tscp-ayuda tscp-guardado">La configuración y el diagnóstico se conservan en este navegador. Descarga una copia para compartir el trabajo con el equipo.</p>
  </section>;
}
