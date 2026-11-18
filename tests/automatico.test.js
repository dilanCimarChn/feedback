import test from 'node:test';
import assert from 'node:assert/strict';
import { rangoCampana, dividirCampana } from '../src/lib/marketing.js';
import { leerTendenciasRss, temporadas } from '../api/_lib/investigacion-marketing.js';
import handler from '../api/plan-automatico.js';

test('duraciones cortas, meses, años y límites',()=>{
  assert.deepEqual(rangoCampana('2026-12-28',1,'semanas'),{inicio:'2026-12-28',fin:'2027-01-03',dias:7});
  assert.equal(rangoCampana('2026-11-01',1,'meses').fin,'2026-11-30');
  assert.equal(rangoCampana('2028-01-01',1,'anos').dias,366);
  assert.equal(rangoCampana('2026-01-01',1,'anos').dias,365);
  assert.equal(rangoCampana('2026-01-31',1,'meses').fin,'2026-02-27');
  assert.throws(()=>rangoCampana('2026-02-30',1,'dias'));
  assert.throws(()=>rangoCampana('2026-11-10',2,'anos'));
  assert.throws(()=>rangoCampana('2026-11-10',0,'dias'));
});
test('bloques mantienen cobertura continua y peticiones de hasta 31 días',()=>{
  const rango=rangoCampana('2026-11-10',1,'anos');
  const bloques=dividirCampana(rango.inicio,rango.fin);
  assert.equal(bloques.length,13);
  assert.equal(bloques[0].inicio,rango.inicio);
  assert.equal(bloques.at(-1).fin,rango.fin);
  let total=0;
  for(let i=0;i<bloques.length;i++){
    const b=bloques[i],dias=(Date.parse(b.fin)-Date.parse(b.inicio))/86400000+1;
    assert.ok(dias>=1&&dias<=31);total+=dias;
    if(i)assert.equal(Date.parse(b.inicio)-Date.parse(bloques[i-1].fin),86400000);
  }
  assert.equal(total,rango.dias);
});
test('RSS conserva temas, volumen y fecha sin confundirlo con alcance social',()=>{
  const datos=leerTendenciasRss('<rss><channel><item><title><![CDATA[Educación &amp; comunidad]]></title><ht:approx_traffic>1000+</ht:approx_traffic><pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>');
  assert.equal(datos[0].tema,'Educación & comunidad');
  assert.equal(datos[0].volumenAproximado,'1000+');
  assert.throws(()=>leerTendenciasRss('<html>Error</html>'));
});
test('temporadas ofrecen anticipación y separan efemérides de tendencias',()=>{
  const eventos=temporadas('2026-11-20','2026-12-10');
  assert.ok(eventos.some(e=>e.fecha==='2026-12-25'&&e.nombre==='Navidad'));
  assert.ok(eventos.some(e=>e.fecha==='2026-12-05'&&e.url.startsWith('https://www.un.org/')));
  assert.ok(!temporadas('2026-07-01','2026-07-07').some(e=>e.nombre==='Navidad'));
});
async function invocar(body,headers={}){
  const res={status(c){this.code=c;return this;},json(d){this.data=d;return this;}};
  await handler({method:'POST',headers,body},res);return res;
}
test('plan automático investiga fuentes, respeta marca y calcula base horaria sin inventar muestra',async()=>{
  const anterior={fetch:globalThis.fetch,key:process.env.GEMINI_API_KEY,codigo:process.env.APP_ACCESS_CODE,youtube:process.env.YOUTUBE_API_KEY};
  try{
    process.env.GEMINI_API_KEY='test';delete process.env.APP_ACCESS_CODE;delete process.env.YOUTUBE_API_KEY;
    let contexto,fallar=false,incompleto=false,referenciaInvalida=false,agendaInvalida=false,llamadasIA=0;
    globalThis.fetch=async(url,opciones)=>{
      if(String(url).includes('generativelanguage.googleapis.com')){
        llamadasIA++;
        const prompt=JSON.parse(opciones.body).contents[0].parts[0].text;
        contexto=JSON.parse(prompt.split('DATOS:\n')[1]);
        const cantidad=Number(prompt.match(/EXACTAMENTE (\d+)/)[1]);
        const publicaciones=Array.from({length:incompleto?cantidad-1:cantidad},(_,i)=>({...contexto.agenda[i],hora:agendaInvalida?'00:01':contexto.agenda[i].hora,referencias:referenciaInvalida?['inventada']:[],titulo:'Aprender juntos',gancho:'Una idea práctica',guion:'Tres láminas',copy:'Comparte tu experiencia.',hashtags:['#Aprendizaje'],palabras_clave:['educación'],cta:'Comenta',metrica:'Guardados',motivo:'Propuesta editorial',base_horario:'Óptimo universal inventado',visual:'Usar #112233 y sans serif',distribucion:'Perfil propio y aliados con permiso'}));
        return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({estrategia:'Propuesta educativa y revisión semanal',publicaciones,experimentos:['Revisar guardados cada semana']})}]}}]})};
      }
      if(fallar)throw new Error('Sin conexión');
      if(String(url).includes('trends.google.com'))return {ok:true,text:async()=>'<rss><channel><item><title>Educación</title></item></channel></rss>'};
      return {ok:true,json:async()=>({articles:[{title:'Una noticia de educación',url:'https://example.com/educacion',seendate:'20261110T120000Z'}]})};
    };
    const ultimoMartes=new Date(Math.min(Date.now(),Date.parse('2026-12-01'))-86400000);
    while(ultimoMartes.getUTCDay()!==2)ultimoMartes.setUTCDate(ultimoMartes.getUTCDate()-1);
    const fechasMetricas=Array.from({length:3},(_,i)=>new Date(ultimoMartes.getTime()-i*7*86400000).toISOString().slice(0,10));
    const entrada={inicio:'2026-12-01',fin:'2026-12-07',pais:'BO',zona:'America/La_Paz',perfil:{descripcion:'Escuela comunitaria',palabras_clave:['educacion-test-automatico'],colores:[{hex:'#112233'}],tono:'Cercano',instrucciones:'No inventar testimonios'},metricas:fechasMetricas.map(fecha=>({red:'Instagram',formato:'Carrusel',fecha,hora:'12:30',alcance:100,interacciones:10,conversiones:0}))};
    assert.equal((await invocar({...entrada,fin:'2027-12-01'})).code,400);
    const resultado=await invocar(entrada);
    assert.equal(resultado.code,200);assert.equal(resultado.data.publicaciones.length,5);
    assert.equal(contexto.marca.colores[0].hex,'#112233');
    assert.equal(contexto.marca.instrucciones,'No inventar testimonios');
    assert.deepEqual(resultado.data.prioridadRedes,['Facebook','Instagram','TikTok','X','LinkedIn','YouTube']);
    assert.ok(resultado.data.publicaciones.some(p=>p.red==='Facebook'));
    assert.ok(resultado.data.publicaciones.every(p=>!p.base_horario.includes('Óptimo universal')));
    assert.ok(resultado.data.publicaciones.every(p=>p.herramienta.url.startsWith('https://')));
    assert.ok(resultado.data.publicaciones.every(p=>p.criterio_hashtags.includes('sin volumen social medido')));
    assert.equal(resultado.data.evidencia.tendencias[0].tema,'Educación');
    assert.equal(resultado.data.evidencia.estados.find(e=>e.fuente==='YouTube').estado,'Sin configurar');
    const exacto=await invocar({...entrada,cantidadPublicaciones:2,totalPublicaciones:2,finCampana:entrada.fin,region:'La Paz'});
    assert.equal(exacto.code,200);assert.equal(exacto.data.publicaciones.length,2);
    assert.equal(contexto.region,'La Paz');assert.equal(exacto.data.region,'La Paz');
    const personalizado=await invocar({...entrada,redes:['Instagram'],cantidadPublicaciones:2,totalPublicaciones:2,finCampana:entrada.fin,objetivo:'Captar voluntarios',publico:'Estudiantes',productos:'Talleres gratuitos',tono:'Didáctico',presupuesto:'Sin pauta',fechasImportantes:'2026-12-05 | Jornada del equipo',referencias:[{plataforma:'Facebook',titulo:'Actividad del barrio',url:'https://www.facebook.com/reference/posts/1'}]});
    assert.equal(personalizado.code,200);assert.ok(personalizado.data.publicaciones.every(p=>p.red==='Instagram'&&p.id&&p.estado==='borrador'&&p.objetivo==='Captar voluntarios'&&p.publico_objetivo==='Estudiantes'));assert.equal(contexto.productos,'Talleres gratuitos');assert.equal(contexto.marca.tono,'Didáctico');assert.ok(personalizado.data.eventos.some(e=>e.nombre==='Jornada del equipo'));assert.ok(contexto.catalogoFuentes.some(f=>f.url==='https://www.facebook.com/reference/posts/1'));
    const antesLotes=llamadasIA;
    const seis=await invocar({...entrada,cantidadPublicaciones:6,totalPublicaciones:6,finCampana:entrada.fin});
    assert.equal(seis.code,200);assert.equal(seis.data.publicaciones.length,6);
    assert.equal(new Set(seis.data.publicaciones.map(p=>p.red)).size,6);
    assert.equal(llamadasIA-antesLotes,2,'El calendario se escribe en lotes de hasta tres piezas');
    assert.equal((await invocar({...entrada,cantidadPublicaciones:1.5})).code,400);
    assert.equal((await invocar({...entrada,cantidadPublicaciones:121})).code,400);
    assert.equal((await invocar({...entrada,fin:'2026-12-31',cantidadPublicaciones:120,totalPublicaciones:120})).code,400,'Las campañas densas deben dividirse en bloques pequeños');
    assert.equal((await invocar({...entrada,finCampana:'2026-12-06'})).code,400);
    assert.equal((await invocar({...entrada,region:{ciudad:'La Paz'}})).code,400);
    const antes=llamadasIA;
    const vacio=await invocar({...entrada,cantidadPublicaciones:0,totalPublicaciones:0,finCampana:entrada.fin});
    assert.equal(vacio.code,200);assert.deepEqual(vacio.data.publicaciones,[]);assert.equal(llamadasIA,antes);
    agendaInvalida=true;assert.equal((await invocar(entrada)).code,502);agendaInvalida=false;
    referenciaInvalida=true;
    assert.equal((await invocar(entrada)).code,502);
    referenciaInvalida=false;
    fallar=true;
    const sinDatos=await invocar({...entrada,pais:'MX',perfil:{...entrada.perfil,palabras_clave:['otra-consulta-sin-conexion']}});
    assert.equal(sinDatos.code,200);assert.deepEqual(sinDatos.data.evidencia.tendencias,[]);
    assert.equal(sinDatos.data.evidencia.estados[0].estado,'No disponible');
    incompleto=true;
    assert.equal((await invocar(entrada)).code,502);
    process.env.APP_ACCESS_CODE='privado';
    assert.equal((await invocar(entrada)).code,401);
  }finally{
    globalThis.fetch=anterior.fetch;
    for(const [nombre,valor] of [['GEMINI_API_KEY',anterior.key],['APP_ACCESS_CODE',anterior.codigo],['YOUTUBE_API_KEY',anterior.youtube]])if(valor===undefined)delete process.env[nombre];else process.env[nombre]=valor;
  }
});
