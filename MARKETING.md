# Campa?as TSCP basadas en el flujo de marketing

La pantalla principal propone tres meses, con estrategia TSCP seleccionada, ingl?s y Estados Unidos como mercado de referencia para tendencias. El perfil de marca se reutiliza. La duraci?n personalizada y las preferencias son opcionales. En instalaciones con preferencias guardadas se conservan los valores anteriores; seleccionar TSCP en preferencias activa este flujo.

La referencia es el PDF ?Flujo de trabajo para las campa?as de marketing y IT de TSCP? aportado por el equipo. Se incorporaron sus cuatro segmentos, cinco pilares, objetivo de adquisici?n de ONGs y nueve campos de cronograma. Cadencia fija: Instagram 3, LinkedIn 2 (dentro de 2?3), Facebook 2 y TikTok 2 por semana; los per?odos parciales conservan los d?as correspondientes. Son nueve salidas semanales con reutilizaci?n de producci?n. Mes 1: Awareness; mes 2: Consideration; mes 3+: Conversion, con revisi?n de resultados antes de afirmar qu? funciona.

Cada pieza incluye segmento, pilar, mensaje, prop?sito y CTA. El JSON y CSV conservan estos campos, adem?s de fecha, hora, formato, copy, guion, instrucciones visuales y UTM. Se proponen enlaces del sitio y marketplace; los enlaces de reuni?n e informaci?n quedan pendientes de confirmar. No se comprueban enlaces autom?ticamente. Los testimonios, precios, gratuidad, cifras y casos requieren validaci?n. Good360 y TechSoup son referencias del brief, no un benchmarking realizado por la aplicaci?n.

Se generan cinco borradores de email por bloque en d?as relativos 0, 3, 7, 13 y 20, con condiciones de seguimiento del documento; la interfaz muestra la secuencia del primer bloque como plantilla por contacto. No hay CRM, env?os ni seguimiento de respuestas. El JSON completo contiene las secuencias. La UI recuerda confirmar responsables y mecanismo de baja.

Audiencia internacional: se puede cambiar mercado de tendencias, idioma y zona IANA. Un plan usa un solo mercado de referencia y zona horaria; no mide simult?neamente todas las regiones. Para diferentes p?blicos se necesitan planes separados y adaptaci?n cultural. No se presupone que toda la audiencia est? en Bolivia ni en un estado de EE. UU.

Tres meses es la recomendaci?n operativa del equipo. Se mantiene el m?ximo de un a?o por bloques mensuales, provisional y con revisi?n semanal. Las fuentes actuales no predicen tendencias futuras ni horas pico de cuentas. No se han a?adido Insights de audiencia ni actualizaci?n aut?noma con la aplicaci?n cerrada.

Validaci?n: 16 pruebas automatizadas, incluyendo cadencia, embudo entre bloques, validaci?n de segmentos y CTA, UTM y secuencia de email; compilaci?n de producci?n correcta. Generaci?n TSCP comprobada con respuestas simuladas, no con una campa?a real de Gemini ni evaluaci?n visual en navegador.

---

# Estrategia y calendario para cualquier nicho

La pantalla inicial **Estrategia y calendario** amplía el revisor de marca con planificación orgánica de campañas. **Fuentes y tendencias** permite explorar las mismas fuentes independientes antes de planificar. Un fallo de GDELT no bloquea las otras fuentes. Las señales elegidas se llevan como contexto al calendario. El encabezado corresponde a la pantalla seleccionada y la configuración de marca se solicita como paso previo solo en el revisor.

Admite cualquier nicho: sector de texto libre con sugerencias, producto o servicio, propuesta de valor y campaña mensual. Los objetivos incluyen ventas, consultas, reservas, lanzamientos, fidelización, comunidad y objetivos personalizados; voluntariado y donaciones son opciones para organizaciones que los necesiten. El generador adapta sus pilares, CTA y métricas a estos datos. Las campañas guardadas en la versión anterior conservan su descripción.

## Modo automático (pantalla principal)

El usuario elige una duración de días, semanas, meses o un año (máximo 366 días). Si ya configuró la marca, no necesita volver a describir su sector y audiencia; si falta la descripción, escribe una frase. Fecha inicial, país, zona horaria y objetivo se pueden cambiar en **Preferencias opcionales**. El país inicial es Bolivia y la zona inicial America/La_Paz; se muestran junto al botón para revisarlos.

`/api/plan-automatico` investiga automáticamente Google Trends RSS por país, YouTube si tiene clave y GDELT con un tema derivado del perfil. Las consultas públicas se hacen en paralelo, con timeout de 12 segundos para RSS/noticias y caché en memoria de 15 minutos. La IA descarta señales ajenas al nicho. Cada fuente tiene estado explícito (consultada, sin resultados, sin configurar o no disponible), instante de consulta y referencias en el calendario. Google Trends refleja búsquedas; no mide uso de redes ni demuestra eficacia de un formato. Los conteos observados no son una garantía de rendimiento.

El modo general propone unas tres publicaciones por semana como frecuencia inicial; TSCP usa nueve salidas por semana seg?n su brief, decide redes, fechas y horas, y genera copy, hashtags, palabras clave, guion, CTA, distribución y dirección visual. La paleta, tipografías, tono, reglas de emojis e instrucciones de la marca se incluyen en el contexto; no se modifica la configuración guardada de marca. Si un campo de identidad falta, la propuesta debe indicarse como pendiente de validar. No se publica ni se contacta a personas automáticamente.

Los horarios se etiquetan en el servidor: con al menos tres registros orgánicos de esa red en el mismo día semanal y franja horaria, se informa la muestra del histórico importado. Esto no acredita una hora óptima ni causalidad. Si no, se identifica como prueba inicial. Las métricas se recuperan del histórico importado previamente en modo manual, excluyendo anuncios y publicaciones posteriores al inicio del bloque.

Hay un catálogo editorial pequeño de temporadas: Año Nuevo, Navidad y algunas efemérides de Naciones Unidas, con anticipación de hasta tres semanas. Se distingue de tendencias medidas; no pretende cubrir todos los feriados locales ni todas las fechas comerciales. Referencias: [Google Trends](https://support.google.com/trends/answer/3076011), [efemérides ONU](https://www.un.org/en/observances/list-days-weeks).

La campaña se divide por meses en bloques de hasta 31 días para no pedir a la IA un año entero en una sola llamada. Cada bloque terminado se guarda localmente; si falla o se detiene, se puede continuar. La detención ocurre después de completar la petición en curso. Generar un plan nuevo reemplaza el anterior al completarse su primer bloque. Una campaña anual puede necesitar 13 bloques si empieza a mitad de mes, con el correspondiente consumo de Gemini. Los planes futuros son provisionales: la IA no puede conocer tendencias de todo el próximo año y recomienda revisión semanal. No hay tarea automática que regenere planes cerrados.

El resultado se consulta por mes y red, se edita seleccionando una publicación y se exporta a CSV o JSON. El CSV incluye todos los bloques completados, con dirección visual y fundamento del horario. El modo manual anterior sigue disponible en **Ajustes manuales e importar estadísticas**.

Verificación: `node --test tests/marketing.test.js tests/automatico.test.js` (12 pruebas). Incluye duraciones, años bisiestos, bloques continuos, lectura RSS, estacionalidad, investigación y generación simuladas, respeto del contexto de marca, base horaria calculada y errores parciales. La comprobación pública en vivo obtuvo tendencias RSS de Bolivia; GDELT no respondió y YouTube no estaba configurado. Una prueba adicional con Gemini real devolvió HTTP 200 y tres publicaciones para una campaña ficticia de una semana, con Google Trends consultado. Esto comprueba el recorrido de generación, no acredita resultados de marketing ni sustituye revisión editorial o prueba visual de la interfaz.

## Modo manual (opcional)

1. Opcionalmente descarga la plantilla CSV, complétala en Excel o Sheets e importa estadísticas reales de tus publicaciones. Se admiten también arreglos JSON con los mismos campos. No se interpreta automáticamente el CSV nativo de cada plataforma: hay que adaptar sus columnas a la plantilla.
2. Selecciona el rango del histórico que quieres analizar. El cuadro compara alcance medio, tasa ponderada de interacciones sobre alcance y conversiones por red y formato. Excluye publicaciones marcadas como pagadas. Usa muestras y períodos comparables, y la misma definición de conversión.
3. Indica mes, sector, oferta, campaña, audiencia, objetivo, ciudad o país, redes, recursos, días y dos horarios de prueba. Las horas de tu histórico deben corresponder a la zona horaria elegida.
4. Genera la estrategia con Gemini, usando la marca configurada. Se genera una publicación total por día seleccionado, repartiendo las redes. El servidor fija las fechas del mes y alterna las horas elegidas; no delega los cálculos de calendario a la IA.
5. Consulta el calendario, filtra, selecciona una publicación y edita fecha, hora, copy, guion, CTA y hashtags. Puedes llevar el copy al revisor de marca, exportar CSV o descargar el plan completo en JSON.

La planificación se guarda en localStorage del navegador. Cada generación correcta reemplaza el plan anterior; exporta antes si necesitas conservar versiones. Un error de generación conserva el plan anterior. No se programan ni publican contenidos en redes.

## Fuentes y conexiones

- **Histórico propio:** CSV/JSON aportado por el usuario; se muestra la cantidad de registros, no se declara verificado por la plataforma. Se conserva localmente y se envía a Gemini al generar el plan junto con el sector, oferta, campaña, audiencia, preferencias y perfil de marca textual. No se envían imágenes de referencia para planificar.
- **Señales YouTube:** API oficial `videos.list` con `chart=mostPopular`, país y estadísticas públicas. Requiere `YOUTUBE_API_KEY` en el servidor y YouTube Data API v3 habilitada. Cache de 15 minutos. No se expone la clave al navegador. La consulta es manual o al generar un plan si se activa la casilla; no hay actualización automática de esta fuente. Guarda el instante de consulta, títulos, enlaces y métricas observadas.
- **Facebook, Instagram, TikTok, X y LinkedIn:** adaptadores oficiales de lectura configurables en el servidor, además de YouTube. Consumen publicaciones de cuentas autorizadas o búsqueda pública reciente en X; no son un ranking global de tendencias. Configuración, permisos y límites en [REDES_SOCIALES.md](REDES_SOCIALES.md). No hay todavía conexión OAuth en la interfaz ni renovación automática de tokens. La importación sigue disponible para métricas de alcance y conversiones.
- **Guía editorial:** roles propuestos para video, carrusel, imagen e historias; enlaces oficiales de Meta y YouTube en pantalla. No es un benchmark reciente ni un ranking global.

Los videos populares generales de YouTube pueden no ser pertinentes para la marca. El prompt ordena descartarlos si no aportan al nicho y no extrapolarlos a otras redes. Las vistas son acumuladas, no velocidad de crecimiento. No se calculan volúmenes de hashtags, ni se identifican automáticamente Reels o Shorts a partir de duración. Los hashtags extraídos son texto presente en descripciones; los hashtags del calendario son propuestas sin volumen medido.

Sin histórico y sin YouTube configurado, la generación funciona como propuesta editorial inicial de IA, claramente identificada. No hay garantía de visibilidad, mejores horarios medidos, ni tendencias externas inventadas. El equipo debe verificar el copy y completar datos reales, enlaces o autorizaciones antes de publicar. No incluye compra u optimización de publicidad pagada.

## Backend y validación

- `/api/plan-marketing`: autenticación existente, Gemini del servidor, validación de redes y formatos, mes y fechas, JSON de respuesta completo. No devuelve planes con publicaciones faltantes o formatos incompatibles.
- `/api/senales-sociales`: autenticación existente, consulta pública opcional y estado explícito cuando falta la clave.
- Desarrollo local: ambas rutas están registradas en el middleware Vite; Vercel descubre sus archivos serverless.
- `node --test tests/marketing.test.js`: fechas y años bisiestos, importación, comparación orgánica, seguridad CSV, acceso, calendario completo y conexión ausente. Las respuestas de Gemini se simulan en las pruebas; no prueban disponibilidad del proveedor ni calidad del contenido generado.
- `npm run build`: compilación de producción.

Referencias: [Meta: estrategia de contenido](https://www.facebookblueprint.com/student/path/196036-strategic-content-for-your-community), [YouTube Data API](https://developers.google.com/youtube/data/reference/rest/v3/videos/list).
