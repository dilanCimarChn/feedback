# Calendario automático por audiencia

La pantalla principal pide una frase sobre lo que se quiere impulsar, la duración y el país del público. La duración está visible: ofrece **1 día, 1 semana, 1 mes, 3 meses (recomendado), 6 meses y 1 año**. Se admite desde **1 día hasta 1 año, con un máximo de 366 días**. Tres meses es la recomendación editorial inicial para preparar contenido, observar resultados y ajustar la estrategia; no supone conocer las tendencias futuras.

La cantidad de publicaciones es opcional: se proponen cinco salidas semanales entre todas las redes (22 en un período de 31 días). Las opciones permiten personalizar la duración en días, semanas, meses o un año, elegir la fecha de inicio o planificar un mes natural. La ciudad, zona horaria, objetivo, idioma y estrategia TSCP también quedan en opciones. El perfil guardado evita volver a escribir la identidad de marca.

El servidor fija fecha, hora, red y formato antes de generar los textos. Distribuye la cantidad de toda la campaña en bloques semanales sin acumular redondeos. Prioriza **Facebook, Instagram, TikTok, X, LinkedIn y YouTube**, con cuotas descendentes y cobertura de las seis cuando hay suficientes publicaciones. Cada salida cuenta como una publicación en una plataforma; se recomienda reutilizar la producción adaptando el texto y formato.

La IA propone temas, guiones, copy, hashtags, CTA, métricas y justificación para cada entrada. El modo general escribe lotes de hasta tres piezas en paralelo, dentro del limitador de concurrencia existente y con hasta 32 segundos por respuesta. La interfaz acorta los bloques de campañas densas para mantener pequeñas las solicitudes. Las respuestas que cambian la agenda, omiten piezas o citan fuentes ajenas al catálogo se rechazan. Se conservan los bloques completados y se puede continuar después de un fallo. La estrategia TSCP conserva su agenda y secuencia de borradores de email como opción específica.

El calendario alinea los días con su día de semana y conserva siete columnas con desplazamiento horizontal en móvil. Incluye conteos por red y formato, filtro de plataforma, explicación de cada horario y herramientas sugeridas. CSV y JSON incluyen el contenido, fundamento, referencias y herramientas.

## Qué datos utiliza

- **Google Trends y YouTube:** señales del país seleccionado, filtradas por coincidencia temática. No acreditan actividad de seguidores ni eficacia en otras plataformas.
- **GDELT:** noticias sobre el tema y menciones del país y localidad. Cuando no encuentra noticias locales, prueba el país y declara la ampliación. No identifica dónde están los lectores. Algunos sectores comunes se expanden a términos en inglés para la búsqueda.
- **Cuentas autorizadas:** publicaciones de Facebook, Instagram, TikTok y LinkedIn según las credenciales del servidor; X aporta búsqueda pública por tema. Cada fuente tiene estado y alcance explícitos. Configuración existente en [REDES_SOCIALES.md](REDES_SOCIALES.md).
- **Hashtags observados:** conservan plataforma, publicación y consulta. Ver una etiqueta en una publicación no demuestra popularidad, volumen ni eficacia. Las otras etiquetas se presentan como propuestas editoriales. [TikTok explica que #FYP no da acceso garantizado a Para ti](https://newsroom.tiktok.com/5-tips-for-tiktok-creators?lang=en).
- **Horarios:** el histórico orgánico reciente permite comparar franjas dentro de la misma red, excluyendo anuncios y registros futuros. Sin muestra suficiente, se propone una franja de prueba en la zona del público. El alcance de publicaciones anteriores no equivale al número de personas conectadas. [YouTube ofrece un informe específico de actividad de la audiencia](https://support.google.com/youtube/answer/9314416?hl=en), que esta aplicación no importa automáticamente.

Las referencias consultadas se vinculan a publicaciones de los próximos 30 días. Las ideas para fechas a más de 30 días son provisionales y requieren investigar de nuevo antes de publicar. Se recomienda revisar resultados, temas y horarios cada semana durante toda la campaña, especialmente en planes de tres meses a un año.

Las fuentes se consultan al generar el calendario. La aplicación no actualiza las tendencias ni regenera el contenido de forma autónoma mientras está cerrada: volver a consultar y generar requiere una acción del usuario en la aplicación. No se publican ni se programan mensajes en las redes desde la aplicación.

## Validación

`npm test` pasa 47 pruebas de duraciones, cantidades, reparto anual, límites, calendarios, fuentes parciales, contexto geográfico, etiquetas observadas y generación con respuestas simuladas. `npm run build` compila el cliente. La comprobación en Chrome incluyó 12 publicaciones a lo largo de cinco bloques, filtros, edición y calendario de siete columnas a 390 px, sin errores de ejecución ni desbordamiento de página.

La prueba real de Gemini devolvió HTTP 200 con seis publicaciones en las seis plataformas, respetando la agenda, en unos 30 segundos. Google Trends respondió; GDELT no estuvo disponible y las conexiones sociales estaban sin configurar. No se obtuvo evidencia externa pertinente para vincular a esas piezas: se identificaron como hipótesis editoriales. Esta prueba confirma el recorrido de generación y el manejo de fuentes faltantes, no resultados de alcance ni conexión a las seis APIs.
