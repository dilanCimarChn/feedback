export default function ResultadoFeedback({ resultado, error, cargando }) {
  // Estado de error de la llamada al servidor
  if (error) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <h2 className="panel-title">
            <span className="panel-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </span>
            <span>Resultado de la Auditoría</span>
          </h2>
        </div>
        <div className="server-error-box">
          <h4>No fue posible completar la revisión</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Estado previo a la evaluación
  if (!resultado && !cargando) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <h2 className="panel-title">
            <span className="panel-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </span>
            <span>Resultado de la Auditoría</span>
          </h2>
        </div>
        <div className="state-empty">
          <div className="state-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <path d="M9 15h6"></path>
              <path d="M9 11h6"></path>
            </svg>
          </div>
          <h3>Esperando publicación</h3>
          <p>
            Define el contenido y pulsa <strong>"Ejecutar Auditoría"</strong> para procesar la conformidad contra las normas de marca.
          </p>
        </div>
      </div>
    );
  }

  // Estado de análisis en curso
  if (cargando) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <h2 className="panel-title">
            <span className="panel-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </span>
            <span>Resultado de la Auditoría</span>
          </h2>
        </div>
        <div className="state-empty">
          <span className="loader-spinner" style={{ width: '28px', height: '28px', margin: '0 auto 1.25rem auto', borderColor: 'rgba(30, 58, 95, 0.2)', borderTopColor: '#1A2B3C' }}></span>
          <h3>Analizando parámetros de marca</h3>
          <p>Contrastando márgenes, paleta cromática, tipografía, estilo lingüístico y tono de comunicación...</p>
        </div>
      </div>
    );
  }

  const { aprobado, errores = [] } = resultado;

  // Estado: Publicación Aprobada
  if (aprobado === true) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <h2 className="panel-title">
            <span className="panel-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
            <span>Resultado de la Auditoría</span>
          </h2>
        </div>

        <div className="panel-approved">
          <div className="approved-badge-circle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h3>Publicación Conforme y Aprobada</h3>
          <p>
            El material evaluado cumple satisfactoriamente con la totalidad de lineamientos visuales, lingüísticos y cromáticos de la identidad de marca.
          </p>
        </div>
      </div>
    );
  }

  // Estado: Publicación Rechazada
  const erroresPorCategoria = (errores || []).reduce((acc, err) => {
    const cat = err.categoria?.toLowerCase() || 'general';
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(err);
    return acc;
  }, {});

  const titulosCategoria = {
    margenes: 'Márgenes y Zona de Seguridad',
    colores: 'Paleta Cromática Oficial',
    contexto: 'Contexto y Tono Editorial',
    tipografia: 'Normativa Tipográfica',
    gramatica: 'Ortografía y Estilo',
    general: 'Observaciones Generales'
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h2 className="panel-title">
          <span className="panel-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </span>
          <span>Resultado de la Auditoría</span>
        </h2>
      </div>

      {/* Resumen Superior */}
      <div className="panel-rejected-header">
        <div className="rejected-icon-circle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
        <div className="rejected-info">
          <h3>Publicación Requiere Modificaciones</h3>
          <p>
            Se identificaron {errores.length} {errores.length === 1 ? 'inconsistencia normativa' : 'inconsistencias normativas'} que impiden su aprobación.
          </p>
        </div>
      </div>

      {/* Listado Agrupado por Categoría */}
      <div>
        {Object.entries(erroresPorCategoria).map(([catKey, lista]) => (
          <div key={catKey} className="category-group">
            <div className="category-group-header">
              <span className="category-badge">
                {titulosCategoria[catKey] || catKey.toUpperCase()}
              </span>
              <span className="category-counter">
                {lista.length} {lista.length === 1 ? 'observación' : 'observaciones'}
              </span>
            </div>

            <div>
              {lista.map((item, idx) => (
                <div key={idx} className="error-row">
                  <p className="error-message">{item.descripcion}</p>
                  {item.sugerencia && (
                    <div className="error-suggestion">
                      <strong>Acción recomendada: </strong>
                      <span>{item.sugerencia}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
