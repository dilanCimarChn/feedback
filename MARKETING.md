# Agente TSCP · Campaña y diagnóstico

La pantalla principal implementa los pasos 0 y 1 de las aclaraciones de marketing. Entrega un diagnóstico revisable y una guía orientativa con fechas, propósito y estructura de las piezas. No redacta publicaciones finales, no produce diseños y no envía mensajes. El paso 2 permanece pendiente de definición por marketing.

## Paso 0 · Configuración

Los campos iniciales son destinatario —voluntario o empresa—, descripción del objetivo, fecha de inicio y duración. Los cuatro canales propuestos son LinkedIn, Instagram, Facebook y TikTok, y se pueden seleccionar por campaña.

La duración mínima es un día y la máxima un año, hasta 366 días. Se puede introducir en días, semanas o meses; por defecto son tres meses. El período se calcula en el servidor, sin delegar fechas a la IA.

**Marca, lenguaje y contexto** reutiliza el perfil guardado. Permite revisar misión, vocabulario, lenguaje del copy por canal, idioma y zona horaria. La misión inicial procede del brief TSCP y debe confirmarla marketing; las palabras inferidas del perfil no se convierten automáticamente en vocabulario aprobado. La confirmación humana queda separada del análisis de IA.

El manual PDF admite hasta 2 MiB. Se analiza mediante la ruta de marca existente y se conservan los campos extraídos, nombre y fecha del manual. No se guarda el PDF original en el navegador. Si la misión o el vocabulario no están expresamente indicados, su extracción queda vacía y el equipo los completa o valida.

La configuración y los resultados utilizan `agente-feedback:tscp:v2` en `localStorage`; las campañas y perfiles anteriores permanecen en sus claves. Cambiar la configuración no modifica el diagnóstico ya obtenido: la pantalla y sus descargas conservan la consulta anterior y avisan que hay cambios pendientes.

## Paso 1 · Diagnóstico

**Referentes para el diagnóstico** permite configurar hasta tres candidatos por canal. Al generar se completan automáticamente los perfiles iniciales desde un catálogo contrastado con sitios oficiales: Good360, TechSoup y charity: water para LinkedIn, Instagram y Facebook. En TikTok se proponen American Red Cross, Doctors Without Borders y UNICEF, porque no se localizaron perfiles oficiales de los dos candidatos iniciales. La sustitución y su procedencia quedan visibles. Se preservan los perfiles y observaciones manuales del equipo. Localizar un perfil no significa haber leído sus métricas.

| Canal | Lectura de competencia |
| --- | --- |
| Instagram | Business Discovery de una cuenta profesional identificada, con el acceso aprobado que requiera Meta; seguidores y hasta diez publicaciones |
| Facebook | Perfil y hasta diez posts de una página externa, con ID y `FACEBOOK_PUBLIC_ACCESS_TOKEN`; no reutiliza el token de la página propia |
| LinkedIn | Enlaces y observaciones aportadas por el equipo; el conector de organización propia no se presenta como competencia |
| TikTok | Enlaces y observaciones aportadas por el equipo; no se presume acceso externo por tener un token de la cuenta propia |

Las cuentas para pruebas y los permisos deben obtenerse por los flujos oficiales. Un enlace, nombre o token guardado no acredita una consulta correcta. Configuración en [CONFIGURAR_REDES.md](CONFIGURAR_REDES.md).

Cada referente puede incluir seguidores observados, fecha de observación y hasta diez publicaciones aportadas como JSON. Los datos manuales se identifican como aportados por el equipo. El servidor no descarga las URLs arbitrarias recibidas: solo consulta los endpoints oficiales admitidos.

El diagnóstico muestra seguidores, publicaciones por semana en la muestra y reacciones medias cuando existen. Un dato desconocido queda sin dato; cero significa un conteo observado de cero. Likes y comentarios permanecen separados de reacciones. La frecuencia se calcula sobre publicaciones fechadas de una muestra limitada; no representa el histórico completo ni la eficacia del referente.

El resultado contiene:

- Estado, identificación, métricas y fuentes por referente y canal.
- Qué considerar en CTA, tipo de contenido y canal, con evidencia o una hipótesis explícita.
- Segmentos con necesidad, objetivo, canal y tono propuesto.
- Mensaje estratégico central, tres apoyos por validar y variantes por segmento.
- Una sugerencia por canal con tema, formato, idea de contenido, gancho, copy de ejemplo, CTA, estructura y hashtags temáticos. Son borradores pendientes de revisión, con referencias al brief o al texto observado; no acreditan rendimiento ni popularidad.
- Datos, accesos y decisiones pendientes.

Gemini recibe el brief y un catálogo de fuentes. El servidor valida los IDs citados, los canales y referentes utilizados; las métricas se obtienen de los datos, nunca de la respuesta del modelo. No se declara observado el contenido de una publicación cuyo texto no se recibió. Si la IA falla o devuelve una estructura inválida, se conservan las observaciones y la guía estratégica queda pendiente.

En paralelo se buscan referencias temáticas con las APIs disponibles: YouTube, RSS de Google Trends y acceso externo autorizado de Instagram, Facebook y TikTok Discovery. YouTube busca ejemplos de captación o colaboración sin límite de antigüedad y conserva sus fechas; no se presentan como tendencias recientes ni se presupone haber visto el video o una transcripción. El radar conserva su filtro reciente independiente. Trends aporta solo coincidencias temáticas. TikTok Discovery aporta términos, no publicaciones. Estas fuentes alimentan enfoques y sugerencias, con enlaces y origen visibles, aunque otras APIs fallen. Los perfiles localizados y las métricas disponibles se cuentan por separado; los resultados de YouTube no completan perfiles de Instagram. Al renovar las credenciales, las consultas habilitadas se activan automáticamente al preparar un nuevo diagnóstico y la caché se invalida por cambio de acceso.

## Cronograma orientativo y paso 2

La guía incluye un cronograma provisional mientras Marketing define el workflow. Utiliza como propuesta inicial la frecuencia del PDF: Instagram tres, LinkedIn dos, Facebook dos y TikTok dos salidas por semana completa, filtrando los canales seleccionados. LinkedIn toma dos de las dos a tres propuestas; esta elección requiere confirmación de marketing.

La sección 4.3 no exige publicar todos los días ni asigna días concretos. La propuesta del sistema concentra las salidas en lunes, miércoles y viernes: Instagram los tres días, LinkedIn lunes y viernes, Facebook lunes y miércoles y TikTok miércoles y viernes. Son nueve adaptaciones entre cuatro canales en una semana completa, agrupadas en tres fechas, no nueve piezas originales obligatorias. Marketing debe aprobar esos días y la reutilización entre redes. Las semanas parciales incluyen únicamente fechas dentro de la campaña. La interfaz y las descargas distinguen las cantidades del flujo de los días propuestos.

Cada entrada contiene fecha, canal, formato sugerido, tema, propósito, segmento, objetivo, CTA propuesto y una estructura por pasos. La primera salida de cada canal se vincula a su ejemplo de copy, hashtags y contenido; las demás requieren desarrollo editorial. No hay guiones finales ni una hora óptima supuestamente medida. Los períodos largos mantienen su condición provisional.

La guía de email incluye cinco estructuras de contacto en los días relativos 0, 3, 7, 13 y 20, con objetivos y condiciones. No son correos redactados ni programados. Antes de ampliar esa función, marketing debe acordar destinatarios, contenido esperado, responsable, enlaces y condiciones de salida y baja.

El paso 2 debe aclarar cómo comienza el trabajo después de aprobar el diagnóstico, los casos de uso y resultados esperados, la frecuencia definitiva, las entregas y sus responsables. La interfaz conserva estas decisiones como pendientes y no ejecuta el workflow por su cuenta.

## Entrega y herramientas de apoyo

**Descargar diagnóstico JSON** conserva configuración, referentes, observaciones, estrategia y guía. **Descargar guía Markdown** prepara una entrega legible con las métricas, fuentes y pendientes. Las descargas corresponden a la consulta mostrada, aunque luego se edite la configuración.

**Conexiones y APIs** consulta `POST /api/estado-apis`: muestra los nombres de variables requeridas, presentes y faltantes del backend activo y la documentación oficial. No devuelve sus valores ni realiza consultas externas. Tener configuración no significa contar con permisos, cuota o acceso comprobados. Para comprobar fuentes se utiliza el radar; Gemini se comprueba al generar el diagnóstico. Si falla, se muestra una causa controlada y se conservan las observaciones.

**Fuentes y tendencias** conserva Google Trends, YouTube, Instagram por hashtag y las demás fuentes disponibles como apoyo. Una tendencia temática no sustituye el diagnóstico de una organización competidora. **Revisar publicación** permite evaluar material aportado por el equipo; no redacta una pieza desde este flujo.

Los módulos anteriores de generación y almacenamiento de calendarios se conservan para compatibilidad con datos y APIs existentes; no son la pantalla principal del agente ni se invocan al preparar este diagnóstico. El almacenamiento compartido previo se documenta en [CALENDARIO_EQUIPO.md](CALENDARIO_EQUIPO.md).

## Implementación y comprobación

- Modelo y guía: `src/lib/agente-tscp.js`.
- Interfaz: `src/components/AgenteTscp.jsx`.
- Endpoint: `POST /api/diagnostico-tscp`, protegido mediante el código de acceso existente.
- Diagnóstico y validación: `api/_lib/diagnostico-tscp.js`.
- Identificación inicial: `api/_lib/perfiles-referentes-tscp.js`; referencias temáticas: `api/_lib/referencias-automaticas.js`.

`npm test` cubre fechas, límites, selección de canales, referencias, métricas ausentes, acceso, fuentes inventadas, fallos parciales y guía sin piezas finales con proveedores simulados. `npm run build` compila el cliente. Las pruebas no acreditan permisos actuales de Meta ni calidad editorial de una campaña real.

Referencia de diseño: [p-tscp, revisión 908d226](https://github.com/adrianbutsos/p-tscp/tree/908d22665b28c79255104512b37c0dff37ae23fe). El diagnóstico adapta la separación entre benchmarking, estrategia y propuesta creativa, las fuentes con identificador, URL, fecha y estado, y las entregas con idea, CTA y estructura para producción. Los componentes, esquemas, dependencias e infraestructura del repositorio de referencia no forman parte de esta aplicación. Las frecuencias proceden del flujo de marketing de TSCP.
