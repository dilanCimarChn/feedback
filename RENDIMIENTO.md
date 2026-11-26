# Rendimiento y precisión del generador

## Límites de ejecución

Los controles viven en [api/_lib/carga.js](api/_lib/carga.js), [api/_lib/comun.js](api/_lib/comun.js) y los conectores de cada proveedor. Son locales a un proceso, no límites globales del despliegue.

| Recurso | Límite implementado |
| --- | --- |
| Llamadas de IA | 8 activas y 100 en espera; hasta 8 segundos de cola |
| Textos y archivos pendientes de IA | Presupuesto aproximado de 32 MiB, calculado sobre caracteres UTF-16 |
| Respuesta de IA | 18 segundos por defecto; las rutas de calendario y alternativas pueden pedir hasta 32 segundos de presupuesto total |
| Espera del cliente | 70 segundos por petición |
| Consultas a fuentes | 12 activas y 100 en espera; hasta 2 segundos de cola |
| Peticiones a proveedores de investigación | Plazos de 10–15 segundos según el conector |
| Cuerpos en el middleware local | 4 MiB; JSON inválido devuelve `400` |

Una cola llena, una espera agotada o un presupuesto de archivos excedido producen un rechazo controlado antes de llamar al proveedor. Las respuestas de saturación incluyen una espera sugerida. El navegador no reintenta automáticamente generaciones costosas.

Un `429` de Gemini activa una pausa por clave dentro del proceso: utiliza `Retry-After` numérico, hasta 300 segundos, o 30 segundos si falta. No dispara llamadas a otros modelos. Una respuesta de servidor saturado admite una alternativa dentro del mismo presupuesto; modelos ausentes o JSON vacío/inválido permiten probar los siguientes candidatos. Errores de permisos, conexión o tiempo agotado se comunican sin una cascada de reintentos.

`GEMINI_MODEL`, si está definido, tiene prioridad. Calendarios y alternativas utilizan el modo rápido con `gemini-3.5-flash-lite` antes de los candidatos comunes. Los niveles de razonamiento se añaden solo a modelos reconocidos; alias y modelos personalizados conservan sus parámetros. Que un modelo figure en el código no acredita acceso, cuota ni disponibilidad real del proyecto.

GDELT comparte un plazo de doce segundos entre la consulta local y su ampliación al país. Después de un `429` respeta `Retry-After`, acotado a 1–300 segundos, o utiliza 60 segundos si falta. La pausa afecta al proceso aunque cambie el tema; no coordina otras instancias. Un rechazo no se sustituye por noticias ficticias.

## Caché y navegador

Las investigaciones iguales comparten el trabajo en curso. Las claves incluyen los filtros pertinentes y una huella de la cuenta y credenciales, sin secretos en claro. RSS comparte consultas por país; YouTube incluye país, tema, filtros y credencial. X no realiza consultas.

Los resultados correctos se conservan hasta quince minutos; las investigaciones con fuentes no disponibles utilizan quince segundos. Las cachés tienen tamaños y trabajos pendientes acotados. Una promesa rechazada se elimina para permitir recuperación. Los planes generados no se reutilizan como caché entre usuarios o marcas.

La interfaz solicita bloques de hasta siete días, sin cruzar meses; los acorta para campañas densas. Guarda cada bloque completado y permite continuar tras fallos conservando el contexto y la división de la campaña. La secuencia de email TSCP se genera solo en el primer bloque.

Los ajustes manuales, el revisor, las tendencias y la configuración se cargan al utilizarse. El calendario agrupa por fecha y el guardado de ediciones se difiere 400 ms, con un intento adicional al ocultar o cerrar la página. Ese respaldo no sustituye un guardado compartido confirmado.

El middleware de desarrollo carga las funciones con el servidor SSR de Vite, también con `--configLoader runner`. Vite conserva su caché e invalida los módulos cuando cambian. Las rutas `/api/` desconocidas devuelven un `404` JSON en lugar del HTML de la aplicación.

## Referencias y horarios

El prompt recibe un catálogo acotado de referencias con IDs, títulos, plataforma y enlaces. Cada pieza puede citar hasta tres; el servidor rechaza IDs inexistentes y conserva los enlaces en el detalle y las exportaciones. Las referencias actuales no justifican como recientes piezas a más de treinta días de la consulta. Sin referencia pertinente, la pieza queda identificada como hipótesis editorial.

Citar una fuente no valida automáticamente el copy ni demuestra eficacia. Pertinencia, afirmaciones, testimonios y resultados requieren revisión editorial. No hay una medición de mejora porcentual de calidad del modelo.

Los horarios utilizan hasta noventa días observables del histórico orgánico, sin anuncios ni registros futuros. Solo se identifica una franja con al menos tres publicaciones de la misma red y día semanal, comunicando la muestra. No acredita personas conectadas, una hora óptima ni causalidad. Frecuencia y KPI son propuestas para probar y revisar.

## Verificación reproducible

```sh
npm test
npm run test:load
npm run build
```

Las pruebas utilizan servicios simulados y no consumen cuota de proveedores reales. Las pruebas de carga incluyen ráfagas de 120 solicitudes en un único proceso:

| Caso | Comportamiento verificado por las pruebas |
| --- | --- |
| Investigaciones idénticas | Comparten una consulta RSS y otra de noticias |
| IA con proveedor simulado de 3 ms | Máximo de ocho llamadas activas, 108 completadas y doce rechazos por cola llena |
| Cola agotada o tarea fallida | Se libera capacidad para nuevas solicitudes |
| Proveedor responde `429` | No hay fallback; se comparte la pausa y la espera sugerida |

También se cubren caché, cambio de credenciales, fallos parciales, referencias inventadas, histórico insuficiente para horarios y continuidad de bloques. Estas pruebas no certifican cien generaciones reales simultáneas ni la calidad comercial de las propuestas.

## Capacidad del despliegue

La interfaz estática y las generaciones costosas tienen cargas distintas. Cuando la duración real supera la espera de cola, algunas peticiones reciben `503`; el usuario conserva sus bloques guardados.

Vercel puede crear varias instancias, cada una con sus contadores y caché. Un límite agregado y trabajos que sobrevivan reinicios requieren una cola duradera y un limitador compartido, que no están provisionados en este repositorio.

Antes de anunciar capacidad real, ejecutar una prueba autorizada en el despliegue con perfiles y tiempos reales: medir latencias p50/p95, errores `429`/`503`, memoria, coste y recuperación. Ajustar concurrencia y duración al hosting y a las cuotas RPM/TPM del proyecto de Gemini. Referencia: [límites de uso de Gemini](https://ai.google.dev/gemini-api/docs/rate-limits).
