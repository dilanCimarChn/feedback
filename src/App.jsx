import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import ResultadoFeedback from './components/ResultadoFeedback';
import CodigoAccesoModal from './components/CodigoAccesoModal';
import { Icono } from './components/ui';
import {
  borrarConfiguracion,
  cargarConfiguracion,
  guardarConfiguracion,
  normalizarConfiguracion
} from './lib/configuracion';
import { registrarSolicitudCodigo } from './lib/api';

const EXIGENCIA = { flexible: 'Flexible', equilibrado: 'Equilibrado', estricto: 'Estricto' };
const FormularioPublicacion = lazy(() => import('./components/FormularioPublicacion'));
const ConfiguracionModal = lazy(() => import('./components/ConfiguracionModal'));
const Tendencias = lazy(() => import('./components/Tendencias'));
const AgenteTscp = lazy(() => import('./components/AgenteTscp'));

export default function App() {
  const [pantalla, setPantalla] = useState('tscp');
  const [visitadas,setVisitadas]=useState(['tscp']);
  useEffect(()=>{setVisitadas(v=>v.includes(pantalla)?v:[...v,pantalla]);},[pantalla]);
  const [borrador, setBorrador] = useState(null);
  const [contextoMarketing, setContextoMarketing] = useState(null);
  const [configGuardada, setConfigGuardada] = useState(() => cargarConfiguracion());
  const [modalAbierto, setModalAbierto] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [solicitudCodigo, setSolicitudCodigo] = useState(null);
  const resolverCodigo = useRef(null);

  const configurado = Boolean(configGuardada);
  const configuracion = configGuardada || normalizarConfiguracion(null);
  const { perfil, comportamiento } = configuracion;

  // Cuando el servidor pide código de acceso, se muestra el modal y la solicitud espera la respuesta
  useEffect(() => {
    registrarSolicitudCodigo(
      mensaje =>
        new Promise(resolve => {
          resolverCodigo.current = resolve;
          setSolicitudCodigo({ mensaje });
        })
    );
    return () => registrarSolicitudCodigo(null);
  }, []);

  const responderCodigo = codigo => {
    resolverCodigo.current?.(codigo);
    resolverCodigo.current = null;
    setSolicitudCodigo(null);
  };

  const handleGuardar = nueva => {
    if (!guardarConfiguracion(nueva)) return false;
    setConfigGuardada(nueva);
    setModalAbierto(false);
    return true;
  };

  const handleRestablecer = () => {
    borrarConfiguracion();
    setConfigGuardada(null);
    setModalAbierto(false);
  };

  const handleEvaluacionError = mensaje => {
    setError(mensaje);
    if (mensaje) setResultado(null);
  };

  return (
    <div className="app-container">
      <header className="top-header">
        <div className="top-header-fila">
          <div className="brand-pill">
            <span className="brand-pill-dot"></span>
            <span>Agente TSCP</span>
          </div>
          <button type="button" className="tarjeta-marca" onClick={() => setModalAbierto(true)}>
            {configurado ? (
              <>
                <span className="muestras-color">
                  {perfil.colores.slice(0, 5).map((c, i) => (
                    <span key={i} style={{ background: c.hex }} />
                  ))}
                </span>
                <span className="tarjeta-marca-texto">
                  <span className="tarjeta-marca-nombre">{perfil.nombre || 'Mi marca'}</span>
                  <span className="tarjeta-marca-detalle">Revisión {EXIGENCIA[comportamiento.exigencia]?.toLowerCase()}</span>
                </span>
              </>
            ) : (
              <span className="tarjeta-marca-texto">
                <span className="tarjeta-marca-nombre">Sin marca configurada</span>
              </span>
            )}
            <span className="tarjeta-marca-accion">
              <Icono nombre="ajustes" tamano={16} />
              Configurar
            </span>
          </button>
        </div>
        <h1>{pantalla === 'tscp' ? 'Una campaña clara empieza con un buen diagnóstico.' : pantalla === 'tendencias' ? 'Explora referencias para tu diagnóstico' : 'Revisa tus publicaciones antes de publicarlas'}</h1>
        <p>{pantalla === 'tscp' ? 'Define el objetivo, reutiliza tu marca y prepara una guía para trabajar con marketing.' : pantalla === 'tendencias' ? 'Consulta las fuentes disponibles y revisa su relación con la campaña.' : 'Sube tu pieza y su texto para revisar su coherencia con la marca.'}</p>
      </header>

      {!configurado && pantalla === 'revision' && (
        <div className="bienvenida">
          <div className="bienvenida-icono">
            <Icono nombre="chispa" tamano={22} />
          </div>
          <div className="bienvenida-texto">
            <h2>Primero, enséñale tu marca</h2>
            <p>
              Sube algunas publicaciones o tu manual de marca y la herramienta aprenderá tus colores, tipografías y tono.
              Toma unos 2 minutos.
            </p>
          </div>
          <button type="button" className="btn-guardar" onClick={() => setModalAbierto(true)}>
            Configurar mi marca
          </button>
        </div>
      )}

      {import.meta.env.DEV&&<p className="marketing-nota" role="status">{import.meta.env.API_REMOTA_DESARROLLO
        ? 'Modo local conectado a producción: las consultas y campañas usan el mismo servidor que la web.'
        : 'Modo local independiente: las conexiones usan las variables configuradas en este equipo.'}</p>}
      <nav className="pestanas" aria-label="Pantallas">
        <button type="button" aria-current={pantalla === 'tscp' ? 'page' : undefined} onClick={() => setPantalla('tscp')}>Campaña y diagnóstico</button>
        <button type="button" aria-current={pantalla === 'revision' ? 'page' : undefined} onClick={() => setPantalla('revision')}>Revisar publicación</button>
        <button type="button" aria-current={pantalla === 'tendencias' ? 'page' : undefined} onClick={() => setPantalla('tendencias')}>Fuentes y tendencias</button>
      </nav>
      <div hidden={pantalla !== 'tscp'}>
        <Suspense fallback={<p role="status">Cargando agente TSCP…</p>}>
          <AgenteTscp perfil={perfil} comportamiento={comportamiento} contexto={contextoMarketing} onConfigurar={() => setModalAbierto(true)} onActualizarMarca={nuevoPerfil => handleGuardar({ perfil: nuevoPerfil, comportamiento })} />
        </Suspense>
      </div>
      <div hidden={pantalla !== 'tendencias'}>
        {visitadas.includes('tendencias')&&<Suspense fallback={<p role="status">Cargando fuentes…</p>}>
        <Tendencias perfil={perfil} onPlanificar={entrada => { const contexto=typeof entrada==='string'?{texto:entrada}:entrada; if (contexto?.texto?.trim()||contexto?.referencias?.length) setContextoMarketing({...contexto,id:Date.now()}); setPantalla('tscp'); }} onUsar={texto => { setBorrador({ texto, id: Date.now() }); setPantalla('revision'); setResultado(null); setError(null); }} />
        </Suspense>}
      </div>
      <main className="main-grid" hidden={pantalla !== 'revision'}>
        <section aria-label="Publicación a revisar">
          {visitadas.includes('revision')&&<Suspense fallback={<p role="status">Cargando revisión…</p>}><FormularioPublicacion
            borrador={borrador}
            configuracion={configuracion}
            onEvaluacionExitosa={data => {
              setResultado(data);
              setError(null);
            }}
            onEvaluacionError={handleEvaluacionError}
            cargando={cargando}
            setCargando={setCargando}
          /></Suspense>}
        </section>

        <section aria-label="Resultado de la revisión">
          <ResultadoFeedback resultado={resultado} error={error} cargando={cargando} />
        </section>
      </main>

      {modalAbierto && (
        <Suspense fallback={<p role="status">Cargando configuración…</p>}>
        <ConfiguracionModal
          configuracion={configuracion}
          configurado={configurado}
          onCerrar={() => setModalAbierto(false)}
          onGuardar={handleGuardar}
          onRestablecer={handleRestablecer}
        />
        </Suspense>
      )}

      {solicitudCodigo && (
        <CodigoAccesoModal
          mensaje={solicitudCodigo.mensaje}
          onConfirmar={responderCodigo}
          onCancelar={() => responderCodigo(null)}
        />
      )}
      <footer className="pie-informativo" aria-label="Enlaces informativos">
        <a href="/privacidad">Política de privacidad</a>
        <a href="/eliminacion-de-datos">Eliminación de datos</a>
      </footer>
    </div>
  );
}
