// Pautas técnicas por formato. Las medidas se expresan sobre el lienzo nativo
// y en porcentaje, porque las imágenes llegan redimensionadas.
export const FORMATOS = {
  post: {
    nombre: 'Post de Feed (1:1 / 4:5, lienzo 1080x1080 o 1080x1350)',
    zona_seguridad:
      'Margen de seguridad de ~24px (≈2-3% del ancho) en todos los bordes; ningún texto ni logo cortado o pegado al borde.',
    requisito_copy: 'Copy conciso con un llamado a la acción claro hacia el objetivo de la publicación.'
  },
  reel: {
    nombre: 'Reel / Video Vertical (9:16, lienzo 1080x1920)',
    zona_seguridad:
      'Dejar libres los 220px inferiores (≈12% inferior, donde la app muestra descripción, usuario y audio) y los 120px del lateral derecho (≈11% derecho, botones de like, comentar y compartir). Ningún logo, título ni texto esencial puede invadir esas zonas.',
    requisito_copy: 'Copy dinámico y ágil pensado para video, sin párrafos pesados.'
  },
  carrusel: {
    nombre: 'Carrusel Multipágina (1:1 / 4:5)',
    zona_seguridad:
      'Portada con gancho visual claro y margen de ~24px (≈2-3%). Las láminas deben verse como una serie coherente (mismos colores, tipografías y diagramación).',
    requisito_copy:
      "El copy debe incluir una llamada a la acción explícita para deslizar o guardar (ej: 'Desliza para ver más', 'Guarda este post')."
  }
};

export const CATEGORIAS = {
  margenes: 'márgenes, zonas seguras y diagramación',
  colores: 'colores de la marca',
  contexto: 'mensaje, tono de voz y llamado a la acción',
  tipografia: 'tipografías y legibilidad',
  gramatica: 'ortografía y redacción'
};
