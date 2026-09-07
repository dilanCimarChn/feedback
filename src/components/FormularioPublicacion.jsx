import { useState } from 'react';

export default function FormularioPublicacion({ onEvaluacionExitosa, onEvaluacionError, cargando, setCargando }) {
  const [copy, setCopy] = useState('');
  const [tipo, setTipo] = useState('post');
  const [imagenBase64, setImagenBase64] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNombreArchivo(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImagenBase64(reader.result);
    };
    reader.onerror = () => {
      onEvaluacionError('No fue posible procesar el archivo seleccionado.');
    };
    reader.readAsDataURL(file);
  };

  const handleEliminarImagen = () => {
    setImagenBase64('');
    setNombreArchivo('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!copy.trim() && !imagenBase64) {
      alert('Ingresa el copy o carga una pieza gráfica para iniciar la evaluación.');
      return;
    }

    setCargando(true);
    onEvaluacionError(null);

    try {
      const response = await fetch('/api/evaluar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          copy,
          imagenBase64,
          tipo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió una inconsistencia al procesar la evaluación.');
      }

      onEvaluacionExitosa(data);
    } catch (error) {
      console.error('Error al evaluar publicación:', error);
      onEvaluacionError(error.message || 'Error de comunicación con el servicio de evaluación.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <form className="panel-card" onSubmit={handleSubmit}>
      <div className="panel-header">
        <h2 className="panel-title">
          <span className="panel-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </span>
          <span>Parámetros de la Publicación</span>
        </h2>
      </div>

      {/* Tipo de Contenido */}
      <div className="field-group">
        <label htmlFor="tipo-contenido" className="field-label">
          Formato de Publicación
        </label>
        <select
          id="tipo-contenido"
          className="input-select"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          disabled={cargando}
        >
          <option value="post">Post Individual (Feed)</option>
          <option value="reel">Reel / Video Vertical</option>
          <option value="carrusel">Carrusel Multipágina</option>
        </select>
      </div>

      {/* Copy */}
      <div className="field-group">
        <label htmlFor="copy-texto" className="field-label">
          Texto del Copy
        </label>
        <textarea
          id="copy-texto"
          className="input-textarea"
          placeholder="Redacta o pega el texto que acompañará a la publicación..."
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
          disabled={cargando}
        />
        <p className="field-hint">
          El mensaje debe mantener un tono directo, alineado al CTA y sin jergas corporativas ni faltas ortográficas.
        </p>
      </div>

      {/* Imagen */}
      <div className="field-group">
        <label className="field-label">Pieza Gráfica</label>
        {!imagenBase64 ? (
          <div className="dropzone">
            <input
              id="input-imagen"
              type="file"
              accept="image/png, image/jpeg, image/webp"
              className="dropzone-input"
              onChange={handleImageChange}
              disabled={cargando}
            />
            <div className="dropzone-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
            <p className="dropzone-title">Seleccionar o soltar archivo de imagen</p>
            <p className="field-hint">Formatos compatibles: PNG, JPG, WebP</p>
          </div>
        ) : (
          <div>
            <div className="preview-wrapper">
              <img src={imagenBase64} alt="Previsualización de pieza gráfica" className="preview-image" />
              {!cargando && (
                <button
                  type="button"
                  className="btn-remove"
                  onClick={handleEliminarImagen}
                  title="Remover imagen"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  <span>Eliminar</span>
                </button>
              )}
            </div>
            <p className="field-hint" style={{ marginTop: '0.4rem' }}>
              Archivo adjunto: <strong>{nombreArchivo}</strong>
            </p>
          </div>
        )}
      </div>

      {/* Botón de Enviar */}
      <button
        id="btn-evaluar"
        type="submit"
        className="btn-primary-action"
        disabled={cargando}
      >
        {cargando ? (
          <>
            <span className="loader-spinner"></span>
            <span>Auditando contenido...</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Ejecutar Auditoría</span>
          </>
        )}
      </button>
    </form>
  );
}
