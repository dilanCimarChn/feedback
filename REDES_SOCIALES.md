# Fuentes sociales

Actualizado: 17 de noviembre de 2026.

Guía práctica: [CONFIGURAR_REDES.md](CONFIGURAR_REDES.md) explica dónde registrarse, qué permisos obtener, cómo configurar el servidor y qué comprobar. Incluye el estado del proyecto y los pendientes para retomar en otra sesión.

## Uso sencillo y costos

No hace falta conectar las seis redes para generar una campaña. Google Trends RSS y noticias GDELT permiten empezar sin tokens de redes sociales, sujetos a disponibilidad y condiciones del proveedor. Las conexiones de cuentas son opcionales y no aportan automáticamente Insights ni horas de actividad. La generación de textos sigue consumiendo Gemini según la cuenta configurada.

**X queda excluido en el código, aunque exista `X_BEARER_TOKEN`**, para respetar la preferencia de no contratar APIs de pago. No se hacen consultas a esa red; crear propuestas editoriales para X sigue siendo posible. YouTube requiere proyecto, clave y cuota de Data API. Meta, TikTok y LinkedIn requieren permisos y productos aprobados según el acceso; no se promete acceso libre a tendencias globales ni se equipara autorización con una suscripción de escucha social.

En Vercel Production se confirmó la presencia de `GEMINI_API_KEY`, `YOUTUBE_API_KEY`, `META_GRAPH_VERSION`, `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID` y `FACEBOOK_PAGE_ACCESS_TOKEN`. Estas variables no acreditan permisos de descubrimiento externo. También se configuraron el almacenamiento privado y el código de acceso del equipo; ver [CALENDARIO_EQUIPO.md](CALENDARIO_EQUIPO.md).

Para horarios de mayor actividad reales hacen falta estadísticas de audiencia de cada cuenta y zona; el histórico importado solo permite pruebas apoyadas en muestras de rendimiento. El sistema no garantiza visibilidad ni llama horas pico a horarios estimados.
El radar prioriza Facebook, Instagram, TikTok, X (Twitter), LinkedIn y YouTube. Google Trends y GDELT son complementarios. Los adaptadores consultan APIs oficiales; no se hace scraping de sesiones ni se simulan resultados. Las credenciales se configuran en el servidor con las variables de `.env.example`, nunca con prefijo `VITE_`.

| Red | Lectura implementada | Configuración | Alcance real |
| --- | --- | --- | --- |
| Facebook | `/{page_id}/posts`: texto, enlace, fecha y compartidos si se devuelven | `META_GRAPH_VERSION`, `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN` | Página autorizada; no ranking global ni Insights de audiencia |
| Instagram | `/{ig_user_id}/media`: caption, formato, fecha, likes y comentarios | `META_GRAPH_VERSION`, `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` | Cuenta profesional autorizada mediante la configuración de Meta compatible con Graph Facebook; no API de Instagram Login en este adaptador |
| Instagram externo | Hashtag Search: `ig_hashtag_search`, `top_media`, `recent_media`; Business Discovery: medios de cuentas profesionales de referencia | Las mismas variables de Meta/Instagram, permisos y App Review; `INSTAGRAM_DISCOVERY_ACCOUNTS` opcional, hasta 2 usuarios separados por coma | Descubrimiento limitado por tema y cuentas elegidas; no filtro geográfico de audiencia, escucha global ni Insights |
| TikTok | `/v2/video/list/`: videos y métricas devueltas | `TIKTOK_ACCESS_TOKEN` con `video.list` | Videos públicos del usuario autorizado; no tendencias de todos los usuarios |
| X | Ninguna llamada: fuente excluida | Un token existente no la activa | Sin datos externos de X; la API tiene consumo de pago |
| LinkedIn | `/rest/posts?q=author`: publicaciones de organización | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORGANIZATION_ID`, `LINKEDIN_VERSION` | Organización autorizada; sin métricas de rendimiento en esta llamada |
| YouTube | Con tema: `search.list` de videos publicados en los últimos 1–30 días (7 por defecto) y `videos.list` por IDs; sin tema: `videos.list?chart=mostPopular` | `YOUTUBE_API_KEY` | Hasta 10 videos temáticos o 15 populares; el país indica disponibilidad o selección de catálogo, no ubicación de los espectadores; no clasificación automática de Shorts |

## Búsqueda temática de YouTube

Cada consulta temática no cacheada hace **una búsqueda y, si encuentra IDs válidos, una consulta de detalles**, sin paginar. Extrae título, enlace, fecha, duración, vistas, likes y hashtags presentes en la descripción. Solo devuelve IDs válidos, elimina duplicados y conserva la selección por relevancia. Los resultados temáticos se limitan a los últimos 1–30 días (7 por defecto); esto no equivale a un ranking de crecimiento. Si fallan los detalles, se conservan las observaciones de búsqueda con métricas desconocidas y aviso parcial. Sin tema se conserva la selección popular nacional.

La cuota predeterminada actual asigna **100 consultas `search.list` por día en una bolsa propia**, con una unidad por consulta; no son 100 unidades por búsqueda. `videos.list` cuesta una unidad de las **10.000 unidades diarias compartidas por los demás endpoints**. El reinicio es a medianoche del Pacífico (PT) y el saldo no se acumula. Comprobar las cuotas reales del proyecto en Google Cloud; no hay ampliación ni pago automático en esta implementación. Referencias: [búsqueda](https://developers.google.com/youtube/data/reference/rest/v3/search/list), [detalles](https://developers.google.com/youtube/data/reference/rest/v3/videos/list), [cuotas](https://developers.google.com/youtube/data/determine_quota_cost).

## Descubrimiento externo de Instagram

Se propone **un hashtag automáticamente por tema**; se admiten hasta dos por consulta. La app necesita los permisos aplicables y **Instagram Public Content Access** aprobado por App Review. `top_media` y `recent_media` son selecciones del proveedor; `recent_media` incluye contenido de las últimas 24 horas y no se presupone orden cronológico. Meta permite consultar **30 hashtags únicos por cuenta en 7 días móviles**. El control local de intentos está en memoria; no sustituye la cuota global de Meta ni coordina otros procesos, despliegues o aplicaciones.

Opcionalmente el administrador configura **hasta dos cuentas profesionales de referencia** en `INSTAGRAM_DISCOVERY_ACCOUNTS`, separadas por coma y sin `@` ni URL. El visitante no tiene que llenar ese campo. Business Discovery requiere acceso aprobado y permisos aplicables, entre ellos `instagram_basic`, `instagram_manage_insights` y `pages_read_engagement` según el flujo y los roles. No se adivinan cuentas ni se considera aprobada la aplicación por tener un token.

Cada subfuente conserva tipo, hashtag o usuario consultado, selección, instante, estado y detalle. Se declaran fuentes parciales, rechazo de permisos, falta de configuración y ausencia de resultados; no se sustituyen silenciosamente por publicaciones propias. El formato `VIDEO` se conserva como Clip cuando no hay evidencia para identificarlo como Reel. Ninguna de estas consultas acredita ubicación de audiencia, picos de conexión o eficacia de un hashtag. Referencias: [Hashtag Search](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search), [Business Discovery](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery).

## Límites comunes

Los adaptadores de Meta requieren una versión Graph vigente en formato `vNN.N`. LinkedIn requiere versión vigente `AAAAMM` y usa `X-Restli-Protocol-Version: 2.0.0`. No se fija una versión implícita para evitar aparentar compatibilidad cuando el proveedor la retire. Los permisos concretos dependen del producto y configuración de cada aplicación; una clave por sí sola no concede acceso a cuentas.

No hay todavía flujo de conexión OAuth en el navegador, renovación automática de tokens, multiempresa ni almacenamiento de credenciales sociales por usuario. Los calendarios sí tienen persistencia compartida privada. Estas conexiones son para las cuentas que el administrador configure en esta instalación. Los tokens deben obtenerse por las vías oficiales y renovarse cuando corresponda. La UI no pide al visitante pegar claves; muestra requisitos y estado de conexión sin revelar valores.

Cada conexión tiene timeout independiente y estados explícitos; X informa su exclusión. Un error de autorización/cuota no bloquea las otras redes. La investigación comparte caché en memoria de 15 minutos; las claves de consulta cambian con país, tema y credenciales según la fuente. Se consultan páginas acotadas, no históricos exhaustivos: hasta 15 publicaciones en los lectores de cuentas, 10 videos temáticos de YouTube y hasta 10 medios por cuenta en Business Discovery. Los datos consultados y sus alcances se incluyen en el contexto del generador y en los planes exportados y guardados para el equipo. También se envían a Gemini al generar una campaña.

No se equiparan vistas con alcance, ni likes con conversiones; las métricas ausentes quedan sin dato. Fechas de publicación no demuestran horas de mayor actividad. El generador puede elegir las seis redes; X admite Texto, Imagen o Clip. Esto no publica automáticamente.

Los adaptadores de cuentas propias de Facebook, TikTok Display API y LinkedIn siguen disponibles por separado, sin escucha global. Los nuevos conectores externos requieren los accesos específicos descritos abajo. [TikTok Creative Center](https://ads.tiktok.com/business/creativecenter/) sirve como consulta manual: no hay integración API ni scraping de ese sitio. Para ampliar cobertura se necesitan fuentes con licencia y finalidad compatibles; [TikTok Research API](https://developers.tiktok.com/products/research-api), por ejemplo, restringe elegibilidad y finalidad. No se ha contratado ni integrado un proveedor externo de escucha social.

Referencias oficiales adicionales: [Facebook Pages](https://developers.facebook.com/docs/pages-api/posts/), [Instagram](https://developers.facebook.com/docs/instagram-platform/), [TikTok Display API](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list), [precios de X](https://docs.x.com/x-api/getting-started/pricing), [LinkedIn Posts y permisos](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api).

Validación: `npm test` usa respuestas simuladas para comprobar búsqueda, normalización, caché, fallos parciales y manejo de credenciales. No acredita permisos de producción ni conexión en vivo. Registrar fecha, entorno, fuente, cuenta identificada sin secretos y resultado de una prueba real antes de declarar una cuenta verificada.

## TikTok Discovery: términos públicos no personalizados

Configurar `TIKTOK_DISCOVERY_ACCESS_TOKEN` y `TIKTOK_DISCOVERY_BUSINESS_ID`. El segundo valor corresponde al **`open_id` del usuario que autorizó el flujo OAuth**, no al ID del anunciante ni al Business Center. Es una credencial distinta de `TIKTOK_ACCESS_TOKEN` de Display API.

La ruta oficial `GET /open_api/v1.3/discovery/trending/search/` recibe `business_id` e `is_personalized=false`; el token va en el encabezado `Access-Token`. Requiere **`discovery.search.words`** y el acceso de cuenta que TikTok exija (Advanced Access o verificación aplicable). Una respuesta rechazada se muestra como no disponible; guardar un token no activa la fuente por sí solo. No hay OAuth nuevo dentro de esta aplicación: el administrador completa el flujo aprobado del proveedor y configura los valores en el backend.

Devuelve hasta 20 términos actuales de `search_keywords`, sin videos, vistas ni volumen. Esa ruta no filtra por país o intervalo histórico. El radar señala coincidencias temáticas y ofrece explorar el término; no inventa métricas regionales. Creative Center sigue siendo una herramienta manual independiente. [Documentación oficial de TikTok Discovery](https://business-api.tiktok.com/portal/docs?id=1832798345014338).

## Facebook: páginas externas aprobadas

Configurar `FACEBOOK_DISCOVERY_PAGE_IDS` con hasta tres IDs de páginas de referencia separados por coma y `FACEBOOK_PUBLIC_ACCESS_TOKEN` con acceso público aprobado para este caso de uso. Requiere la función/producto y permisos de Meta que correspondan, por ejemplo Page Public Content Access; confirmar aprobación y alcance con la app. La versión continúa en `META_GRAPH_VERSION`.

El conector consulta `/{page_id}/posts` de esas páginas, hasta diez publicaciones por página, y excluye el ID de la página propia. No reutiliza `FACEBOOK_PAGE_ACCESS_TOKEN` como sustituto. No es búsqueda global ni escucha social general. Sin acceso aprobado muestra el pendiente y el equipo puede guardar enlaces manuales en el radar, identificados como referencias por revisar. [Page Public Content Access](https://developers.facebook.com/docs/features-reference/page-public-content-access/).

## Preferencias de Instagram y campañas compartidas

`INSTAGRAM_DISCOVERY_HASHTAGS` y `INSTAGRAM_DISCOVERY_ACCOUNTS` admiten hasta dos valores separados por coma, sin URLs. Las opciones del radar pueden elegirlos para una consulta. Si no se definen, se propone un hashtag por tema. `INSTAGRAM_CUENTAS_REFERENCIA` se sigue aceptando como alternativa por compatibilidad. Los permisos y límites de Hashtag Search y Business Discovery descritos arriba siguen aplicando.

Las campañas y enlaces del equipo se guardan mediante `api/campanas.js` con un código privado. Requisitos, conflictos de revisión y uso de edición/aprobación en [CALENDARIO_EQUIPO.md](CALENDARIO_EQUIPO.md). No se publican contenidos automáticamente.

## Comprobacion local del descubrimiento publico: 18 de noviembre de 2026

La rama de trabajo es `feat/descubrimiento-publico`. Se conservaron e integraron los cambios locales existentes. Las metricas propias tienen endpoint separado y no alimentan el radar ni el catalogo de referencias de campanas.

- Instagram: el backend consulta Hashtag Search y top_media/recent_media; top_media se presenta como **Publicaciones destacadas por hashtag** con el permalink real. Business Discovery se comprueba por separado. El exito del Explorador de Meta y el estado Listo para prueba no acreditan la ejecucion desde este backend. En esta prueba local faltaron INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID y META_GRAPH_VERSION. Tambien falta una cuenta competidora para probar Business Discovery; el error #10 anterior sigue sin revalidarse.
- YouTube: se reutilizo la busqueda publica por tema, canal UC y ventana de 1 a 30 dias, enriquecida con fecha y vistas. El radar permite elegir orden y canal. La etiqueta de vistas limita la afirmacion a los resultados del periodo, sin afirmar un ranking de toda la plataforma. YOUTUBE_API_KEY no esta en el entorno local. Su presencia en Vercel Production fue informada previamente, pero no se verifico en esta sesion: no hay CLI de Vercel disponible ni un conector de administracion.
- Facebook: permanece **Pendiente de acceso a paginas publicas** ante falta de acceso, rechazo o respuesta vacia. Solo pasa a Consultada con publicaciones externas y enlaces validos. Se excluye el ID propio y no se reutiliza su token. El #100 anterior no se revalido sin credenciales externas.
- TikTok: pendiente y sin consultas automaticas desde el radar, incluso si hay credenciales de Discovery.
- Consulta HTTP local de /api/tendencias: 200; Google Trends devolvio datos reales de Bolivia; GDELT no estuvo disponible. Ninguna consulta social devolvio contenido real por falta de configuracion local. Google Trends aporta busquedas generales, no contenido de competidores ni validacion del sector.
- Calendario HTTP con un ejemplo ficticio y Gemini real, autorizado por el usuario: 503; no se genero una propuesta real. Las pruebas simuladas comprueban continuidad con redes pendientes, marca, publico, objetivo y referencias. No se declara validacion real de Gemini ni de contenido competitivo.

Para completar la comprobacion social local, configurar las variables anteriores solo en .env.local del backend. Para Facebook se requieren FACEBOOK_PUBLIC_ACCESS_TOKEN, FACEBOOK_DISCOVERY_PAGE_IDS y META_GRAPH_VERSION, con acceso externo efectivo; para Business Discovery, INSTAGRAM_DISCOVERY_ACCOUNTS. No copiar secretos al frontend ni usar prefijo VITE_. No se modificaron credenciales ni ajustes de Vercel.

Comandos desde la raiz de feedback:

```powershell
npm.cmd run comprobar:descubrimiento
npm.cmd test
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1
```

Abrir http://127.0.0.1:5173/ (Vite anunciara otro puerto si este esta ocupado). El diagnostico muestra presencia de variables, estados y hasta cinco enlaces de resultados; no muestra valores de credenciales ni respuestas crudas. La generacion sigue usando el catalogo externo para resolver IDs de referencias a enlaces reales; sin referencia reciente una pieza se identifica como hipotesis editorial. Los archivos del almacenamiento local de desarrollo quedan excluidos del servidor de archivos de Vite.
