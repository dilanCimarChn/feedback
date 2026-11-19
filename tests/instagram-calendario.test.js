import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarInstagramExterno} from '../api/_lib/instagram-descubrimiento.js';
import {normalizarRadar,referenciaParaCalendario} from '../src/lib/radar.js';
import {referenciaSeleccionada} from '../src/lib/campanas.js';
import {catalogarFuentes,justificarPieza} from '../api/_lib/precision-marketing.js';
import tendencias from '../api/tendencias.js';
import calendario from '../api/plan-automatico.js';

const respuesta=(datos,status=200)=>({ok:status>=200&&status<300,status,json:async()=>datos});
const res=()=>({status(c){this.code=c;return this;},json(d){this.data=d;return this;}});
async function entorno(id,ejecutar){
  const claves=['META_GRAPH_VERSION','INSTAGRAM_USER_ID','INSTAGRAM_ACCESS_TOKEN','APP_ACCESS_CODE','INSTAGRAM_DISCOVERY_HASHTAGS','GEMINI_API_KEY','YOUTUBE_API_KEY','FACEBOOK_PUBLIC_ACCESS_TOKEN'];
  const previas=Object.fromEntries(claves.map(k=>[k,process.env[k]])),original=globalThis.fetch;
  try{for(const k of claves)delete process.env[k];Object.assign(process.env,{META_GRAPH_VERSION:'v99.0',INSTAGRAM_USER_ID:id,INSTAGRAM_ACCESS_TOKEN:'credencial-ficticia-de-prueba'});await ejecutar();}
  finally{globalThis.fetch=original;for(const [k,v]of Object.entries(previas))v===undefined?delete process.env[k]:process.env[k]=v;}
}

test('normaliza #educacion y reutiliza el ID devuelto, con fallback único de caption a enlaces',async()=>{
  await entorno('88001',async()=>{
    const peticiones=[];
    globalThis.fetch=async(url,opciones)=>{
      const u=new URL(url);peticiones.push(u);
      assert.ok(!u.searchParams.has('access_token'));
      assert.equal(opciones.headers.Authorization,'Bearer credencial-ficticia-de-prueba');
      if(u.pathname.endsWith('/ig_hashtag_search')){assert.equal(u.searchParams.get('q'),'educacion');return respuesta({data:[{id:'991155'}]});}
      assert.equal(u.pathname,'/v99.0/991155/top_media');assert.equal(u.searchParams.get('limit'),'3');
      if(u.searchParams.get('fields').includes('caption'))return respuesta({error:{code:100,message:'NO REFLEJAR credencial-ficticia-de-prueba'}},400);
      assert.equal(u.searchParams.get('fields'),'id,permalink');
      return respuesta({data:[{id:'77',permalink:'https://www.instagram.com/p/PRUEBA_SIN_TEXTO/'}]});
    };
    const r=await consultarInstagramExterno({hashtags:['#educacion']});
    assert.equal(peticiones.length,3);assert.equal(r.estado,'Consultada');
    assert.equal(r.items[0].texto,null);assert.equal(r.items[0].textoDisponible,false);assert.equal(r.items[0].hashtag,'#educacion');
    assert.deepEqual(r.items[0].metricas,{likes:null,comentarios:null});
    assert.equal(r.items[0].etiqueta,'Publicaciones destacadas por hashtag en Instagram');
    assert.ok(!JSON.stringify(r).includes('credencial-ficticia-de-prueba'));
    await consultarInstagramExterno({hashtags:['educacion']});assert.equal(peticiones.length,3,'Ambas formas comparten caché');
  });
});

test('token, permisos y proveedor conservan causas concretas sin reintentos ni secretos',async()=>{
  for(const [id,codigo,status,causa]of [['88002',190,400,'token_vencido'],['88003',10,403,'permiso_insuficiente'],['88004',2,503,'error_proveedor']]){
    await entorno(id,async()=>{
      let llamadas=0;globalThis.fetch=async()=>{llamadas++;return respuesta({error:{code:codigo,message:'NO REFLEJAR'}},status);};
      const r=await consultarInstagramExterno({hashtags:['#educacion']});
      assert.equal(r.estado,'No disponible');assert.equal(r.subfuentes[0].causa,causa);assert.equal(llamadas,1);assert.deepEqual(r.items,[]);
      assert.ok(!JSON.stringify(r).includes('NO REFLEJAR'));
    });
  }
});

test('las preferencias iniciales son solo hashtags públicos y respetan el código de acceso',async()=>{
  await entorno('88005',async()=>{
    process.env.INSTAGRAM_DISCOVERY_HASHTAGS='#educacion, EDUCACION, salud, https://invalido.test';
    let r=res();await tendencias({method:'POST',headers:{},body:{accion:'preferencias'}},r);
    assert.deepEqual(r.data,{hashtagsInstagram:['educacion','salud']});
    process.env.APP_ACCESS_CODE='solo-prueba';r=res();await tendencias({method:'POST',headers:{},body:{accion:'preferencias'}},r);assert.equal(r.code,401);
  });
});

test('el enlace y la ausencia de texto sobreviven al paso del radar a una pieza de campaña',()=>{
  const url='https://www.instagram.com/p/REFERENCIA_TEST/';
  const [hallazgo]=normalizarRadar({consultado:'2026-11-18T12:00:00Z',descubrimientos:[{fuente:'Instagram',items:[{titulo:'Publicación externa sin texto',url,hashtag:'#educacion',texto:null,etiqueta:'Publicaciones destacadas por hashtag en Instagram'}]}]});
  const seleccionada=referenciaSeleccionada(referenciaParaCalendario(hallazgo));
  assert.equal(seleccionada.hashtag,'#educacion');assert.equal(seleccionada.texto,null);
  const catalogo=catalogarFuentes({referenciasManuales:[seleccionada]});
  assert.equal(catalogo[0].observaciones.textoDisponible,false);assert.equal(catalogo[0].observaciones.verificada,false);
  const pieza=justificarPieza({fecha:'2026-11-19',referencias:[catalogo[0].id]},catalogo,'2026-11-18T12:00:00Z');
  assert.equal(pieza.referencias[0].url,url);assert.match(pieza.base_contenido,/texto no disponible/);
});

test('calendario usa un hallazgo sin caption, conserva su enlace y deja las otras fuentes disponibles',async()=>{
  await entorno('88006',async()=>{
    process.env.GEMINI_API_KEY='clave-ficticia';
    let contexto;
    globalThis.fetch=async(url,opciones)=>{
      const u=new URL(url);
      if(u.hostname==='graph.facebook.com')return respuesta(u.pathname.endsWith('/ig_hashtag_search')?{data:[{id:'991166'}]}:{data:[{id:'88',permalink:'https://www.instagram.com/p/CALENDARIO_TEST/'}]});
      if(u.hostname==='trends.google.com')return {ok:true,text:async()=>'<rss><channel><item><title>Educación</title></item></channel></rss>'};
      if(u.hostname==='api.gdeltproject.org')return respuesta({articles:[]});
      assert.equal(u.hostname,'generativelanguage.googleapis.com');
      const partes=JSON.parse(opciones.body).contents[0].parts;
      contexto=JSON.parse(partes[0].text.split('DATOS:\n')[1]);
      const fuente=contexto.catalogoFuentes.find(f=>f.fuente==='Instagram');assert.ok(fuente);assert.equal(fuente.observaciones.textoDisponible,false);
      assert.ok(partes.some(p=>p.text.includes('no inventes qué dice o muestra')));
      return respuesta({candidates:[{content:{parts:[{text:JSON.stringify({estrategia:'Idea editorial con enlace por revisar',experimentos:[],publicaciones:[{...contexto.agenda[0],referencias:[fuente.id],titulo:'Aprender en comunidad',gancho:'Una propuesta educativa',guion:'Crear una actividad propia',copy:'Participa en nuestro taller',cta:'Conoce el taller',metrica:'Consultas',motivo:'Idea de la marca; enlace por revisar',visual:'Usar la paleta de marca',distribucion:'Perfil de la marca'}]})}]}}]});
    };
    const hoy=new Date().toISOString().slice(0,10),r=res();
    await calendario({method:'POST',headers:{},body:{inicio:hoy,fin:hoy,pais:'BO',zona:'America/La_Paz',descripcion:'Educación comunitaria',objetivo:'Inscripciones',publico:'Familias',redes:['Instagram'],cantidadPublicaciones:1,totalPublicaciones:1,finCampana:hoy,perfil:{nombre:'Marca de prueba',descripcion:'Educación comunitaria'}}},r);
    assert.equal(r.code,200);assert.equal(r.data.publicaciones[0].referencias[0].url,'https://www.instagram.com/p/CALENDARIO_TEST/');assert.match(r.data.publicaciones[0].base_contenido,/texto no disponible/);
    assert.equal(r.data.evidencia.estados.find(f=>f.fuente==='Google Trends').estado,'Consultada');
  });
});

test('el horario UTC no elimina la referencia de una publicación del mismo día local',()=>{
  const catalogo=[{id:'F1',fuente:'Instagram',url:'https://www.instagram.com/p/DIA_LOCAL/',observaciones:{textoDisponible:false}}];
  const pieza=justificarPieza({fecha:'2026-11-18',referencias:['F1']},catalogo,'2026-11-19T01:52:00Z');
  assert.equal(pieza.referencias[0].id,'F1');
});

test('un rechazo de Instagram conserva videos de YouTube y resultados de Google Trends',async()=>{
  await entorno('88007',async()=>{
    process.env.YOUTUBE_API_KEY='youtube-ficticio';
    globalThis.fetch=async url=>{
      const u=new URL(url);
      if(u.hostname==='graph.facebook.com')return respuesta({error:{code:190}},400);
      if(u.hostname==='trends.google.com')return {ok:true,text:async()=>'<rss><channel><item><title>Educación comunitaria</title></item></channel></rss>'};
      if(u.hostname==='www.googleapis.com'){
        const snippet={title:'Educación comunitaria',publishedAt:new Date(Date.now()-86400000).toISOString()};
        return respuesta({items:u.pathname.endsWith('/search')?[{id:{videoId:'abcdefghijk'},snippet}]:[{id:'abcdefghijk',snippet,statistics:{viewCount:'25'}}]});
      }
      return respuesta({articles:[]});
    };
    const r=res();await tendencias({method:'POST',headers:{},body:{tema:'educacion',pais:'BO',hashtags:['#educacion']}},r);
    assert.equal(r.code,200);assert.equal(r.data.descubrimiento.subfuentes[0].causa,'token_vencido');
    assert.equal(r.data.videos.length,1);assert.equal(r.data.videos[0].vistas,'25');assert.equal(r.data.tendencias.length,1);
  });
});

test('una búsqueda vacía declara sin resultados y no inventa un ID para consultar top_media',async()=>{
  await entorno('88008',async()=>{
    let llamadas=0;globalThis.fetch=async url=>{llamadas++;assert.ok(String(url).includes('/ig_hashtag_search'));return respuesta({data:[]});};
    const r=await consultarInstagramExterno({hashtags:['#educacion']});
    assert.equal(r.estado,'Sin resultados');assert.equal(r.subfuentes[0].causa,'sin_resultados');assert.equal(llamadas,1);assert.deepEqual(r.items,[]);
  });
});
