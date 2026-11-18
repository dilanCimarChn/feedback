# Agente de Feedback - Auditoría de Contenido con IA

Incluye **Estrategia y calendario para cualquier nicho**: elige una duración de un día a un año y el agente consulta fuentes disponibles y propone redes, fechas, horarios, temas, guiones, copy, hashtags y dirección visual con Gemini. Reutiliza el perfil de marca y deja los ajustes manuales como opción. Uso, conexiones y límites en [MARKETING.md](MARKETING.md).

Sistema inteligente de control de calidad y auditoría de marca para publicaciones en redes sociales (Feed, Reels y Carruseles), impulsado por **React 19 + Vite** y la API multimodal de **Google Gemini**.

---

## Características

- **Configuración de marca sin conocimientos técnicos** (botón *Configurar* → modal de 3 pasos):
  1. **Enseñar mi marca**: se suben publicaciones de ejemplo, el manual en PDF y/o una descripción libre, y la IA extrae colores, tipografías, tono, palabras clave, hashtags y estilo visual.
  2. **Mi marca**: todo lo aprendido queda editable (selector de colores, etiquetas, imágenes de referencia).
  3. **Cómo revisar**: nivel de exigencia (flexible / equilibrado / estricto), aprobar o solo sugerir, nivel de detalle, qué aspectos revisar, redes e indicaciones libres.
- **Revisión multimodal**: copy + imagen (o varias láminas en carruseles), comparada contra las imágenes de referencia de la marca.
- **Resultado claro**: puntaje 0-100, lo que está bien, observaciones por severidad (Importante / Mejorable / Detalle) y botón para copiar el informe.
- **Formatos**: Post (1:1 / 4:5), Carrusel (hasta 8 láminas) y Reel (portada 9:16 con zonas seguras de la app).
- La configuración se guarda en el navegador y se puede **exportar/importar** como archivo JSON.
- **Código de acceso opcional** (`APP_ACCESS_CODE`) para que nadie más consuma la API key.

---

## Tecnologías

- **Frontend**: React 19, Vite, CSS moderno. Las imágenes se comprimen en el navegador antes de enviarse.
- **Backend / Serverless**: Vercel Serverless Functions (`/api/evaluar`, `/api/analizar-marca`).
- **IA**: Google Gemini Flash multimodal (vía Google Generative Language API).

### Limitaciones conocidas

- Los colores y medidas los estima la IA visualmente; no son mediciones exactas de píxeles.
- En Reels se evalúa una portada o captura, no el video completo.
- El manual de marca en PDF se limita a 2 MB (límite de 4.5 MB por solicitud en Vercel).
- La configuración vive en el navegador de cada usuario; para compartirla se usa Exportar/Importar.

---

## Configuración Local

1. Clona el repositorio:
   ```bash
   git clone https://github.com/dilanCimarChn/feedback.git
   cd feedback
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Crea un archivo `.env` en la raíz (ver `.env.example`):
   ```env
   GEMINI_API_KEY=tu_api_key_de_gemini
   APP_ACCESS_CODE=codigo_opcional
   ```

4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

---

## Despliegue en Vercel

Primer despliegue, registrado el 16 de noviembre de 2026:

- Aplicación: [feedback-sigma-one.vercel.app](https://feedback-sigma-one.vercel.app).
- Proyecto: [dilancimarchn-5758/feedback](https://vercel.com/dilancimarchn-5758/feedback), plan Hobby.
- El primer despliegue usó la rama `dev`, commit `60071ac`, mediante Vercel CLI. La ampliación del radar y las campañas se publicó el 17 de noviembre; ver [CALENDARIO_EQUIPO.md](CALENDARIO_EQUIPO.md).
- `GEMINI_API_KEY` está configurada como secreto de producción. Las conexiones sociales siguen siendo opcionales. La ampliación del radar y del calendario se documenta en [CALENDARIO_EQUIPO.md](CALENDARIO_EQUIPO.md).
- La publicación actual funciona sin vinculación Git. Para desplegar automáticamente futuros pushes, falta conectar GitHub a la cuenta de Vercel y vincular este repositorio.
- `.env` y los archivos locales están excluidos mediante `.vercelignore`; los metadatos de `.vercel/` no se versionan.

1. Importa el repositorio en [Vercel](https://vercel.com).
2. En la sección **Environment Variables**, añade:
   - `GEMINI_API_KEY`: tu clave de API de Gemini.
   - `APP_ACCESS_CODE` (opcional): código que se pedirá para usar la herramienta.
3. Haz clic en **Deploy**.

## Radar de tendencias

Para obtener y configurar los accesos oficiales, consultar [CONFIGURAR_REDES.md](CONFIGURAR_REDES.md). Incluye portales de registro, variables del servidor, costos, comprobación de conexiones y pendientes para continuar en otra sesión.

Prioriza las seis redes **Facebook, Instagram, TikTok, X (Twitter), LinkedIn y YouTube**, con conectores de lectura oficiales configurables en el servidor. Sin credenciales se muestra `Sin configurar`; no se inventan datos. Configuración y alcance de cada conexión en [REDES_SOCIALES.md](REDES_SOCIALES.md).

La pestaña **Fuentes y tendencias** consulta `/api/tendencias`, que reúne Google Trends RSS, YouTube (si tiene clave) y noticias GDELT de los últimos 7 días. Cada fuente tiene estado propio: un fallo de GDELT no impide ver las tendencias disponibles ni continuar al calendario. El tema orienta las noticias y la búsqueda de videos recientes de YouTube. La consulta permite 1–30 días y muestra el alcance real de Instagram, TikTok Discovery y Facebook externo según sus permisos; no es un ranking completo de ninguna red.

Muestra las señales obtenidas, el momento de consulta y enlaces a las fuentes. No mide alcance, engagement ni mejores horarios de Instagram o TikTok. Las señales se pueden llevar al agente para evaluar su pertinencia y generar una campaña; no se presentan como garantía de rendimiento.

La consulta es manual en esta pestaña y automática al generar un calendario. Hay caché en memoria de 15 minutos y no hay archivo persistente ni actualización con la aplicación cerrada. Este radar no incluye historial de cobertura. Si ninguna fuente responde, lo informa y permite continuar con una propuesta editorial inicial, sin inventar datos.

Documentación del proveedor: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/

## Campañas compartidas

El calendario permite editar, enviar a revisión, aprobar, descartar y generar una alternativa de cada publicación. Las campañas y referencias manuales se guardan en Vercel Blob privado con un código del equipo y control de revisiones; el navegador conserva un respaldo. Preferencias avanzadas opcionales, estados y configuración en [CALENDARIO_EQUIPO.md](CALENDARIO_EQUIPO.md). La aprobación no publica en redes.

## Páginas públicas para Meta

La app «Agente de Feedback» incorpora dos documentos HTML independientes:

- Política de privacidad: `/privacidad`, desde `privacidad.html`.
- Instrucciones de eliminación: `/eliminacion-de-datos`, desde `eliminacion-de-datos.html`.

Vite compila ambas páginas junto con la aplicación. Las dos reescrituras específicas de `vercel.json` conservan esas rutas al abrirlas directamente o recargar. No se añade una ruta general que convierta cualquier URL en la pantalla principal. Las páginas incluyen todo el texto sin JavaScript, no montan la app ni llaman sus APIs y no exigen código de acceso. La aplicación enlaza a ambas en su pie.

El contenido describe los datos comprobados en el código: marca, miniaturas, preferencias, calendarios e histórico opcional en almacenamiento del navegador; campañas, referencias y hallazgos compartidos en Blob privado o archivo de desarrollo; solicitudes de análisis a Gemini y consultas de lectura a proveedores públicos. La eliminación diferencia el borrado del navegador, la revocación en Facebook y la solicitud manual al proyecto en **cimardilan@gmail.com**. No hay borrado automático de campañas ni plazos fijos de retención configurados. Si cambia el tratamiento de datos, hay que actualizar estos textos.

Para revisar la compilación antes del despliegue:

```bash
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

Abrir `http://127.0.0.1:4173/privacidad` y `http://127.0.0.1:4173/eliminacion-de-datos` en una ventana privada y recargar. Cada ruta debe mostrar su título y contenido propio; los enlaces cruzados y el contacto deben funcionar. Las APIs conservan la comprobación de código que ya tenían cuando está configurado; las páginas informativas no la omiten para otras funciones.

Después de desplegar esta versión, los enlaces para la configuración de Meta serán:

- https://feedback-sigma-one.vercel.app/privacidad
- https://feedback-sigma-one.vercel.app/eliminacion-de-datos

La preparación de estas páginas no concede acceso a contenido público de Facebook: el radar sigue pendiente hasta obtener publicaciones reales de una página que no administremos. No se incorpora una devolución de llamada automática de borrado; la segunda URL contiene instrucciones públicas para presentar una solicitud.
