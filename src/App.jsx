import { useState } from 'react';
import FormularioPublicacion from './components/FormularioPublicacion';
import ResultadoFeedback from './components/ResultadoFeedback';

export default function App() {
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const handleEvaluacionExitosa = (data) => {
    setResultado(data);
    setError(null);
  };

  const handleEvaluacionError = (mensajeError) => {
    setError(mensajeError);
    if (mensajeError) {
      setResultado(null);
    }
  };

  return (
    <div className="app-container">
      {/* Encabezado Corporativo Sobrio */}
      <header className="top-header">
        <div className="brand-pill">
          <span className="brand-pill-dot"></span>
          <span>Brand Compliance System</span>
        </div>
        <h1>Control de Calidad de Publicaciones</h1>
        <p>
          Verificación automática de identidad visual, tono editorial y cumplimiento normativo para contenidos de redes sociales previo a su publicación.
        </p>
      </header>

      {/* Cuadrícula Principal */}
      <main className="main-grid">
        <section aria-label="Editor de publicación">
          <FormularioPublicacion
            onEvaluacionExitosa={handleEvaluacionExitosa}
            onEvaluacionError={handleEvaluacionError}
            cargando={cargando}
            setCargando={setCargando}
          />
        </section>

        <section aria-label="Informe de auditoría">
          <ResultadoFeedback
            resultado={resultado}
            error={error}
            cargando={cargando}
          />
        </section>
      </main>
    </div>
  );
}
