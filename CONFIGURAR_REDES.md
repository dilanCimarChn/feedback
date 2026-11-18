# Configurar accesos reales a redes sociales

Actualizado: 17 de noviembre de 2026. Esta guía corresponde a los conectores de este repositorio. Los nombres de menús, permisos y condiciones pueden cambiar: consultar las referencias oficiales de cada proveedor al configurar.

## Estado y decisiones para retomar en otra sesión

- Se confirmó la presencia de las variables sociales existentes en **Vercel Production**: `GEMINI_API_KEY`, `YOUTUBE_API_KEY`, `META_GRAPH_VERSION`, `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID` y `FACEBOOK_PAGE_ACCESS_TOKEN`. Su presencia no acredita permisos de descubrimiento. Se añadió el almacén privado de campañas con `BLOB_READ_WRITE_TOKEN` y el secreto `EQUIPO_CODIGO_ACCESO`; ver [CALENDARIO_EQUIPO.md](CALENDARIO_EQUIPO.md). Las pruebas reales de cada ruta deben comprobar su respuesta, no solo la presencia del token.
- Preferencia: usar fuentes sociales sin contratar APIs de pago. **X queda excluido en el código, incluso si existe `X_BEARER_TOKEN`**. No se consulta al generar ni desde el radar.
- Se puede generar una campaña sin conectar redes. Google Trends RSS y noticias GDELT no requieren tokens de redes en esta implementación; dependen de disponibilidad externa. Gemini y alojamiento tienen sus propias condiciones y costos.
- La estrategia TSCP se basa en el PDF del equipo de marketing: tres meses recomendados, cuatro segmentos, cinco pilares, nueve publicaciones semanales y cinco borradores de email. Detalles en [MARKETING.md](MARKETING.md).
- La ONG tiene audiencia internacional. El mercado de tendencias y la zona horaria de cada plan son configurables; no limitar el análisis a Bolivia ni asumir que una zona representa a todo el mundo.
- Hay conectores de lectura, pero no conexión OAuth desde la interfaz ni renovación automática de tokens. Obtener tokens mediante los flujos oficiales requiere trabajo de configuración y, para OAuth, una URL de retorno y un intercambio seguro de código por token. Este repositorio todavía no proporciona esos endpoints.
- Hay búsqueda temática de videos recientes en YouTube y descubrimiento externo limitado de Instagram por hashtags y cuentas profesionales de referencia. Las pruebas de conectores son simuladas; falta comprobar permisos y resultados de cada cuenta en vivo. No se ha implementado extracción de horas de actividad de seguidores, escucha social global, CRM, publicación ni envío de emails.

## Qué acceso obtener y qué costo esperar

| Servicio | Acceso usado aquí | Condiciones de costo y alcance |
| --- | --- | --- |
| Facebook / Instagram | Tokens de cuentas autorizadas; Instagram añade búsqueda por hashtag y Business Discovery cuando la app tiene acceso | Las consultas estándar normalmente no llevan cobro por llamada; requieren permisos, límites y posible App Review. No incluyen escucha global ni actividad de audiencia. Confirmar condiciones en Meta. |
| TikTok Display API | Token de usuario con `video.list` | La guía no publica una tarifa por consulta; requiere aprobación y consentimiento. No equivale a acceso a todos los videos de TikTok. |
| YouTube Data API | API key de un proyecto Google Cloud | Uso inicial sin pago dentro de la cuota asignada. No confundir unidades de cuota con dólares ni con una ampliación automática de pago. |
| X | Excluido de las consultas | Su API cobra por uso. No se activa aunque haya un token guardado; no comprar créditos para esta implementación. |
| LinkedIn | Token OAuth de administrador de organización | Acceso sujeto a producto aprobado, permisos y límites; no se necesita comprar Premium como sustituto de autorización API. Verificar condiciones del producto solicitado. |

Referencias: [precios de X](https://docs.x.com/x-api/getting-started/pricing), [cuotas de YouTube](https://developers.google.com/youtube/data/guides/quota_and_compliance_audits), [requisitos de TikTok](https://developers.tiktok.com/docs/en/display-api-get-started), [Meta](https://developers.facebook.com/docs/), [permisos de LinkedIn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api).

## Antes de empezar

1. Pedir al administrador de marketing acceso adecuado a las páginas y cuentas de TSCP. Ser desarrollador de la aplicación no concede acceso a las cuentas de la ONG.
2. Registrar las aplicaciones bajo cuentas controladas por la organización y conservar propietario, identificador de app, permisos, fecha de expiración y responsable de renovación en un registro interno. No guardar tokens en ese registro si está versionado.
3. Preparar dominio, política de privacidad y URL de retorno HTTPS cuando el proveedor los solicite. Los flujos OAuth requieren configurar e implementar esa URL: no usar una ruta inventada ni asumir que el botón de conexión ya existe.
4. No compartir contraseñas, tokens ni archivos `.env` en el chat, documentación o Git. Las claves van exclusivamente en el servidor; nunca en variables `VITE_`.

## YouTube: primer acceso sencillo

1. Entrar a [Google Cloud Console](https://console.cloud.google.com/) con la cuenta de la organización y crear o elegir un proyecto.
2. Abrir **APIs y servicios → Biblioteca**, buscar **YouTube Data API v3** y habilitarla.
3. Abrir **APIs y servicios → Credenciales → Crear credenciales → Clave de API**.
4. Restringir la clave a YouTube Data API v3. Las restricciones de aplicación deben ser compatibles con llamadas desde el servidor; una restricción exclusiva por referente web no corresponde a este conector.
5. Guardar el valor como `YOUTUBE_API_KEY` en el servidor. Revisar consumo en la consola de cuotas.
6. Consultar Fuentes y tendencias con un tema y un país admitido. Con tema, el conector hace una búsqueda `search.list` de hasta **10 videos de los últimos 1–30 días (7 por defecto)**, por relevancia, y una llamada `videos.list` con sus IDs para consultar duración y métricas públicas. Sin resultados válidos no hace la segunda llamada. Sin tema utiliza `videos.list?chart=mostPopular`, hasta 15 videos. No necesita OAuth para estas lecturas públicas.

La caché de 15 minutos comparte consultas por país, tema y credencial. Cada tema no cacheado consume como máximo una búsqueda y una consulta de detalles, sin paginación ni reintentos automáticos. Si fallan los detalles, se conservan los resultados encontrados con métricas desconocidas y un aviso parcial. Si falla la búsqueda, se informa el error sin fabricar videos ni exponer la clave.

La cuota predeterminada vigente es **100 llamadas `search.list` al día en una bolsa separada**: cada búsqueda consume una unidad de esa bolsa, no 100 unidades del resto. `videos.list` consume una unidad de las **10.000 unidades diarias compartidas por los otros endpoints**. Las cuotas se reinician a medianoche del Pacífico (PT); el saldo no usado no se acumula para otro día. Confirmar la asignación del proyecto en Google Cloud: puede variar. No se añade pago ni ampliación automática de cuota.

`regionCode` indica videos disponibles para reproducirse en el país solicitado, o el catálogo popular de ese país. No prueba residencia del creador, ubicación de sus espectadores, horas de conexión ni tendencia global. Vistas y likes son acumulados.

Referencias: [autorización y claves](https://developers.google.com/youtube/data/guides/authentication), [búsqueda temática](https://developers.google.com/youtube/data/reference/rest/v3/search/list), [detalles de videos](https://developers.google.com/youtube/data/reference/rest/v3/videos/list), [cuotas y reinicio PT](https://developers.google.com/youtube/data/determine_quota_cost).

## Facebook e Instagram: una app en Meta

Este conector usa Graph API con Facebook Login. No está adaptado a Instagram Login independiente; no mezclar tokens y permisos de ambos productos.

1. Entrar a [Meta for Developers → Apps](https://developers.facebook.com/apps/), registrarse como desarrollador si hace falta y crear una app con el caso de uso apropiado para gestionar o leer las cuentas de la organización.
2. Comprobar que quien autoriza administra la página de Facebook. Para Instagram, usar una cuenta profesional vinculada a esa página en el flujo compatible con Facebook Login.
3. Configurar los productos y el acceso de Facebook Login correspondiente. Para enumerar páginas y leer su contenido, revisar `pages_show_list` y `pages_read_engagement`; para leer la cuenta profesional vinculada, revisar `instagram_basic` y los permisos de página que exija el flujo vigente. Los permisos dependen del caso de uso y pueden requerir App Review o verificación empresarial.
4. En desarrollo, usar cuentas con rol autorizado en la app. Para uso por terceros fuera de esos roles, completar las aprobaciones exigidas; un token de prueba no acredita acceso de producción.
5. Usar [Graph API Explorer](https://developers.facebook.com/tools/explorer/) para comprobar permisos y consultar `GET /me/accounts?fields=id,name,access_token,instagram_business_account`. La respuesta puede contener secretos: no copiarla al chat ni guardarla en Git.
6. Obtener el ID de página y su token autorizado. Guardar `FACEBOOK_PAGE_ID` y `FACEBOOK_PAGE_ACCESS_TOKEN`. No confundir el ID de página con el ID del usuario.
7. Obtener el ID numérico de la cuenta profesional de Instagram vinculada. Guardar `INSTAGRAM_USER_ID` y un token autorizado compatible con ese recurso en `INSTAGRAM_ACCESS_TOKEN`; no usar el nombre `@usuario` como ID.
8. Guardar en `META_GRAPH_VERSION` una versión actualmente soportada que se haya usado al probar la app, en formato `vNN.N`. No copiar literalmente ese marcador.
9. Revisar duración, renovación y revocación del token según su tipo. La aplicación no lo renueva automáticamente.

**Descubrimiento externo de Instagram:** se propone automáticamente un hashtag a partir del tema; se admiten como máximo dos hashtags por consulta. Hashtag Search consulta `/ig_hashtag_search` y luego `top_media` y `recent_media`. Requiere los permisos aplicables y la función **Instagram Public Content Access** aprobada mediante App Review. `recent_media` corresponde a contenido de las últimas 24 horas; no se presupone orden cronológico. Meta limita la consulta a **30 hashtags únicos por cuenta en una ventana móvil de 7 días**. La protección local está en memoria y no sustituye el límite global de Meta entre procesos, despliegues o aplicaciones.

**Cuentas de referencia, opcionales:** el administrador puede añadir `INSTAGRAM_DISCOVERY_ACCOUNTS` con hasta dos nombres de usuario separados por coma, sin `@` ni URL. Business Discovery consulta medios públicos de cuentas profesionales compatibles. No hace falta rellenar esta variable para generar un calendario. Revisar `instagram_basic`, `instagram_manage_insights` y `pages_read_engagement`, además de permisos que correspondan al rol en Business Manager y al producto aprobado. La lectura propia de Instagram puede funcionar aunque el descubrimiento externo sea rechazado: no son el mismo acceso.

Las subfuentes informan consulta, selección, estado y detalle. Un rechazo, falta de aprobación o resultado vacío se muestra como tal; no se sustituye silenciosamente por publicaciones propias ni se afirma acceso validado. Estos endpoints no filtran espectadores por ciudad o país ni ofrecen sus horas de actividad. Hashtags observados y métricas acumuladas no demuestran viralidad.

Referencias: [Pages: inicio](https://developers.facebook.com/docs/pages-api/getting-started/), [Instagram con Facebook Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started), [tokens de página](https://developers.facebook.com/docs/pages-api/getting-started/page-access-tokens/), [Hashtag Search](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search), [Business Discovery](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery). Confirmar los requisitos vigentes de la app y versión en Meta; la presencia de los tokens no acredita su aprobación.

## TikTok: autorización de la cuenta

1. Entrar a [TikTok for Developers](https://developers.tiktok.com/) y registrar una aplicación en el portal.
2. Solicitar y configurar **Login Kit** y **Display API**, con los requisitos de revisión del proveedor.
3. Configurar la URL de retorno e implementar el flujo de autorización oficial. La guía pide `user.info.basic` y `video.list`; este conector utiliza la lectura de videos de `video.list`.
4. El administrador autoriza la cuenta de TSCP; intercambiar el código de autorización por un access token desde una herramienta o backend seguro siguiendo la documentación oficial. El Client Key o Client Secret no sustituye al token de usuario.
5. Guardar el access token en `TIKTOK_ACCESS_TOKEN`. Conservar de forma segura la información necesaria para renovación; el repositorio no tiene almacenamiento ni renovación de refresh tokens.
6. Probar con una cuenta que tenga videos públicos. Este acceso devuelve videos de la cuenta autorizada, no tendencias de toda la plataforma. Leer los plazos de vigencia devueltos en `expires_in` y `refresh_expires_in`; no suponer que el token se renovará solo.

Para explorar tendencias de TikTok fuera de la cuenta, [Creative Center](https://ads.tiktok.com/business/creativecenter/) se utiliza manualmente. Este repositorio no integra una API de Creative Center ni lo consulta mediante scraping.

Referencia: [guía oficial con autorización y obtención de token](https://developers.tiktok.com/docs/en/display-api-get-started).

## X / Twitter: excluido para evitar consumo de pago

La investigación excluye X aun cuando encuentre `X_BEARER_TOKEN` en el entorno. No se llama a búsqueda reciente ni a tendencias, y el estado explica la exclusión. Dejar la variable vacía en configuraciones nuevas. La planificación de piezas para X puede seguir funcionando como propuesta editorial, sin atribuirle tendencias externas verificadas de esa red.

Referencia: [precios de X](https://docs.x.com/x-api/getting-started/pricing). Habilitarlo en el futuro requeriría otra decisión explícita y modificar esta exclusión; un token por sí solo no lo activa.

## LinkedIn: relevante para los decisores de ONGs

1. Entrar a [LinkedIn Developers → Apps](https://www.linkedin.com/developers/apps) y crear una app asociada a la página de la organización.
2. Solicitar el producto de Community Management que habilite las operaciones necesarias. El inicio de sesión básico por sí solo no habilita lectura de publicaciones de organizaciones.
3. Configurar OAuth, la URL de retorno y los permisos aprobados. Para este conector revisar `r_organization_social`, con un miembro que tenga un rol de página permitido.
4. Completar el consentimiento e intercambio de código por token mediante el flujo oficial. Para pruebas con una app aprobada también existe el [Token Generator oficial](https://learn.microsoft.com/en-us/linkedin/shared/authentication/developer-portal-tools). Guardar el token en `LINKEDIN_ACCESS_TOKEN`; esta herramienta de prueba no implementa el callback o la renovación que faltan en el repositorio.
5. Obtener el ID numérico autorizado de la organización en los recursos de LinkedIn; guardar únicamente los números en `LINKEDIN_ORGANIZATION_ID`, no la URL, el slug ni `urn:li:organization:...`.
6. Guardar una versión soportada en `LINKEDIN_VERSION`, formato `AAAAMM`. Consultar las versiones actuales: no usar el mes del sistema sin comprobar soporte.

El adaptador agrega `X-Restli-Protocol-Version: 2.0.0` y consulta publicaciones; todavía no importa estadísticas de rendimiento.

Referencia: [Posts API: versiones, permisos y lectura por autor](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api).

## Dónde guardar las variables

Los nombres exactos están en [.env.example](.env.example). No hace falta rellenarlos todos: dejar vacíos los conectores que no se usarán.

**Local:** editar el archivo `.env` de la raíz sin sobrescribir las variables existentes. Por ejemplo, para activar únicamente YouTube añadir `YOUTUBE_API_KEY` con el valor real, sin modificar `GEMINI_API_KEY` ni el código de acceso. Reiniciar `npm.cmd run dev` después del cambio. No versionar `.env`.

**Vercel:** abrir el proyecto → **Settings → Environment Variables**, agregar las variables necesarias y seleccionar los entornos correspondientes. Volver a desplegar para que las funciones reciban los valores nuevos. No poner credenciales de producción en despliegues de prueba innecesariamente.

Nunca usar el prefijo `VITE_`: expondría los valores al navegador. No pegar tokens en URLs compartidas, capturas, exportaciones o informes de error.

## Cómo comprobar cada conexión

1. Abrir **Fuentes y tendencias**, seleccionar mercado y tema, y consultar. Con el servidor actualizado, las fuentes reportan sus estados independientemente.
2. **Sin configurar:** faltan variables; la aplicación no intenta consultar esa red.
3. **Consultada:** hubo resultados. Revisar que los enlaces corresponden a la cuenta esperada y las fechas/métricas tienen sentido.
4. **Sin resultados:** la consulta no devolvió elementos; no prueba que existan tendencias ni que todos los permisos sean correctos.
5. **No disponible:** revisar permisos, expiración, cuota, versión API y disponibilidad del proveedor. No publicar tokens al pedir ayuda.
6. Después de cambiar credenciales, considerar la caché de investigación de 15 minutos. En local, reiniciar el proceso la limpia; en despliegue, esperar su expiración antes de concluir que persiste el fallo.
7. Registrar una comprobación real con fecha, entorno, red, cuenta identificada sin secretos, estado y cantidad de elementos. Solo después marcar esa cuenta como verificada.

Las pruebas automatizadas con respuestas simuladas pueden ejecutarse con `npm test`. Incluyen búsqueda y detalles de YouTube, caché, errores de cuota, datos parciales y ausencia de secretos en las salidas. Comprueban código, no permisos, vigencia ni disponibilidad real.

## Pendientes de la siguiente sesión

- Con los siete nombres de variables confirmados en Production, comprobar primero YouTube y después lectura propia y descubrimiento externo de Meta, sin revelar valores. No volver a solicitar tokens por chat.
- Comprobar TikTok y LinkedIn solo si se tramitan sus permisos y variables. Mantener X excluido.
- Implementar OAuth y renovación si se busca una conexión mantenible desde la interfaz; no está resuelto por copiar una clave.
- Incorporar Insights o estadísticas de audiencia donde el proveedor lo permita para evaluar horarios, con zona, período y muestra. Las fechas de publicación no prueban picos de uso.
- Verificar resultados temáticos de YouTube y permisos de Hashtag Search/Business Discovery. Si se necesita más cobertura, evaluar fuentes oficiales con licencia y finalidad compatibles; no prometer que un token de cuenta proporciona escucha global.
- Mantener la campaña de tres meses revisable semanalmente, diferenciando evidencia real, temporadas y propuestas editoriales.

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
