# Fuentes sociales

El radar prioriza Facebook, Instagram, TikTok, X (Twitter), LinkedIn y YouTube. Google Trends y GDELT son complementarios. Los adaptadores consultan APIs oficiales; no se hace scraping de sesiones ni se simulan resultados. Las credenciales se configuran en el servidor con las variables de `.env.example`, nunca con prefijo `VITE_`.

| Red | Lectura implementada | Configuración | Alcance real |
| --- | --- | --- | --- |
| Facebook | `/{page_id}/posts`: texto, enlace, fecha y compartidos si se devuelven | `META_GRAPH_VERSION`, `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN` | Página autorizada; no ranking global ni Insights de audiencia |
| Instagram | `/{ig_user_id}/media`: caption, formato, fecha, likes y comentarios | `META_GRAPH_VERSION`, `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` | Cuenta profesional autorizada mediante la configuración de Meta compatible con Graph Facebook; no API de Instagram Login en este adaptador |
| TikTok | `/v2/video/list/`: videos y métricas devueltas | `TIKTOK_ACCESS_TOKEN` con `video.list` | Videos públicos del usuario autorizado; no tendencias de todos los usuarios |
| X | `/2/tweets/search/recent`: texto, fecha y métricas públicas disponibles | `X_BEARER_TOKEN`, acceso al endpoint según cuenta/plan/cuota | Publicaciones recientes por tema; no filtro de país ni ranking oficial de tendencias |
| LinkedIn | `/rest/posts?q=author`: publicaciones de organización | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORGANIZATION_ID`, `LINKEDIN_VERSION` | Organización autorizada; sin métricas de rendimiento en esta llamada |
| YouTube | `/youtube/v3/videos?chart=mostPopular` | `YOUTUBE_API_KEY` | Selección popular por país, con vistas acumuladas; no clasificación automática de Shorts |

Los adaptadores de Meta requieren una versión Graph vigente en formato `vNN.N`. LinkedIn requiere versión vigente `AAAAMM` y usa `X-Restli-Protocol-Version: 2.0.0`. No se fija una versión implícita para evitar aparentar compatibilidad cuando el proveedor la retire. Los permisos concretos dependen del producto y configuración de cada aplicación; una clave por sí sola no concede acceso a cuentas.

No hay todavía flujo de conexión OAuth en el navegador, renovación automática de tokens, multiempresa ni almacenamiento de credenciales por usuario. Estas conexiones son para las cuentas que el administrador configure en esta instalación. Los tokens deben obtenerse por las vías oficiales y renovarse cuando corresponda. La UI no pide al visitante pegar claves; muestra requisitos y estado de conexión sin revelar valores.

Cada conexión tiene timeout independiente y estados `Sin configurar`, `Consultada`, `Sin resultados` o `No disponible`. Un error de autorización/cuota no bloquea las otras redes. La investigación comparte la caché en memoria de 15 minutos. Se consulta la primera página, hasta 15 publicaciones por red; no es un histórico exhaustivo. Los datos consultados y sus alcances se incluyen en el contexto del generador y en los planes exportados/guardados localmente. También se envían a Gemini al generar una campaña.

No se equiparan vistas con alcance, ni likes con conversiones; las métricas ausentes quedan sin dato. Fechas de publicación no demuestran horas de mayor actividad. El generador puede elegir las seis redes; X admite Texto, Imagen o Clip. Esto no publica automáticamente.

Para tendencias amplias más allá de cuentas autorizadas se necesitaría otra fuente con cobertura y licencia adecuadas: las APIs de investigación no son acceso general para cualquier aplicación de marketing. Por ejemplo, [TikTok Research API](https://developers.tiktok.com/products/research-api) restringe elegibilidad y finalidad. No se ha contratado ni integrado un proveedor externo de escucha social.

Referencias oficiales: [Facebook Pages](https://developers.facebook.com/docs/pages-api/posts/), [Instagram](https://developers.facebook.com/docs/instagram-platform/), [TikTok Display API](https://developers.tiktok.com/doc/tiktok-api-v2-video-list/), [X Recent Search](https://docs.x.com/x-api/posts/search-recent-posts), [LinkedIn Posts y permisos](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), [YouTube](https://developers.google.com/youtube/data/reference/rest/v3/videos/list).

Validación: `node --test tests/plataformas.test.js` verifica los cinco nuevos adaptadores con respuestas simuladas, ausencia de llamadas sin credenciales, autenticación, normalización, métricas desconocidas, errores de permisos y que los tokens no aparezcan en datos ni URLs. No acredita conexión en vivo a cuentas que aún no se han autorizado.
