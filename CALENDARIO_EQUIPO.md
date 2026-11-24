# Campañas compartidas del equipo

Las campañas, referencias manuales y hallazgos del radar se comparten mediante `/api/campanas`. El navegador conserva un respaldo del borrador. Aprobar una pieza registra una decisión dentro del calendario; no publica contenido en redes.

## Uso

1. Genera una campaña o abre una desde **Campañas compartidas del equipo**. Períodos, estrategia y fuentes se explican en [MARKETING.md](MARKETING.md).
2. Selecciona una pieza para editar fecha, hora, plataforma, formato, objetivo, público, concepto, guion, copy, CTA, brief de diseño y KPI. Editar el contenido devuelve la pieza a **borrador**.
3. Usa **Enviar a revisión**, **Aprobar** o **Descartar** y guarda los cambios. El equipo acuerda quién revisa y aprueba: no hay roles individuales en la aplicación.
4. **Generar alternativa** guarda primero la campaña y presenta una propuesta sin sustituir la pieza. **Aplicar alternativa** conserva una versión anterior recuperable y devuelve la pieza a borrador. Si cambió durante la espera, la alternativa no se aplica sobre esos cambios.
5. Antes de generar otra campaña o abrir una distinta, guarda los cambios o conserva una copia. Actualiza la lista para abrir lo guardado desde otra computadora.

La generación conserva cada bloque completado e intenta compartir el avance al finalizar, detenerse o fallar. **Continuar bloques pendientes** utiliza las preferencias y marca guardadas con la campaña. No hay ejecución programada con la aplicación cerrada.

## Configuración del servidor

| Variable | Uso |
| --- | --- |
| `EQUIPO_CODIGO_ACCESO` | Código para leer o guardar el espacio del equipo |
| `APP_ACCESS_CODE` | Alternativa si no se define un código específico de equipo; también protege las funciones que utilizan este código |
| `BLOB_READ_WRITE_TOKEN` | Acceso al almacén Vercel Blob privado |
| `BLOB_STORE_ID` y `VERCEL_OIDC_TOKEN` | Alternativa al token mediante identidad OIDC de Vercel |

Sin código de equipo ni su alternativa, las campañas compartidas responden `503`. El código del equipo y `APP_ACCESS_CODE` pueden ser distintos. No son contraseñas de Vercel ni tokens de las redes; el administrador debe distribuirlos solo al equipo. Las credenciales van en el servidor, sin prefijo `VITE_`.

La implementación está en [api/campanas.js](api/campanas.js) y [api/_lib/campanas-equipo.js](api/_lib/campanas-equipo.js). El documento privado utiliza la ruta `feedback/equipo-v1.json` y no se sirve como archivo público. La cuota y facturación dependen del almacén contratado; revisar las [condiciones de Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing).

Durante desarrollo independiente, con `NODE_ENV=development`, sin `VERCEL` y sin Blob configurado, se utiliza `.data.local/equipo-v1.json`. Ese directorio queda excluido de Git y del servidor de archivos de Vite. En `dev:produccion` se utiliza el almacén del servidor remoto, con datos reales.

## Revisiones y conflictos

Cada campaña tiene una revisión. Las escrituras comprueban también el ETag del documento privado. Cambios simultáneos en campañas distintas se combinan mediante relectura; una revisión antigua de la misma campaña devuelve `409` sin sobrescribir la versión compartida. La edición local se conserva y puede guardarse como otra campaña.

Un fallo de almacenamiento no convierte el respaldo del navegador en guardado compartido: la interfaz comunica que falta compartir cambios. El espacio corresponde a un equipo de esta instalación; no hay cuentas individuales, permisos por miembro, bitácora completa ni aislamiento entre organizaciones.

## Límites

| Recurso | Límite de la implementación |
| --- | ---: |
| Campañas del equipo | 30 |
| Publicaciones por campaña guardada | 800 |
| Referencias manuales | 100 |
| Hallazgos guardados | 200 |
| JSON por campaña | 2.500.000 caracteres |
| JSON del espacio compartido | 10.000.000 caracteres |

La generación general admite hasta 366 publicaciones; el almacenamiento permite más para conservar campañas con cadencia TSCP. Los límites de JSON se calculan por longitud de texto, no por bytes exactos. Al guardar se omiten piezas duplicadas dentro de bloques y resultados derivados del radar, conservando fuentes y estados. CSV y JSON permiten exportar el trabajo. No hay eliminación automática de campañas.

## Fuentes y verificación

Las campañas conservan sus fuentes y fecha de consulta. Una alternativa usa esas observaciones guardadas sin afirmar que una tendencia anterior siga vigente. Editar plataforma o hashtags elimina atribuciones observadas que puedan haber quedado desactualizadas. Los enlaces manuales no se descargan ni se raspan. Alcance y permisos en [REDES_SOCIALES.md](REDES_SOCIALES.md) y [CONFIGURAR_REDES.md](CONFIGURAR_REDES.md).

`npm test` cubre revisiones, guardados simultáneos, conflictos, estados y alternativas con servicios simulados. `npm run build` verifica la compilación. Para comprobar una instalación real, utilizar una campaña identificada como prueba y verificar guardado, apertura desde otro navegador y rechazo de una revisión antigua. Las pruebas locales no acreditan la configuración actual del despliegue.
