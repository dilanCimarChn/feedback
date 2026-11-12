// Fuente: «Flujo de trabajo para las campañas de marketing y IT de TSCP», aportado por marketing.
export const TSCP = {
  objetivo: 'Captar ONGs hacia el marketplace de TSCP; redes como campaña principal y email como apoyo a voluntarios que presentan TSCP a sus organizaciones.',
  descripcion: 'The Supply Chain Project conecta recursos excedentes y capacidad logística con necesidades humanas mediante un marketplace de apoyo logístico, tecnológico, capacitación y consultoría para ONGs.',
  segmentos: ['Operadores de primera línea', 'ONGs pequeñas / grassroots', 'ONGs establecidas', 'Redes y coaliciones'],
  pilares: ['Discover the Platform', 'Success Stories', 'Why Join', 'Behind the Project', 'Join Now'],
  ctas: ['Learn more', 'Request info', 'Book intro meeting', 'Register now'],
  pendiente: 'Validar testimonios, resultados, socios, precios y elegibilidad antes de publicar. El documento menciona gratuidad para empezar: no afirmarla sin confirmación. No inventar enlaces de reuniones ni permisos. Confirmar responsable de publicación y aprobación en la entrega.',
};

export function agendaTscp(inicio, fin, origen = inicio) {
  const cadencia = {1:['Instagram','LinkedIn'],2:['Facebook','TikTok'],3:['Instagram'],4:['LinkedIn'],5:['Instagram','Facebook'],6:['TikTok']};
  const filas=[];
  for(let t=Date.parse(inicio);t<=Date.parse(fin);t+=86400000){
    const fecha=new Date(t).toISOString().slice(0,10);
    const mes=(new Date(t).getUTCFullYear()-Number(origen.slice(0,4)))*12+new Date(t).getUTCMonth()-Number(origen.slice(5,7))+2;
    for(const red of cadencia[new Date(t).getUTCDay()]||[]) filas.push({fecha,red,proposito:mes<=1?'Awareness':mes===2?'Consideration':'Conversion',campana:'NGO Acquisition – Social'});
  }
  return filas;
}

export function enlacesTscp(cta, red, id) {
  const base = cta==='Register now'?'https://app.thesupplychainproject.org/':cta==='Learn more'?'https://thesupplychainproject.org/how-it-works.html':null;
  if(!base)return 'Pendiente: confirmar enlace de información o reunión con TSCP';
  const u=new URL(base);
  for(const [k,v] of Object.entries({utm_source:red.toLowerCase(),utm_medium:red==='Email'?'email':'social',utm_campaign:'ngo_acquisition',utm_content:id}))u.searchParams.set(k,v);
  return u.toString();
}

export const SECUENCIA_EMAIL = [
  [0,'What you do matters','Primer contacto'],
  [3,'Less bureaucracy, more real impact','Solo si no hubo clic ni respuesta'],
  [7,'Much more than just connections','Solo si no hubo respuesta; refuerzo por LinkedIn/Instagram'],
  [13,'Maybe one small step is all it takes','Solo si no hubo acción'],
  [20,'Before we say goodbye…','Cierre: registro, newsletter mensual o baja; terminar el ciclo'],
];
