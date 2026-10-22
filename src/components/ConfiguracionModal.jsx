import { useEffect, useRef, useState } from 'react';
import { ChipsInput, Icono, Interruptor, OpcionesTarjeta, Segmentado, ZonaArchivos } from './ui';
import { comprimirImagen, esImagen, leerComoDataUrl } from '../lib/archivos';
import { exportarConfiguracion, importarConfiguracion } from '../lib/configuracion';
import { llamarApi } from '../lib/api';

const MAX_MUESTRAS = 8;
const MAX_REFERENCIAS = 6;
const MAX_MANUAL_MB = 2;

const PASOS = [
  { titulo: 'Enseñar mi marca', descripcion: 'La herramienta aprende sola' },
  { titulo: 'Mi marca', descripcion: 'Revisa y ajusta' },
  { titulo: 'Cómo revisar', descripcion: 'Exigencia y estilo' }
];

const CATEGORIAS = [
  { clave: 'colores', titulo: 'Colores', descripcion: 'Que se usen solo los colores de la marca' },
  { clave: 'tipografia', titulo: 'Tipografías', descripcion: 'Fuentes correctas y texto legible' },
  { clave: 'margenes', titulo: 'Márgenes y espacios', descripcion: 'Nada pegado al borde ni tapado por la app' },
  { clave: 'contexto', titulo: 'Mensaje y tono', descripcion: 'Tono de voz y llamado a la acción' },
  { clave: 'gramatica', titulo: 'Ortografía', descripcion: 'Faltas de ortografía y redacción' }
];

const REDES = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok'];

const miniatura = archivo => comprimirImagen(archivo, { lado: 512, calidad: 0.72 });

const tieneValor = v => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : Boolean(v));

// Combina lo aprendido con lo que ya existía: lo nuevo reemplaza solo si trae información
function fusionarPerfil(actual, aprendido, nuevasReferencias) {
  const resultado = { ...actual };
  Object.entries(aprendido).forEach(([clave, valor]) => {
    if (clave === 'tipografias') {
      resultado.tipografias = { ...actual.tipografias };
      Object.entries(valor).forEach(([sub, v]) => {
        if (tieneValor(v)) resultado.tipografias[sub] = v;
      });
    } else if (tieneValor(valor)) {
      resultado[clave] = valor;
    }
  });
  if (nuevasReferencias.length) resultado.referencias = nuevasReferencias.slice(0, MAX_REFERENCIAS);
  return resultado;
}

export default function ConfiguracionModal({ configuracion, configurado, onCerrar, onGuardar, onRestablecer }) {
  const [paso, setPaso] = useState(configurado ? 1 : 0);
  const [perfil, setPerfil] = useState(configuracion.perfil);
  const [comportamiento, setComportamiento] = useState(configuracion.comportamiento);
  const [aviso, setAviso] = useState(null);

  const [muestras, setMuestras] = useState([]);
  const [manual, setManual] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState('');

  const importarRef = useRef(null);
  const manualRef = useRef(null);

  const hayCambios =
    JSON.stringify({ perfil, comportamiento }) !==
    JSON.stringify({ perfil: configuracion.perfil, comportamiento: configuracion.comportamiento });

  const cerrar = () => {
    if (analizando) return;
    if (hayCambios && !window.confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return;
    onCerrar();
  };

  const cerrarRef = useRef(cerrar);
  cerrarRef.current = cerrar;

  useEffect(() => {
    const handleKey = e => e.key === 'Escape' && cerrarRef.current();
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, []);

  const actualizarPerfil = (clave, valor) => setPerfil(prev => ({ ...prev, [clave]: valor }));
  const actualizarTipografia = (clave, valor) =>
    setPerfil(prev => ({ ...prev, tipografias: { ...prev.tipografias, [clave]: valor } }));
  const actualizarComportamiento = (clave, valor) => setComportamiento(prev => ({ ...prev, [clave]: valor }));

  // --- Paso 1: aprender ---
  const agregarMuestras = async archivos => {
    setErrorAnalisis('');
    const validos = archivos.filter(esImagen).slice(0, MAX_MUESTRAS - muestras.length);
    if (validos.length < archivos.length) {
      setErrorAnalisis(`Solo se aceptan imágenes PNG, JPG o WebP, hasta ${MAX_MUESTRAS} en total.`);
    }
    try {
      const nuevas = await Promise.all(validos.map(async archivo => ({ archivo, miniatura: await miniatura(archivo) })));
      setMuestras(prev => [...prev, ...nuevas].slice(0, MAX_MUESTRAS));
    } catch (e) {
      setErrorAnalisis(e.message);
    }
  };

  const seleccionarManual = async e => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (archivo.type !== 'application/pdf') {
      setErrorAnalisis('El manual debe estar en formato PDF.');
      return;
    }
    if (archivo.size > MAX_MANUAL_MB * 1024 * 1024) {
      setErrorAnalisis(
        `El manual pesa más de ${MAX_MANUAL_MB} MB. Comprímelo o exporta solo las páginas de colores, tipografías y tono.`
      );
      return;
    }
    setErrorAnalisis('');
    setManual({ nombre: archivo.name, dataUrl: await leerComoDataUrl(archivo) });
  };

  const puedeAnalizar = muestras.length > 0 || manual || descripcion.trim();

  const analizar = async () => {
    setAnalizando(true);
    setErrorAnalisis('');
    try {
      // Con manual adjunto se reducen las imágenes para no superar el límite del servidor
      const opciones = manual ? { lado: 768, calidad: 0.75 } : { lado: 1024, calidad: 0.8 };
      const imagenes = await Promise.all(muestras.map(m => comprimirImagen(m.archivo, opciones)));
      const resultado = await llamarApi('/api/analizar-marca', {
        imagenes,
        documento: manual?.dataUrl || null,
        descripcion
      });

      setPerfil(prev => fusionarPerfil(prev, resultado.perfil, muestras.map(m => m.miniatura)));
      if (resultado.instrucciones) {
        setComportamiento(prev => (prev.instrucciones ? prev : { ...prev, instrucciones: resultado.instrucciones }));
      }
      setAviso({
        tipo: 'exito',
        titulo: 'Listo, esto es lo que entendimos de tu marca',
        texto: resultado.notas
          ? `Revisa y corrige lo que haga falta. Nota: ${resultado.notas}`
          : 'Revisa y corrige lo que haga falta antes de guardar.'
      });
      setPaso(1);
    } catch (e) {
      setErrorAnalisis(e.message);
    } finally {
      setAnalizando(false);
    }
  };

  // --- Paso 2: colores y referencias ---
  const actualizarColor = (indice, cambios) =>
    actualizarPerfil(
      'colores',
      perfil.colores.map((c, i) => (i === indice ? { ...c, ...cambios } : c))
    );

  const agregarReferencias = async archivos => {
    const validos = archivos.filter(esImagen).slice(0, MAX_REFERENCIAS - perfil.referencias.length);
    const nuevas = await Promise.all(validos.map(miniatura));
    setPerfil(prev => ({ ...prev, referencias: [...prev.referencias, ...nuevas].slice(0, MAX_REFERENCIAS) }));
  };

  // --- Acciones generales ---
  const guardar = () => {
    if (!Object.values(comportamiento.revisar).some(Boolean)) {
      setPaso(2);
      setAviso({ tipo: 'error', titulo: 'Activa al menos un aspecto a revisar' });
      return;
    }
    const ok = onGuardar({ perfil, comportamiento });
    if (!ok) {
      setAviso({
        tipo: 'error',
        titulo: 'No se pudo guardar',
        texto: 'El navegador no tiene espacio suficiente. Quita algunas imágenes de referencia e inténtalo de nuevo.'
      });
    }
  };

  const importar = async e => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    try {
      const datos = await importarConfiguracion(archivo);
      setPerfil(datos.perfil);
      setComportamiento(datos.comportamiento);
      setPaso(1);
      setAviso({ tipo: 'exito', titulo: 'Configuración importada', texto: 'Revísala y pulsa "Guardar" para aplicarla.' });
    } catch (err) {
      setAviso({ tipo: 'error', titulo: 'No se pudo importar', texto: err.message || 'El archivo no es válido.' });
    }
  };

  const restablecer = () => {
    if (window.confirm('Se borrará toda la configuración de la marca. ¿Continuar?')) onRestablecer();
  };

  return (
    <div className="modal-fondo" onMouseDown={e => e.target === e.currentTarget && cerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <header className="modal-encabezado">
          <div>
            <h2 id="modal-titulo">Configuración de marca</h2>
            <p>Enséñale a la herramienta cómo es tu marca y cómo quieres que revise.</p>
          </div>
          <button type="button" className="btn-icono" onClick={cerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </header>

        <nav className="pasos" aria-label="Pasos de configuración">
          {PASOS.map((p, i) => (
            <button
              key={p.titulo}
              type="button"
              className={`paso ${paso === i ? 'activo' : ''}`}
              onClick={() => !analizando && setPaso(i)}
            >
              <span className="paso-numero">{i + 1}</span>
              <span className="paso-texto">
                <span className="paso-titulo">{p.titulo}</span>
                <span className="paso-descripcion">{p.descripcion}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="modal-cuerpo">
          {aviso && (
            <div className={`aviso aviso-${aviso.tipo}`}>
              <Icono nombre={aviso.tipo === 'exito' ? 'check' : 'alerta'} tamano={18} />
              <div>
                <strong>{aviso.titulo}</strong>
                {aviso.texto && <p>{aviso.texto}</p>}
              </div>
              <button type="button" className="btn-icono btn-icono-sm" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
                <Icono nombre="cerrar" tamano={14} />
              </button>
            </div>
          )}

          {paso === 0 && (
            <div className="paso-contenido">
              <div className="intro-paso">
                <h3>Muéstranos tu marca y nosotros hacemos el resto</h3>
                <p>
                  Con lo que tengas a mano basta: unas cuantas publicaciones, tu manual de marca o solo una descripción. La
                  herramienta detectará tus colores, tipografías y tono de voz.
                </p>
              </div>

              <div className="field-group">
                <label className="field-label">
                  Publicaciones de tu marca <span className="etiqueta-opcional">Recomendado</span>
                </label>
                <ZonaArchivos
                  miniaturas={muestras.map(m => m.miniatura)}
                  onAgregar={agregarMuestras}
                  onQuitar={i => setMuestras(prev => prev.filter((_, j) => j !== i))}
                  max={MAX_MUESTRAS}
                  titulo="Sube entre 3 y 8 publicaciones que te gusten"
                  ayuda="Mientras más variadas, mejor. También quedarán como referencia para las revisiones."
                  deshabilitado={analizando}
                />
              </div>

              <div className="field-group">
                <label className="field-label">
                  Manual de marca <span className="etiqueta-opcional">Opcional</span>
                </label>
                {manual ? (
                  <div className="archivo-adjunto">
                    <Icono nombre="documento" />
                    <span>{manual.nombre}</span>
                    {!analizando && (
                      <button type="button" className="btn-texto" onClick={() => setManual(null)}>
                        Quitar
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-secundario"
                    onClick={() => manualRef.current?.click()}
                    disabled={analizando}
                  >
                    <Icono nombre="documento" tamano={16} />
                    Adjuntar PDF (máx. {MAX_MANUAL_MB} MB)
                  </button>
                )}
                <input ref={manualRef} type="file" accept="application/pdf" hidden onChange={seleccionarManual} />
              </div>

              <div className="field-group">
                <label htmlFor="descripcion-marca" className="field-label">
                  Cuéntanos de tu marca y cómo quieres que revise <span className="etiqueta-opcional">Opcional</span>
                </label>
                <textarea
                  id="descripcion-marca"
                  className="input-textarea"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  disabled={analizando}
                  placeholder="Ej: Somos una consultora de logística. Hablamos de usted, con un tono profesional pero cercano. Nuestro color principal es el azul marino y nunca usamos emojis. Sé exigente con la ortografía."
                />
              </div>

              {errorAnalisis && <div className="aviso aviso-error aviso-simple">{errorAnalisis}</div>}

              <button
                type="button"
                className="btn-primary-action"
                onClick={analizar}
                disabled={!puedeAnalizar || analizando}
              >
                {analizando ? (
                  <>
                    <span className="loader-spinner" />
                    <span>Analizando tu marca… puede tardar hasta un minuto</span>
                  </>
                ) : (
                  <>
                    <Icono nombre="chispa" tamano={16} />
                    <span>Analizar mi marca</span>
                  </>
                )}
              </button>
              <button type="button" className="btn-texto btn-centrado" onClick={() => setPaso(1)} disabled={analizando}>
                Prefiero completarlo a mano →
              </button>
            </div>
          )}

          {paso === 1 && (
            <div className="paso-contenido">
              <section className="seccion-config">
                <h3>Identidad</h3>
                <div className="field-group">
                  <label htmlFor="nombre-marca" className="field-label">Nombre de la marca</label>
                  <input
                    id="nombre-marca"
                    className="input-texto"
                    value={perfil.nombre}
                    onChange={e => actualizarPerfil('nombre', e.target.value)}
                    placeholder="Ej: The Supply Chain Project"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="descripcion-perfil" className="field-label">¿A qué se dedica?</label>
                  <input
                    id="descripcion-perfil"
                    className="input-texto"
                    value={perfil.descripcion}
                    onChange={e => actualizarPerfil('descripcion', e.target.value)}
                    placeholder="Ej: Formación y consultoría en cadena de suministro"
                  />
                </div>
              </section>

              <section className="seccion-config">
                <h3>Colores</h3>
                <p className="seccion-ayuda">Haz clic en el cuadro de color para cambiarlo.</p>
                <div className="lista-colores">
                  {perfil.colores.map((color, i) => (
                    <div key={i} className="fila-color">
                      <input
                        type="color"
                        className="selector-color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(color.hex) ? color.hex : '#000000'}
                        onChange={e => actualizarColor(i, { hex: e.target.value.toUpperCase() })}
                        aria-label="Elegir color"
                      />
                      <input
                        className="input-texto input-hex"
                        value={color.hex}
                        onChange={e => actualizarColor(i, { hex: e.target.value.toUpperCase() })}
                        maxLength={7}
                        aria-label="Código del color"
                      />
                      <input
                        className="input-texto"
                        value={color.nombre}
                        onChange={e => actualizarColor(i, { nombre: e.target.value })}
                        placeholder="Nombre o uso (ej: Azul principal)"
                        aria-label="Nombre del color"
                      />
                      <button
                        type="button"
                        className="btn-icono btn-icono-sm"
                        onClick={() => actualizarPerfil('colores', perfil.colores.filter((_, j) => j !== i))}
                        aria-label="Quitar color"
                      >
                        <Icono nombre="cerrar" tamano={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {perfil.colores.length < 12 && (
                  <button
                    type="button"
                    className="btn-secundario"
                    onClick={() => actualizarPerfil('colores', [...perfil.colores, { hex: '#1A2B3C', nombre: '' }])}
                  >
                    <Icono nombre="mas" tamano={16} />
                    Agregar color
                  </button>
                )}
              </section>

              <section className="seccion-config">
                <h3>Tipografías</h3>
                <div className="fila-doble">
                  <div className="field-group">
                    <label htmlFor="tipo-titulos" className="field-label">Para títulos</label>
                    <input
                      id="tipo-titulos"
                      className="input-texto"
                      value={perfil.tipografias.titulos}
                      onChange={e => actualizarTipografia('titulos', e.target.value)}
                      placeholder="Ej: Montserrat Bold"
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="tipo-cuerpo" className="field-label">Para textos</label>
                    <input
                      id="tipo-cuerpo"
                      className="input-texto"
                      value={perfil.tipografias.cuerpo}
                      onChange={e => actualizarTipografia('cuerpo', e.target.value)}
                      placeholder="Ej: Open Sans Regular"
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label htmlFor="tipo-notas" className="field-label">Reglas de uso</label>
                  <input
                    id="tipo-notas"
                    className="input-texto"
                    value={perfil.tipografias.notas}
                    onChange={e => actualizarTipografia('notas', e.target.value)}
                    placeholder="Ej: Títulos siempre en mayúsculas, máximo 2 fuentes por pieza"
                  />
                </div>
              </section>

              <section className="seccion-config">
                <h3>Voz y mensaje</h3>
                <div className="field-group">
                  <label htmlFor="tono" className="field-label">Tono de voz</label>
                  <textarea
                    id="tono"
                    className="input-textarea input-textarea-corto"
                    value={perfil.tono}
                    onChange={e => actualizarPerfil('tono', e.target.value)}
                    placeholder="Ej: Profesional pero cercano, hablamos de usted, frases cortas"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="publico" className="field-label">¿A quién le hablamos?</label>
                  <input
                    id="publico"
                    className="input-texto"
                    value={perfil.publico}
                    onChange={e => actualizarPerfil('publico', e.target.value)}
                    placeholder="Ej: Gerentes de logística y compras"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Uso de emojis</label>
                  <Segmentado
                    valor={perfil.emojis}
                    onChange={v => actualizarPerfil('emojis', v)}
                    opciones={[
                      { valor: 'no', titulo: 'No usar' },
                      { valor: 'moderado', titulo: 'Con moderación' },
                      { valor: 'libre', titulo: 'Libre' }
                    ]}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Frases o palabras que siempre usamos</label>
                  <ChipsInput
                    valores={perfil.palabras_clave}
                    onChange={v => actualizarPerfil('palabras_clave', v)}
                    placeholder="Escribe y presiona Enter"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Palabras prohibidas</label>
                  <ChipsInput
                    valores={perfil.palabras_prohibidas}
                    onChange={v => actualizarPerfil('palabras_prohibidas', v)}
                    placeholder="Escribe y presiona Enter"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Hashtags oficiales</label>
                  <ChipsInput
                    valores={perfil.hashtags}
                    onChange={v => actualizarPerfil('hashtags', v)}
                    placeholder="#MiMarca"
                    prefijo="#"
                  />
                </div>
              </section>

              <section className="seccion-config">
                <h3>Estilo visual</h3>
                <div className="field-group">
                  <label htmlFor="estilo-visual" className="field-label">¿Cómo se ven nuestras piezas?</label>
                  <textarea
                    id="estilo-visual"
                    className="input-textarea input-textarea-corto"
                    value={perfil.estilo_visual}
                    onChange={e => actualizarPerfil('estilo_visual', e.target.value)}
                    placeholder="Ej: Fotos reales de equipos de trabajo, fondos claros, íconos lineales"
                  />
                </div>
                <div className="fila-doble">
                  <div className="field-group">
                    <label htmlFor="logo" className="field-label">Uso del logo</label>
                    <input
                      id="logo"
                      className="input-texto"
                      value={perfil.logo}
                      onChange={e => actualizarPerfil('logo', e.target.value)}
                      placeholder="Ej: Esquina inferior derecha, en blanco"
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="margenes" className="field-label">Márgenes</label>
                    <input
                      id="margenes"
                      className="input-texto"
                      value={perfil.margenes}
                      onChange={e => actualizarPerfil('margenes', e.target.value)}
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label className="field-label">Publicaciones de referencia</label>
                  <p className="seccion-ayuda">
                    Cada revisión compara la pieza con estas imágenes. Usa publicaciones que consideres perfectas.
                  </p>
                  <ZonaArchivos
                    miniaturas={perfil.referencias}
                    onAgregar={agregarReferencias}
                    onQuitar={i => actualizarPerfil('referencias', perfil.referencias.filter((_, j) => j !== i))}
                    max={MAX_REFERENCIAS}
                    titulo="Sube publicaciones de referencia"
                    ayuda="PNG, JPG o WebP"
                  />
                </div>
              </section>
            </div>
          )}

          {paso === 2 && (
            <div className="paso-contenido">
              <section className="seccion-config">
                <h3>¿Qué tan exigente debe ser?</h3>
                <OpcionesTarjeta
                  valor={comportamiento.exigencia}
                  onChange={v => actualizarComportamiento('exigencia', v)}
                  opciones={[
                    { valor: 'flexible', titulo: 'Flexible', descripcion: 'Solo señala problemas evidentes' },
                    { valor: 'equilibrado', titulo: 'Equilibrado', descripcion: 'Problemas claros y detalles importantes' },
                    { valor: 'estricto', titulo: 'Estricto', descripcion: 'Cualquier desviación de la marca' }
                  ]}
                />
              </section>

              <section className="seccion-config">
                <h3>¿Qué resultado quieres?</h3>
                <OpcionesTarjeta
                  columnas={2}
                  valor={comportamiento.modo}
                  onChange={v => actualizarComportamiento('modo', v)}
                  opciones={[
                    {
                      valor: 'aprobar',
                      titulo: 'Aprobar o pedir cambios',
                      descripcion: 'Da un veredicto claro antes de publicar'
                    },
                    {
                      valor: 'sugerencias',
                      titulo: 'Solo sugerencias',
                      descripcion: 'Da ideas de mejora sin aprobar ni rechazar'
                    }
                  ]}
                />
              </section>

              <section className="seccion-config">
                <h3>Nivel de detalle de los comentarios</h3>
                <Segmentado
                  valor={comportamiento.detalle}
                  onChange={v => actualizarComportamiento('detalle', v)}
                  opciones={[
                    { valor: 'breve', titulo: 'Breve y directo' },
                    { valor: 'detallado', titulo: 'Explicado paso a paso' }
                  ]}
                />
              </section>

              <section className="seccion-config">
                <h3>¿Qué debe revisar?</h3>
                <div className="lista-interruptores">
                  {CATEGORIAS.map(cat => (
                    <Interruptor
                      key={cat.clave}
                      titulo={cat.titulo}
                      descripcion={cat.descripcion}
                      activo={comportamiento.revisar[cat.clave]}
                      onChange={v => actualizarComportamiento('revisar', { ...comportamiento.revisar, [cat.clave]: v })}
                    />
                  ))}
                </div>
              </section>

              <section className="seccion-config">
                <h3>¿Dónde publican?</h3>
                <div className="chips-seleccion">
                  {REDES.map(red => {
                    const activa = comportamiento.redes.includes(red);
                    return (
                      <button
                        key={red}
                        type="button"
                        className={`chip-seleccion ${activa ? 'activo' : ''}`}
                        aria-pressed={activa}
                        onClick={() =>
                          actualizarComportamiento(
                            'redes',
                            activa ? comportamiento.redes.filter(r => r !== red) : [...comportamiento.redes, red]
                          )
                        }
                      >
                        {activa && <Icono nombre="check" tamano={14} grosor={2.5} />}
                        {red}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="seccion-config">
                <h3>Indicaciones adicionales</h3>
                <textarea
                  className="input-textarea"
                  value={comportamiento.instrucciones}
                  onChange={e => actualizarComportamiento('instrucciones', e.target.value)}
                  placeholder="Escribe con tus palabras cualquier regla extra. Ej: Todas las publicaciones deben mencionar el webinar del mes. No usar fotos con fondo negro."
                />
              </section>
            </div>
          )}
        </div>

        <footer className="modal-pie">
          <div className="modal-pie-secundario">
            <button type="button" className="btn-texto" onClick={() => exportarConfiguracion({ perfil, comportamiento })}>
              <Icono nombre="descargar" tamano={15} /> Exportar
            </button>
            <button type="button" className="btn-texto" onClick={() => importarRef.current?.click()}>
              <Icono nombre="subir" tamano={15} /> Importar
            </button>
            {configurado && (
              <button type="button" className="btn-texto btn-texto-peligro" onClick={restablecer}>
                <Icono nombre="reiniciar" tamano={15} /> Restablecer
              </button>
            )}
            <input ref={importarRef} type="file" accept="application/json,.json" hidden onChange={importar} />
          </div>
          <div className="modal-pie-principal">
            {paso < 2 && paso > 0 && (
              <button type="button" className="btn-secundario" onClick={() => setPaso(paso + 1)}>
                Siguiente
              </button>
            )}
            <button type="button" className="btn-guardar" onClick={guardar} disabled={analizando}>
              Guardar configuración
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
