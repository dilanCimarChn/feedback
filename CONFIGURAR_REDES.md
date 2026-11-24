# Configuración de redes sociales

Esta guía corresponde a los conectores del repositorio. Los requisitos y condiciones de los proveedores pueden cambiar; comprueba sus referencias oficiales al configurar. El alcance de cada fuente está en [REDES_SOCIALES.md](REDES_SOCIALES.md).

## Preparación y variables

1. Utiliza cuentas y aplicaciones controladas por la organización. Ser desarrollador de la app no concede acceso a sus cuentas sociales.
2. Registra propietario, ID de aplicación, permisos, vencimiento y responsable de renovación en un registro interno sin secretos versionados.
3. Prepara dominio, política de privacidad y retorno HTTPS cuando corresponda. El repositorio no implementa el callback OAuth ni la renovación automática de tokens.
4. Configura solo las fuentes necesarias. No hace falta conectar todas las redes para generar una campaña.

Los nombres están en [.env.example](.env.example). En local utiliza `.env` o `.env.local` sin sobrescribir valores existentes y reinicia Vite tras cambiarlos. En Vercel utiliza **Settings → Environment Variables**, selecciona el entorno y vuelve a desplegar.

Las credenciales son exclusivas del servidor: nunca usar `VITE_`, incluir tokens en URLs compartidas o subir archivos `.env` a Git. Para trabajar contra las APIs publicadas sin copiar sus secretos, utiliza `npm run dev:produccion`; consume cuotas y utiliza datos reales del servidor. Para un backend independiente, `npm run dev:local`.

Las cuotas, facturación y aprobaciones dependen del proveedor y del proyecto. El código no compra créditos ni amplía cuotas automáticamente. X está excluida de consultas. Google Trends y GDELT no necesitan tokens sociales en esta implementación; siguen sujetos a condiciones y disponibilidad externas.

## YouTube

1. Crea o elige un proyecto en [Google Cloud Console](https://console.cloud.google.com/) y habilita **YouTube Data API v3**.
2. En **APIs y servicios → Credenciales**, crea una clave y restríngela a esa API. Las restricciones deben admitir llamadas del servidor; una restricción exclusiva por referente web no corresponde a este conector.
3. Guarda `YOUTUBE_API_KEY` y consulta un tema y país desde **Fuentes y tendencias**. No se necesita OAuth para estas lecturas públicas.
4. Revisa en Google Cloud las cuotas asignadas, consumo y horario de reinicio. No presupongas una asignación a partir de un ejemplo de documentación.

Una consulta temática sin caché utiliza como máximo una búsqueda y una consulta de detalles, sin paginación. Admite 1–30 días, orden e ID público de canal; sin tema ni canal usa la selección popular. Los datos no acreditan ubicación ni horas de actividad de espectadores.

Referencias: [autorización](https://developers.google.com/youtube/data/guides/authentication), [búsqueda](https://developers.google.com/youtube/data/reference/rest/v3/search/list), [detalles](https://developers.google.com/youtube/data/reference/rest/v3/videos/list), [cuotas](https://developers.google.com/youtube/data/determine_quota_cost).

## Facebook e Instagram

El adaptador utiliza Graph API con Facebook Login, no Instagram Login independiente. No mezcles tokens de ambos productos.

1. Crea una aplicación en [Meta for Developers](https://developers.facebook.com/apps/) con el caso de uso adecuado.
2. Comprueba que quien autoriza administra la página. Para Instagram, utiliza una cuenta profesional vinculada a la página en el flujo compatible con Facebook Login.
3. Revisa los productos y permisos aplicables: `pages_show_list` para enumerar páginas, `pages_read_engagement` para lectura y `instagram_basic` para la cuenta profesional, según el flujo y los roles. Completa App Review o verificación empresarial cuando Meta los exija.
4. En desarrollo utiliza cuentas con rol autorizado en la app. Un token de prueba no acredita acceso para terceros en producción.
5. En [Graph API Explorer](https://developers.facebook.com/tools/explorer/), comprueba permisos con `GET /me/accounts?fields=id,name,access_token,instagram_business_account`. La respuesta puede contener secretos: no la compartas ni la guardes en Git.
6. Configura `FACEBOOK_PAGE_ID` y `FACEBOOK_PAGE_ACCESS_TOKEN` para la página autorizada.
7. Configura `INSTAGRAM_USER_ID` con el ID numérico de la cuenta profesional y `INSTAGRAM_ACCESS_TOKEN` con un token compatible; no uses el nombre de usuario como ID.
8. Define `META_GRAPH_VERSION` con una versión soportada y probada, en formato `vNN.N`. No copies ese marcador como valor.
9. Comprueba vencimiento y renovación según el tipo de token. La aplicación no los renueva.

### Descubrimiento de Instagram

Hashtag Search requiere los permisos aplicables y **Instagram Public Content Access** aprobado. El flujo consulta `ig_hashtag_search` y después `top_media`, hasta tres publicaciones por hashtag; no llama a `recent_media`. Si Meta rechaza caption con código 100, se intenta una sola vez conservar únicamente IDs y enlaces.

`INSTAGRAM_DISCOVERY_HASHTAGS` permite hasta dos etiquetas separadas por coma, sin URLs. La interfaz admite una etiqueta con o sin `#`. Sin selección se propone una a partir del tema. El control local limita a 30 hashtags únicos en siete días por cuenta, pero no sustituye la cuota global de Meta entre instancias o aplicaciones.

Para Business Discovery configura opcionalmente `INSTAGRAM_DISCOVERY_ACCOUNTS` con hasta dos usuarios profesionales compatibles separados por coma, sin `@` ni URL. `INSTAGRAM_CUENTAS_REFERENCIA` se acepta como alternativa. Revisa `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement` y los requisitos del producto y roles aprobados.

La lectura propia puede funcionar aunque el descubrimiento externo sea rechazado. Ninguna de estas consultas ofrece actividad de seguidores ni filtro geográfico de su audiencia.

### Páginas externas de Facebook

Configura `FACEBOOK_DISCOVERY_PAGE_IDS` con hasta tres IDs de referencia separados por coma y `FACEBOOK_PUBLIC_ACCESS_TOKEN` con acceso público aprobado para el uso solicitado; se utiliza también `META_GRAPH_VERSION`. Revisa la función o producto correspondiente, como Page Public Content Access.

Se excluye el ID de la página propia y no se reutiliza su token como sustituto. Configuración ausente, rechazo o falta de publicaciones válidas mantienen el estado pendiente. El equipo puede aportar enlaces manuales para revisar.

Referencias: [Pages](https://developers.facebook.com/docs/pages-api/getting-started/), [Instagram con Facebook Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started), [tokens de página](https://developers.facebook.com/docs/pages-api/getting-started/page-access-tokens/), [Hashtag Search](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search), [Business Discovery](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery), [Page Public Content Access](https://developers.facebook.com/docs/features-reference/page-public-content-access/).

## TikTok

Para lectura de la cuenta propia:

1. Registra una aplicación en [TikTok for Developers](https://developers.tiktok.com/) y solicita Login Kit y Display API.
2. Configura la URL de retorno e implementa el flujo oficial de autorización fuera de esta aplicación. Revisa `user.info.basic` y `video.list`; el lector de videos utiliza `video.list`.
3. Intercambia el código por un token en un backend o herramienta segura y guarda `TIKTOK_ACCESS_TOKEN`. Client Key y Client Secret no sustituyen ese token.
4. Prueba con una cuenta con videos públicos y conserva de forma segura la información necesaria para renovar. El repositorio no almacena refresh tokens ni los renueva.

El adaptador separado de Discovery requiere `TIKTOK_DISCOVERY_ACCESS_TOKEN`, `TIKTOK_DISCOVERY_BUSINESS_ID` —el `open_id` autorizado—, `discovery.search.words` y la aprobación correspondiente. No reutilices el token de Display API ni el ID del anunciante. Ese adaptador no está conectado al radar: añadir variables no lo activa. Creative Center sigue siendo una consulta manual sin scraping.

Referencias: [Display API](https://developers.tiktok.com/docs/en/display-api-get-started), [Discovery](https://business-api.tiktok.com/portal/docs?id=1832798345014338), [Creative Center](https://ads.tiktok.com/business/creativecenter/).

## LinkedIn

1. Crea una app en [LinkedIn Developers](https://www.linkedin.com/developers/apps) asociada a la página de la organización.
2. Solicita el producto Community Management que habilite la lectura. El inicio de sesión básico o una suscripción Premium no sustituyen la autorización API.
3. Configura OAuth y el retorno con los permisos aprobados. Revisa `r_organization_social` y que quien autoriza tenga un rol de página permitido.
4. Completa consentimiento e intercambio de código por token; guarda `LINKEDIN_ACCESS_TOKEN`. El [Token Generator oficial](https://learn.microsoft.com/en-us/linkedin/shared/authentication/developer-portal-tools) puede servir para pruebas con una app aprobada, sin resolver el callback o renovación de la aplicación.
5. Guarda en `LINKEDIN_ORGANIZATION_ID` solo el ID numérico, no URL, slug o URN.
6. Define `LINKEDIN_VERSION` con una versión soportada en formato `AAAAMM`; no uses el mes del sistema sin verificar soporte.

El lector utiliza `X-Restli-Protocol-Version: 2.0.0` y consulta posts de la organización. No importa rendimiento ni descubrimiento competitivo. Referencia: [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api).

## X

Las consultas están excluidas incluso si existe `X_BEARER_TOKEN`. Deja esa variable vacía en configuraciones nuevas. Planificar textos para X no requiere conexión ni acredita tendencias de esa red. Habilitar consultas exigiría modificar la exclusión y revisar sus [condiciones de uso y precios](https://docs.x.com/x-api/getting-started/pricing).

## Comprobación de conexiones

1. Consulta mercado y tema en **Fuentes y tendencias** para fuentes externas. La lectura propia se comprueba por separado en `/api/metricas-propias`.
2. **Sin configurar** indica variables faltantes. **Consultada** requiere resultados: revisa enlaces, cuenta y fechas, no solo el código HTTP global.
3. **Sin resultados** no demuestra cobertura ni todos los permisos correctos. **No disponible** exige revisar token, permisos, cuota, versión y proveedor.
4. Facebook externo conserva un estado específico pendiente y TikTok permanece pendiente en el radar. No deben interpretarse como conexiones verificadas.
5. La caché correcta dura hasta quince minutos; cambiar credenciales modifica su clave. Reiniciar el proceso local elimina su caché, sin afectar las cuotas del proveedor.
6. Registra fecha, entorno, fuente, cuenta identificada sin secretos, estado y cantidad de elementos antes de declarar verificada una conexión.

`npm run comprobar:descubrimiento` ejecuta consultas reales desde el backend local y muestra presencia de variables, estados y una selección de enlaces, sin imprimir valores de credenciales. No acredita por sí solo producción. `npm test` usa respuestas simuladas y no acredita vigencia, permisos o disponibilidad de las cuentas.

El almacenamiento compartido y sus variables se configuran en [CALENDARIO_EQUIPO.md](CALENDARIO_EQUIPO.md). No hay publicación, envío de correos, CRM, escucha global ni importación automática de Insights de audiencia.
