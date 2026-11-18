# Calendarios compartidos de marketing

Actualizado: 17 de noviembre de 2026.

## Uso

1. En **Fuentes y tendencias**, consultar un tema y país. Las opciones permiten ciudad, 1–30 días, idioma y hasta dos hashtags o cuentas profesionales de Instagram. Filtrar después por tema, categoría, plataforma y fechas.
2. Seleccionar **Usar como referencia del calendario**. El enlace se conserva con la campaña, hasta cinco referencias. Los enlaces aportados por el equipo se identifican como tales; no acreditan crecimiento o aprobación del proveedor.
3. En **Estrategia y calendario**, basta una frase sobre la marca, duración y país. El perfil guardado aporta público y tono. Objetivo, productos, público específico, plataformas, frecuencia, fechas importantes, presupuesto y tono son opcionales.
4. Elegir desde un día hasta un año, hasta 366 publicaciones. Se recomiendan tres meses, con revisión semanal. Una frecuencia alta se limita a la capacidad del período y al máximo de la campaña. TSCP mantiene su cadencia particular.
5. Seleccionar una pieza del calendario para editar fecha, hora, plataforma, formato, objetivo, público, concepto, guion, copy, CTA, brief de diseño y KPI. Cambiar el contenido devuelve la pieza a **borrador**.
6. Usar **Enviar a revisión**, **Aprobar** o **Descartar**. Son estados del calendario; no publican en redes. Guardar los cambios para compartirlos con el equipo.
7. **Generar alternativa** guarda primero la versión actual y presenta una propuesta sin reemplazarla. **Aplicar alternativa** conserva una versión anterior recuperable. Si la pieza cambió durante la espera, no se aplica la alternativa sobre esos cambios.
8. En **Campañas compartidas del equipo**, actualizar la lista y abrir un calendario desde otra computadora. Antes de abrir otro se guardan los cambios o una copia. Antes de generar una nueva campaña se conserva la actual en el equipo.

La generación se divide en bloques. Se conserva el avance local durante el proceso y se intenta compartir al finalizar, detenerse o fallar. **Continuar bloques pendientes** reutiliza las preferencias y marca guardadas con la campaña, incluidas sus piezas editadas. Mantener abierta la aplicación mientras genera; no hay trabajo programado en segundo plano.

## Almacenamiento y acceso

El repositorio anterior usaba únicamente `localStorage`; no tenía base de datos. Se añadió **Vercel Blob privado**, almacén `feedback-equipo`, vinculado al proyecto `dilancimarchn-5758/feedback`. No se contrató un proveedor de pago.

- Backend: `api/campanas.js` y `api/_lib/campanas-equipo.js`.
- Documento privado: `feedback/equipo-v1.json`, nunca servido al navegador como archivo público.
- Configuración: `BLOB_READ_WRITE_TOKEN`, creada por la integración en Production, y `EQUIPO_CODIGO_ACCESO`.
- Alternativa oficial para almacenamiento: `BLOB_STORE_ID` más la identidad OIDC de Vercel. No poner tokens en variables `VITE_`.
- El código del equipo se configuró en Production y quedó en el `.env` local excluido de Git. El administrador lo comparte únicamente con el equipo; el modal lo solicita al leer o guardar campañas. No debe confundirse con una contraseña de Vercel ni con tokens sociales.
- `APP_ACCESS_CODE`, si existe, protege también las funciones anteriores. Las campañas admiten `EQUIPO_CODIGO_ACCESO` separado; sin este se usa `APP_ACCESS_CODE` como alternativa.
- Un solo espacio de equipo para esta instalación; no hay cuentas individuales, roles por miembro, bitácora completa ni aislamiento entre organizaciones.
- `localStorage` continúa como respaldo del borrador, no como único almacenamiento compartido. Si falla la nube, la interfaz conserva los cambios y comunica que falta compartirlos.

Cada campaña tiene una revisión. Las escrituras usan el ETag del documento privado y una condición de coincidencia: cambios simultáneos de campañas diferentes se fusionan con relectura; cambios de la misma revisión devuelven **409**, sin sobrescribir la versión guardada. Si la lectura comprimida devuelve un ETag débil, se compara con metadata y se utiliza el ETag fuerte, sin asociar contenido antiguo a una versión nueva. El equipo puede conservar su edición como otra campaña.

Límites de esta versión: 30 campañas, 100 referencias manuales, 2,5 MB de JSON por campaña y 10 MB para el documento del equipo. Se omiten las piezas duplicadas dentro de bloques y los resultados de radar derivados, conservando las fuentes originales y sus estados. CSV y JSON permiten exportar el trabajo. No se eliminan campañas automáticamente.

Hobby ofrece almacenamiento gratuito sujeto a sus límites; al agotarlos se puede bloquear el servicio. No se configuraron ampliaciones ni compras automáticas. Consultar las [cuotas vigentes de Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing).

## Fuentes y límites

Las propuestas conservan sus fuentes, fecha de consulta y fundamento. Las vistas y likes son conteos acumulados; los horarios se describen como pruebas salvo muestras suficientes del histórico propio. El presupuesto no activa compras ni campañas publicitarias. Las referencias manuales no se descargan ni se raspan.

El radar no mantiene un histórico continuo de crecimiento. La caché de proveedores es temporal; una campaña compartida conserva las observaciones usadas al generarse. Regenerar una pieza utiliza esas fuentes guardadas y no afirma que una tendencia antigua siga vigente.

Configurar conectores y permisos en [CONFIGURAR_REDES.md](CONFIGURAR_REDES.md). Alcance de cada fuente en [REDES_SOCIALES.md](REDES_SOCIALES.md).

## Verificación

`npm test` cubre búsqueda temática, conectores con permisos rechazados, datos parciales, normalización, agendas, revisiones, guardados simultáneos y regeneración sin escritura. `npm run build` verifica la compilación.

Chrome con datos de prueba aislados comprobó generación, edición, aprobación, guardado, apertura del calendario compartido, alternativa, recuperación del texto anterior, selección desde el radar y vista móvil de 390 px. Los datos simulados se usan únicamente en la prueba, fuera del producto y del despliegue.

La comprobación real del 17 de noviembre en Vercel confirmó lectura de Google Trends y diez videos temáticos de YouTube. GDELT agotó la espera; Instagram rechazó el token o lo consideró vencido. Facebook y TikTok externos no tenían sus credenciales específicas. Un calendario técnico manual, identificado como prueba y sin publicación, permitió verificar creación, actualización a revisión 2 y rechazo 409 de una edición antigua en el almacenamiento real. Gemini respondió 503 en las primeras comprobaciones; se añadió una única alternativa ante saturación, sin reintentar cuotas 429 ni aumentar el presupuesto total de tiempo.

Los calendarios y sus alternativas priorizan `gemini-3.5-flash-lite` con razonamiento mínimo compatible. La prueba mínima real respondió en unos 1,5 segundos; no es una garantía para calendarios completos. `GEMINI_MODEL`, si está configurado explícitamente, conserva prioridad. La revisión de marca mantiene la selección anterior. Los modelos conocidos usan niveles compatibles; los alias y modelos personalizados conservan sus parámetros originales. Google documenta un [nivel gratuito para Flash-Lite](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite), sujeto a las cuotas y al nivel efectivo de facturación del proyecto. No se activó facturación ni se contrataron ampliaciones.

La generación real de una publicación completa con Flash-Lite pasó las validaciones del servidor en aproximadamente 13,6 segundos, incluida la consulta de fuentes. Las etiquetas regeneradas recalculan su procedencia; editar plataforma o etiquetas elimina las atribuciones observadas que podrían haber quedado desactualizadas.

La comprobación posterior en **Production** respondió **200** al generar una publicación, guardar y volver a abrir la campaña, y pedir una alternativa. La alternativa devolvió `guardada: false`; una nueva lectura confirmó que la publicación y la revisión guardadas no habían cambiado. La edición con una revisión antigua devolvió **409**. Se conservó un único calendario privado identificado como **Prueba técnica · conexión del equipo**, sin publicación en redes. Pasaron **73 pruebas** y la compilación; Chrome verificó edición, aprobación, recuperación, apertura sin borrador local, radar y vista móvil.

Se actualizó Vite dentro de su versión mayor y la dependencia OIDC de Blob. Queda un aviso de auditoría de desarrollo para `picomatch` 4.0.7 y sus dependientes: el registro no ofrecía una versión corregida al verificar. Las dependencias de producción quedaron sin avisos conocidos de esa auditoría.
