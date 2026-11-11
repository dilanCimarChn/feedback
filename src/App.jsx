import { useEffect, useRef, useState } from 'react';
import FormularioPublicacion from './components/FormularioPublicacion';
import ResultadoFeedback from './components/ResultadoFeedback';
import ConfiguracionModal from './components/ConfiguracionModal';
import CodigoAccesoModal from './components/CodigoAccesoModal';
import Tendencias from './components/Tendencias';
import Marketing from './components/MarketingAutomatico';
import { Icono } from './components/ui';
import {
  borrarConfiguracion,
  cargarConfiguracion,
  guardarConfiguracion,
  normalizarConfiguracion
} from './lib/configuracion';
import { registrarSolicitudCodigo } from './lib/api';

const EXIGENCIA = { flexible: 'Flexible', equilibrado: 'Equilibrado', estricto: 'Estricto' };

export default function App() {
  const [pantalla, setPantalla] = useState('marketing');
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
            <span>Revisor de marca</span>
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
        <h1>{pantalla === 'marketing' ? 'Planifica contenido que impulse tu marca' : pantalla === 'tendencias' ? 'Explora señales para tu próxima campaña' : 'Revisa tus publicaciones antes de publicarlas'}</h1>
        <p>{pantalla === 'marketing' ? 'Elige la duración y el agente propone tu estrategia y calendario.' : pantalla === 'tendencias' ? 'Consulta las fuentes disponibles y lleva las ideas a tu calendario.' : 'Sube tu pieza y su texto: te diremos si respeta los colores, tipografías, espacios y tono de tu marca.'}</p>
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

      <nav className="pestanas" aria-label="Pantallas">
        <button type="button" aria-current={pantalla === 'marketing' ? 'page' : undefined} onClick={() => setPantalla('marketing')}>Estrategia y calendario</button>
        <button type="button" aria-current={pantalla === 'revision' ? 'page' : undefined} onClick={() => setPantalla('revision')}>Revisar publicación</button>
        <button type="button" aria-current={pantalla === 'tendencias' ? 'page' : undefined} onClick={() => setPantalla('tendencias')}>Fuentes y tendencias</button>
      </nav>
      <div hidden={pantalla !== 'marketing'}>
        <Marketing perfil={perfil} comportamiento={comportamiento} contexto={contextoMarketing} onUsar={texto => { setBorrador({ texto, id: Date.now() }); setPantalla('revision'); setResultado(null); setError(null); }} />
      </div>
      <div hidden={pantalla !== 'tendencias'}>
        <Tendencias perfil={perfil} onPlanificar={texto => { if (texto.trim()) setContextoMarketing({texto,id:Date.now()}); setPantalla('marketing'); }} onUsar={texto => { setBorrador({ texto, id: Date.now() }); setPantalla('revision'); setResultado(null); setError(null); }} />
      </div>
      <main className="main-grid" hidden={pantalla !== 'revision'}>
        <section aria-label="Publicación a revisar">
          <FormularioPublicacion
            borrador={borrador}
            configuracion={configuracion}
            onEvaluacionExitosa={data => {
              setResultado(data);
              setError(null);
            }}
            onEvaluacionError={handleEvaluacionError}
            cargando={cargando}
            setCargando={setCargando}
          />
        </section>

        <section aria-label="Resultado de la revisión">
          <ResultadoFeedback resultado={resultado} error={error} cargando={cargando} />
        </section>
      </main>

      {modalAbierto && (
        <ConfiguracionModal
          configuracion={configuracion}
          configurado={configurado}
          onCerrar={() => setModalAbierto(false)}
          onGuardar={handleGuardar}
          onRestablecer={handleRestablecer}
        />
      )}

      {solicitudCodigo && (
        <CodigoAccesoModal
          mensaje={solicitudCodigo.mensaje}
          onConfirmar={responderCodigo}
          onCancelar={() => responderCodigo(null)}
        />
      )}
    </div>
  );
}
