# Configurar accesos reales a redes sociales

Actualizado: 12 de noviembre de 2026. Esta guía corresponde a los conectores de este repositorio. Los nombres de menús, permisos y condiciones pueden cambiar: consultar las referencias oficiales de cada proveedor al configurar.

## Estado y decisiones para retomar en otra sesión

- El usuario tramitará los accesos desde los portales oficiales. No se han obtenido ni validado credenciales nuevas durante esta sesión. No deducir que hay una conexión activa porque exista un conector o una variable en el servidor.
- Preferencia: comenzar sin pagar APIs sociales. X es opcional y se dejará sin configurar salvo decisión expresa de habilitar su consumo de pago.
- Se puede generar una campaña sin conectar redes. Google Trends RSS y noticias GDELT no requieren tokens de redes en esta implementación; dependen de disponibilidad externa. Gemini y alojamiento tienen sus propias condiciones y costos.
- La estrategia TSCP se basa en el PDF del equipo de marketing: tres meses recomendados, cuatro segmentos, cinco pilares, nueve publicaciones semanales y cinco borradores de email. Detalles en [MARKETING.md](MARKETING.md).
- La ONG tiene audiencia internacional. El mercado de tendencias y la zona horaria de cada plan son configurables; no limitar el análisis a Bolivia ni asumir que una zona representa a todo el mundo.
- Hay conectores de lectura, pero no conexión OAuth desde la interfaz ni renovación automática de tokens. Obtener tokens mediante los flujos oficiales requiere trabajo de configuración y, para OAuth, una URL de retorno y un intercambio seguro de código por token. Este repositorio todavía no proporciona esos endpoints.
- Las pruebas de conectores son simuladas. Falta comprobar cada cuenta en vivo. No se ha implementado extracción de horas de actividad de seguidores, escucha social global, CRM, publicación ni envío de emails.

## Qué acceso obtener y qué costo esperar

| Servicio | Acceso usado aquí | Condiciones de costo y alcance |
| --- | --- | --- |
| Facebook / Instagram | Tokens de cuentas autorizadas y sus IDs | Las consultas estándar normalmente no llevan cobro por llamada; requieren permisos, límites y posible revisión. No incluyen tendencias globales. Confirmar condiciones en Meta. |
| TikTok Display API | Token de usuario con `video.list` | La guía no publica una tarifa por consulta; requiere aprobación y consentimiento. No equivale a acceso a todos los videos de TikTok. |
| YouTube Data API | API key de un proyecto Google Cloud | Uso inicial sin pago dentro de la cuota asignada. No confundir unidades de cuota con dólares ni con una ampliación automática de pago. |
| X | Bearer Token para búsqueda reciente | Cobro por uso mediante créditos. Dejar la variable vacía para no activar este conector. |
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
6. Consultar Fuentes y tendencias con un país admitido por YouTube. El conector consulta videos populares públicos por país; no necesita OAuth para esa consulta y no entrega estadísticas privadas de audiencia.

Referencia: [autorización y claves de YouTube](https://developers.google.com/youtube/data/guides/authentication).

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

Referencias: [Pages: inicio](https://developers.facebook.com/docs/pages-api/getting-started/), [Instagram con Facebook Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started), [tokens de página](https://developers.facebook.com/docs/pages-api/getting-started/page-access-tokens/). Las páginas de Meta devolvieron HTTP 429 durante la comprobación de esta sesión; confirmar allí los requisitos exactos antes de tramitar permisos.

## TikTok: autorización de la cuenta

1. Entrar a [TikTok for Developers](https://developers.tiktok.com/) y registrar una aplicación en el portal.
2. Solicitar y configurar **Login Kit** y **Display API**, con los requisitos de revisión del proveedor.
3. Configurar la URL de retorno e implementar el flujo de autorización oficial. La guía pide `user.info.basic` y `video.list`; este conector utiliza la lectura de videos de `video.list`.
4. El administrador autoriza la cuenta de TSCP; intercambiar el código de autorización por un access token desde una herramienta o backend seguro siguiendo la documentación oficial. El Client Key o Client Secret no sustituye al token de usuario.
5. Guardar el access token en `TIKTOK_ACCESS_TOKEN`. Conservar de forma segura la información necesaria para renovación; el repositorio no tiene almacenamiento ni renovación de refresh tokens.
6. Probar con una cuenta que tenga videos públicos. Este acceso devuelve videos de la cuenta autorizada, no tendencias de toda la plataforma.

Referencia: [guía oficial con autorización y obtención de token](https://developers.tiktok.com/docs/en/display-api-get-started).

## X / Twitter: opcional y de pago

1. Entrar a [Developer Console](https://console.x.com/), aceptar las condiciones y describir el caso de uso.
2. Crear una app y obtener el **Bearer Token** para lectura pública.
3. Antes de activarlo, revisar [precios actuales](https://docs.x.com/x-api/getting-started/pricing), créditos y controles de gasto. No es necesario activarlo para la campaña TSCP.
4. Si se decide usarlo, guardar `X_BEARER_TOKEN` y verificar que la cuenta tiene acceso a búsqueda reciente. Si se quiere evitar ese consumo, mantener la variable vacía tanto localmente como en Vercel.

Este conector busca publicaciones recientes por tema; no consulta el endpoint de tendencias ni aplica filtro de país. La generación y el radar pueden invocarlo automáticamente si existe el token; la caché reduce consultas, pero no es un límite de gasto.

Referencia: [crear cuenta, app y credenciales](https://docs.x.com/x-api/getting-started/getting-access).

## LinkedIn: relevante para los decisores de ONGs

1. Entrar a [LinkedIn Developers → Apps](https://www.linkedin.com/developers/apps) y crear una app asociada a la página de la organización.
2. Solicitar el producto de Community Management que habilite las operaciones necesarias. El inicio de sesión básico por sí solo no habilita lectura de publicaciones de organizaciones.
3. Configurar OAuth, la URL de retorno y los permisos aprobados. Para este conector revisar `r_organization_social`, con un miembro que tenga un rol de página permitido.
4. Completar el consentimiento e intercambio de código por token mediante el flujo oficial. Guardar el token en `LINKEDIN_ACCESS_TOKEN`.
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

Las pruebas automatizadas con respuestas simuladas pueden ejecutarse con `node --test tests/plataformas.test.js tests/tendencias.test.js`. Comprueban código, no permisos, saldo ni disponibilidad real.

## Pendientes de la siguiente sesión

- Preguntar qué accesos ya se tramitaron y comprobar el estado sin revelar secretos; no pedir contraseñas ni tokens por chat.
- Verificar primero YouTube y después las cuentas de Meta, TikTok y LinkedIn según permisos disponibles. Mantener X opcional.
- Implementar OAuth y renovación si se busca una conexión mantenible desde la interfaz; no está resuelto por copiar una clave.
- Incorporar Insights o estadísticas de audiencia donde el proveedor lo permita para evaluar horarios, con zona, período y muestra. Las fechas de publicación no prueban picos de uso.
- Para tendencias amplias por sector, evaluar fuentes oficiales o proveedores con cobertura y licencia adecuadas. No prometer que un token de cuenta proporciona escucha global.
- Mantener la campaña de tres meses revisable semanalmente, diferenciando evidencia real, temporadas y propuestas editoriales.
