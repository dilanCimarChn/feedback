import {cargarEntornoLocal} from '../api/_lib/entorno.js';
import {consultarInstagramExterno} from '../api/_lib/instagram-descubrimiento.js';
import {obtenerSenales} from '../api/_lib/senales-sociales.js';
import {consultarFacebookExterno} from '../api/_lib/descubrimiento-social.js';
cargarEntornoLocal();
const cuentas=(process.env.INSTAGRAM_DISCOVERY_ACCOUNTS||process.env.INSTAGRAM_CUENTAS_REFERENCIA||'').split(',').filter(Boolean).slice(0,2);
const configuracion=['INSTAGRAM_ACCESS_TOKEN','INSTAGRAM_USER_ID','META_GRAPH_VERSION','YOUTUBE_API_KEY','FACEBOOK_PUBLIC_ACCESS_TOKEN','FACEBOOK_DISCOVERY_PAGE_IDS'];
console.log(JSON.stringify({consultado:new Date().toISOString(),configuracion:Object.fromEntries(configuracion.map(k=>[k,Boolean(process.env[k]?.trim())]))}));
const consultas=[['Instagram hashtag',()=>consultarInstagramExterno({tema:'educacion',pais:'BO',hashtags:['educacion'],cuentas:[]})],['Instagram Business Discovery',()=>cuentas.length?consultarInstagramExterno({hashtags:[],cuentas}):Promise.resolve({estado:'Sin configurar',detalle:'Configura una cuenta competidora en INSTAGRAM_DISCOVERY_ACCOUNTS.',items:[]})],['YouTube',()=>obtenerSenales('BO','educacion',{dias:7,orden:'viewCount'})],['Facebook externo',()=>consultarFacebookExterno()]];
for(const [fuente,consultar] of consultas){
  try{const d=await consultar();console.log(JSON.stringify({fuente,estado:d.estado||(d.conectado?'Consultada':'Sin configurar'),detalle:d.detalle||d.aviso,subfuentes:d.subfuentes,items:(d.items||d.videos||[]).slice(0,5).map(v=>({url:v.url,fecha:v.fecha||v.publicado||null,vistas:v.vistas??null}))}));}
  catch{console.log(JSON.stringify({fuente,estado:'No disponible',detalle:'La consulta no pudo completarse; no se muestran mensajes crudos del proveedor.'}));}
}
