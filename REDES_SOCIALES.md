# Fuentes sociales y alcance de los datos

El radar de **Fuentes y tendencias** reúne referencias públicas para orientar el calendario. Las métricas de cuentas propias utilizan `/api/metricas-propias` y permanecen separadas: una publicación propia no se presenta como tendencia competitiva. Configuración y permisos en [CONFIGURAR_REDES.md](CONFIGURAR_REDES.md).

Se puede generar una campaña sin conectar cuentas sociales. Google Trends RSS y GDELT no necesitan tokens sociales en esta implementación, pero dependen de disponibilidad externa. Gemini, las APIs y el alojamiento tienen sus propias cuotas y condiciones.

## Fuentes del radar

| Fuente | Lectura implementada | Alcance y límites |
| --- | --- | --- |
| Google Trends | RSS por país, hasta 20 búsquedas | Búsquedas generales, sin filtro por ciudad o sector; se comprueba coincidencia temática |
| YouTube | Búsqueda por tema o canal en los últimos 1–30 días; sin tema ni canal, selección popular | Hasta 10 resultados temáticos o 15 populares; no es un ranking completo ni identifica la ubicación de espectadores |
| Instagram por hashtag | `ig_hashtag_search` y `top_media` | Hasta dos hashtags por consulta y tres publicaciones por hashtag; selección del proveedor, sin histórico configurable ni audiencia geográfica |
| Instagram Business Discovery | Medios de hasta dos cuentas profesionales de referencia | Hasta diez medios por cuenta compatible y autorizada; no escucha global |
| Facebook externo | `/{page_id}/posts` de hasta tres páginas de referencia | Hasta diez publicaciones por página, con acceso público aprobado; excluye la página propia |
| GDELT | Noticias sobre tema y menciones geográficas | Complemento editorial; el lugar mencionado no identifica a los lectores |
| TikTok | Integración pendiente en el radar | No consulta cuentas propias ni Discovery al investigar |
| LinkedIn | Sin descubrimiento externo en esta aplicación | La lectura de la organización pertenece a métricas propias |
| X | Consultas excluidas, incluso con token presente | Se puede planificar contenido para X sin atribuirle señales externas de esa red |

El país, ventana de días, idioma y filtros se aplican según las capacidades de cada fuente. Instagram no adquiere filtro geográfico por seleccionar un país. Las categorías o formatos inferidos por la aplicación son sugerencias editoriales cuando el proveedor no los devuelve.

### YouTube

Con tema o canal se hace una llamada a `search.list`, sin paginar, y una a `videos.list` si hay IDs válidos. Se admiten orden por relevancia, vistas acumuladas o fecha, idioma y canal público con ID `UC…`. La ventana admite 1–30 días y usa siete por defecto.

Se conservan título, enlace, fecha, autor, duración y métricas devueltas. Si falla la consulta de detalles, se mantienen los resultados de búsqueda con métricas desconocidas y un aviso parcial. Si un detalle no vuelve en la respuesta válida, ese video se excluye. No se clasifican automáticamente Shorts ni se calcula velocidad de crecimiento.

El país representa disponibilidad de reproducción o selección del catálogo, no residencia del creador ni actividad de su audiencia. Las vistas y likes son acumulados. Revisar la cuota efectiva del proyecto en Google Cloud; el repositorio no amplía cuotas ni activa pagos. Referencias: [búsqueda](https://developers.google.com/youtube/data/reference/rest/v3/search/list), [detalles](https://developers.google.com/youtube/data/reference/rest/v3/videos/list), [cuotas](https://developers.google.com/youtube/data/determine_quota_cost).

### Instagram

El flujo por hashtag solicita `id,permalink,caption`. Si Meta rechaza esos campos con código 100, hace un único intento con `id,permalink`; no repite rechazos de token, permisos o cuota. No consulta `recent_media` en este flujo. Sin caption conserva `texto: null` y no inventa texto, imágenes, formato, vistas ni otras métricas.

La etiqueta **Publicaciones destacadas por hashtag en Instagram** describe la selección `top_media`; no demuestra crecimiento ni pertinencia. El hashtag identifica la consulta, no el contenido de una publicación cuyo texto no se recibió. Business Discovery conserva por separado su cuenta consultada y los campos disponibles. El tipo `VIDEO` se presenta como Clip cuando no hay evidencia para llamarlo Reel.

El control local registra hasta 30 hashtags únicos en siete días por cuenta. Está en memoria y no coordina reinicios, aplicaciones o instancias; no sustituye la cuota global aplicada por Meta. Cada subfuente declara consulta, selección, fecha, estado y detalle. Un rechazo no se sustituye silenciosamente por publicaciones propias.

Las preferencias `INSTAGRAM_DISCOVERY_HASHTAGS` y `INSTAGRAM_DISCOVERY_ACCOUNTS` admiten hasta dos valores separados por coma. Se acepta `INSTAGRAM_CUENTAS_REFERENCIA` como alternativa compatible. Sin hashtag configurado o elegido se propone uno a partir del tema. La acción protegida `preferencias` de `/api/tendencias` expone únicamente las opciones públicas, nunca credenciales. Referencias: [Hashtag Search](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search), [Business Discovery](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery).

### Facebook y TikTok

Facebook externo requiere `FACEBOOK_DISCOVERY_PAGE_IDS`, `FACEBOOK_PUBLIC_ACCESS_TOKEN` y `META_GRAPH_VERSION`, con acceso público aprobado para ese uso. No reutiliza el token de la página propia. Ante configuración ausente, rechazo o falta de resultados válidos mantiene **Pendiente de acceso a páginas públicas**. Referencia: [Page Public Content Access](https://developers.facebook.com/docs/features-reference/page-public-content-access/).

Existe un adaptador separado de TikTok Discovery para términos públicos no personalizados, pero no está conectado al radar. Utiliza `TIKTOK_DISCOVERY_ACCESS_TOKEN` y `TIKTOK_DISCOVERY_BUSINESS_ID`; el segundo corresponde al `open_id` autorizado, no al ID del anunciante. Requiere `discovery.search.words` y el acceso que apruebe TikTok. La ruta devuelve hasta 20 términos sin videos, vistas, volumen ni filtros históricos o regionales. Configurar esas variables no activa consultas en el radar. [Creative Center](https://ads.tiktok.com/business/creativecenter/) es una herramienta manual; no se integra ni se raspa. Referencia: [TikTok Discovery](https://business-api.tiktok.com/portal/docs?id=1832798345014338).

## Lectura de cuentas propias

| Red | Lectura | Variables de servidor |
| --- | --- | --- |
| Facebook | Posts de la página autorizada: texto, enlace, fecha y compartidos si se devuelven | `META_GRAPH_VERSION`, `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN` |
| Instagram | Medios de la cuenta profesional: caption, formato, fecha, likes y comentarios | `META_GRAPH_VERSION`, `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` |
| TikTok | Videos públicos de la cuenta autorizada mediante Display API | `TIKTOK_ACCESS_TOKEN` con `video.list` |
| LinkedIn | Posts de la organización; esta llamada no importa rendimiento | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORGANIZATION_ID`, `LINKEDIN_VERSION` |

Las lecturas de cuentas están acotadas a hasta quince publicaciones por red. No aportan automáticamente alcance, conversiones, estadísticas de audiencia o mejores horarios. El histórico CSV/JSON sigue siendo la fuente para comparar resultados propios. YouTube utiliza datos públicos, no una conexión OAuth a las estadísticas privadas del canal.

## Uso en campañas y disponibilidad

Las referencias seleccionadas pueden llevarse al calendario con su enlace, hashtag y texto disponible. Los datos enviados desde el navegador se identifican como aportados por el equipo, sin autenticarlos como respuesta del proveedor. El generador no debe describir una publicación cuyo texto no recibió. Las fuentes utilizadas se envían a Gemini y se conservan al exportar o compartir la campaña.

Los conectores consultan APIs oficiales desde el servidor, con plazos y estados independientes. Las investigaciones comparten caché de hasta quince minutos; los resultados con fuentes no disponibles usan una duración corta. Un fallo no bloquea las demás fuentes. Los límites de carga están en [RENDIMIENTO.md](RENDIMIENTO.md).

El radar se consulta al investigar o generar, sin actualización autónoma con la aplicación cerrada ni histórico continuo de crecimiento. Una campaña guardada conserva las observaciones utilizadas. No se equiparan vistas con alcance, likes con conversiones ni publicaciones con actividad de seguidores.

No hay OAuth en el navegador, renovación automática de tokens, credenciales por usuario ni aislamiento entre organizaciones. Tener una variable configurada no acredita permisos ni conexión vigente. `npm test` valida respuestas simuladas; una conexión real se acredita por fuente, cuenta, fecha, entorno y resultado, como explica [CONFIGURAR_REDES.md](CONFIGURAR_REDES.md).
