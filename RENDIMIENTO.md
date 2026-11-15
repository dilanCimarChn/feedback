# Rendimiento y precisión del generador

## Controles implementados

- **IA por proceso:** hasta 8 llamadas activas y 100 en espera. Una espera superior a 8 segundos o una cola llena devuelve `503` con `Retry-After`. Los textos y archivos pendientes tienen un presupuesto aproximado de 32 MiB de caracteres UTF-16, adicional al límite de solicitudes. El exceso se rechaza antes de llamar al proveedor.
- **Plazos:** cada intento de IA tiene como máximo 18 segundos; el conjunto de intentos dispone de 32 segundos después de salir de la cola. El cliente corta la espera a los 70 segundos. Los proveedores de investigación tienen sus propios plazos de 12–15 segundos. No se reintenta automáticamente desde el navegador una generación costosa.
- **Cuota:** un `429` de Gemini activa una pausa compartida por clave dentro del proceso, respeta `Retry-After` numérico hasta 300 segundos y usa 30 segundos cuando falta. No provoca llamadas sucesivas a otros modelos. Los errores de permisos y servidor tampoco generan una cascada; el fallback se reserva para modelos ausentes o respuestas JSON vacías/inválidas, dentro del plazo total.
- **Fuentes:** máximo 12 consultas externas activas, 100 en espera y 2 segundos de espera de cola. Investigaciones iguales comparten una promesa; Google Trends comparte consultas por país, YouTube por país y credencial, y las redes por cuenta autorizada. X conserva el tema en su clave. Cambiar credenciales o cuenta invalida la clave mediante una huella; las claves no contienen secretos en claro.
- **Caché:** resultados correctos durante 15 minutos; investigaciones con fuentes no disponibles durante 15 segundos. Tamaño y trabajos pendientes acotados; las promesas rechazadas se eliminan para permitir recuperación. No se almacenan planes generados entre usuarios ni se mezclan perfiles de marca.
- **Calendarios:** la UI solicita bloques de hasta 7 días, respetando los límites de mes. Guarda cada bloque completado y permite continuar tras un fallo. La secuencia de emails TSCP se genera únicamente en el primer bloque. Los planes antiguos se conservan, pero no se reanudan con la nueva división.
- **Navegador:** los ajustes manuales, formulario de revisión, tendencias y configuración se cargan cuando se utilizan. El calendario agrupa publicaciones por fecha. El guardado del plan se difiere 400 ms al editar y se intenta completar al ocultar o cerrar la página.
- **Desarrollo:** el middleware limita cuerpos a 4 MiB, responde `400` a JSON inválido y deja de importar un módulo nuevo por cada petición. Recarga el handler cuando cambia su fecha de modificación; cambios en dependencias de `api/_lib` pueden requerir reiniciar Vite.

## Sugerencias comprobables

El prompt recibe un catálogo acotado de referencias, con IDs, títulos, plataforma y enlaces devueltos por las fuentes. Cada pieza puede vincular hasta tres referencias; el servidor rechaza IDs inventados y exporta los enlaces al CSV. Las referencias quedan accesibles en «Por qué esta publicación y qué medir».

Una referencia citada es una observación consultada, no una prueba de efectividad ni una validación automática del texto. Sin referencia vinculada se etiqueta la pieza como hipótesis editorial. Las señales actuales no se vinculan como justificación reciente de piezas a más de 30 días de la consulta. La pertinencia editorial, las afirmaciones del copy, los testimonios y los resultados siguen requiriendo revisión humana; no se ha medido una mejora porcentual de calidad del modelo.

Los horarios usan un resumen de los últimos 90 días observables anteriores al inicio, sin registros pagados ni futuros. Solo se identifica una franja con al menos tres publicaciones de la misma red y día semanal; se comunica la muestra y se evita llamarla una hora óptima. La frecuencia y los KPI siguen siendo propuestas para probar y revisar.

## Verificación reproducible

```sh
npm test
npm run test:load
npm run build
```

Las pruebas no consumen cuota ni envían información a proveedores reales. Se simulan ráfagas de **120 solicitudes** en un único proceso:

| Caso | Resultado esperado |
| --- | --- |
| 120 investigaciones idénticas | Una llamada RSS y una de noticias; las otras lecturas comparten el resultado |
| 120 solicitudes de IA, proveedor simulado con 3 ms de demora | Pico de 8 llamadas externas, 108 completadas y 12 rechazos controlados por cola llena |
| Cola con plazo agotado o una tarea fallida | Se libera capacidad; solicitudes posteriores pueden completarse |
| Proveedor responde 429 | Una llamada, pausa compartida y respuesta con espera sugerida |

También se prueban vencimiento/evicción de caché, cambio de credenciales, fallos parciales, fuentes inventadas, histórico no válido para recomendar horarios, continuidad de bloques y un único modal de acceso para solicitudes simultáneas.

## Alcance para 100 o más usuarios reales

**Esta prueba no certifica 100 generaciones de IA simultáneas en producción.** La aplicación puede servir la UI estática a muchos usuarios, mientras las generaciones costosas se admiten con límites. Cuando las llamadas reales tardan más que el plazo de cola, parte de las solicitudes recibe `503` y debe reintentarse; los bloques ya guardados se conservan.

Los límites y la caché son locales a una instancia. Vercel puede crear varias instancias, cada una con sus propios contadores. Para garantizar un límite agregado y conservar trabajos a través de reinicios hace falta una cola duradera y un limitador compartido, con almacenamiento y credenciales del despliegue. Eso no está provisionado en este repositorio.

Antes de anunciar capacidad real, ejecutar una prueba autorizada contra el despliegue con perfiles distintos y tiempos reales de generación; medir latencias p50/p95, porcentaje de `429`/`503`, memoria, coste y recuperación. Ajustar el número de workers a los límites RPM/TPM del proyecto de Gemini y verificar concurrencia y duración del hosting. Las cuotas son por proyecto y nivel de uso: [documentación oficial de Gemini](https://ai.google.dev/gemini-api/docs/rate-limits).
