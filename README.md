# Agente de Feedback

Agente para configurar campañas TSCP, comparar referentes y preparar una guía de trabajo con Google Gemini. La pantalla principal sigue los pasos 0 y 1 acordados con marketing y ofrece un cronograma orientativo sin copys finales. El workflow del paso 2 queda pendiente de sus aclaraciones. La aplicación no publica en redes ni envía correos.

## Funciones

- **Marca:** propone colores, tipografías, tono e instrucciones a partir de ejemplos, una descripción o un manual PDF. El perfil queda editable y se puede exportar o importar como JSON.
- **Revisión:** analiza copy e imágenes frente al perfil de marca y devuelve un puntaje y observaciones por severidad. Admite un post, un carrusel de hasta ocho láminas o una portada de Reel.
- **Campaña y diagnóstico:** objetivo para voluntarios o empresas, inicio, duración y canales. Reutiliza la marca y permite ajustar misión, vocabulario y lenguaje por plataforma dentro de opciones desplegables.
- **Referentes:** localiza los perfiles iniciales mediante enlaces contrastados en sitios oficiales y propone alternativas identificadas. Separa perfiles y métricas. Las APIs disponibles aportan referencias temáticas para las sugerencias, conservando origen y límites ante fallos parciales.
- **Guía orientativa:** comparación de contenido y CTA, segmentos, mensaje estratégico y variantes, fechas y estructuras sugeridas. Incluye ejemplos de copy, hashtags e ideas por canal para revisar con marketing. Se descarga en JSON o Markdown.
- **Conexiones y APIs:** consulta las variables presentes y faltantes del backend utilizado, con enlaces a la documentación. No devuelve credenciales ni confunde configuración con acceso comprobado.
- **Fuentes y tendencias:** conserva enlaces, fechas y límites de las fuentes disponibles. La cobertura depende de permisos y disponibilidad de cada proveedor.
- **Compatibilidad con campañas anteriores:** conserva las APIs de almacenamiento, revisión y generación de alternativas, con control de revisiones y respaldo local.

| Guía | Contenido |
| --- | --- |
| [MARKETING.md](MARKETING.md) | Pasos 0 y 1, cronograma orientativo y pendientes de marketing |
| [REDES_SOCIALES.md](REDES_SOCIALES.md) | Alcance del radar y lectura de cuentas propias |
| [CONFIGURAR_REDES.md](CONFIGURAR_REDES.md) | Variables, permisos y comprobación de conexiones |
| [CALENDARIO_EQUIPO.md](CALENDARIO_EQUIPO.md) | Almacenamiento, acceso y colaboración |
| [RENDIMIENTO.md](RENDIMIENTO.md) | Límites, tiempos de espera y pruebas de carga |

## Desarrollo local

Requiere Node.js y npm. Instala las dependencias:

```sh
npm install
```

Crea `.env` o `.env.local` a partir de [.env.example](.env.example). Para generar y revisar contenido configura `GEMINI_API_KEY`; `APP_ACCESS_CODE` permite exigir un código de acceso. Las fuentes sociales son opcionales. Para compartir campañas, consulta [CALENDARIO_EQUIPO.md](CALENDARIO_EQUIPO.md).

| Comando | Entorno de las APIs |
| --- | --- |
| `npm run dev:local` | Backend local con las variables de este equipo |
| `npm run dev:produccion` | Backend publicado en `https://feedback-sigma-one.vercel.app` |
| `npm run dev` | Backend local, salvo que se defina `API_REMOTA_DESARROLLO` |

El modo conectado a producción reenvía `/api` desde Vite sin copiar secretos. Consume cuotas reales y lee o modifica las campañas compartidas de ese servidor. Localhost y el dominio público no comparten el perfil ni el borrador del navegador: cada origen tiene su propio `localStorage`.

Para configurar otro backend de desarrollo, define `API_REMOTA_DESARROLLO` con un origen HTTPS sin credenciales, rutas ni parámetros. El proxy funciona solo durante desarrollo. Los cambios locales del backend requieren desplegarse antes de que el modo conectado pueda utilizarlos.

Las credenciales permanecen en el servidor: no usar el prefijo `VITE_` ni incorporar archivos `.env` a Git. Reinicia Vite después de cambiar la configuración.

## Arquitectura y despliegue

El cliente utiliza React 19 y Vite. Las rutas de `api/` funcionan como Vercel Serverless Functions; Vite incorpora un middleware para ejecutarlas durante desarrollo. Gemini se consulta desde el servidor. Las imágenes se comprimen en el navegador antes de enviarse.

Para desplegar en Vercel, configura las variables del entorno correspondiente y compila con `npm run build`. Vuelve a desplegar después de cambiar variables o código del backend. La presencia de configuración en el repositorio no acredita los permisos ni la disponibilidad actual del despliegue.

## Privacidad y almacenamiento

El perfil de marca, las miniaturas, preferencias, métricas importadas y borradores se guardan en el navegador. La configuración, referentes y diagnóstico TSCP se conservan localmente y se pueden exportar para compartir. Los datos necesarios para analizar la marca, preparar el diagnóstico o revisar una pieza se envían a Gemini. Las campañas anteriores, referencias y hallazgos compartidos mantienen su almacenamiento privado; en desarrollo independiente puede utilizarse un archivo local.

Las páginas públicas `/privacidad` y `/eliminacion-de-datos` se compilan desde [privacidad.html](privacidad.html) y [eliminacion-de-datos.html](eliminacion-de-datos.html), con rutas definidas en [vercel.json](vercel.json). No necesitan JavaScript ni código de acceso. La segunda contiene instrucciones para solicitar la eliminación, no un callback automático de borrado. No hay borrado automático de campañas ni plazos de retención configurados. Mantén esas páginas al día cuando cambie el tratamiento de datos.

## Límites y comprobación

La revisión visual estima colores y medidas; no mide píxeles de forma exacta. En Reels analiza una portada o captura, no el video completo. El manual PDF admite hasta 2 MiB y el middleware local limita las solicitudes a 4 MiB; el hosting puede imponer otros límites.

Los calendarios y horarios son propuestas. Las fuentes no garantizan visibilidad, crecimiento ni conversiones. X está excluida de las consultas; TikTok permanece pendiente en el radar. Consulta [REDES_SOCIALES.md](REDES_SOCIALES.md) antes de atribuir cobertura a una plataforma.

```sh
npm test
npm run test:load
npm run build
npm run preview -- --host 127.0.0.1
```

Las pruebas usan proveedores simulados: verifican el código, sin acreditar permisos ni calidad editorial en producción. `preview` sirve la compilación del cliente y permite comprobar las páginas públicas, enlaces y vista móvil; no ejecuta las funciones de `api/`. Para comprobar conexiones reales utiliza un backend configurado.
