import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogarFuentes, justificarPieza, resumirHistorico, baseHorario } from '../api/_lib/precision-marketing.js';
import { dividirCampana, calendarioCsv } from '../src/lib/marketing.js';

test('el histórico ignora pagados, registros futuros y datos de más de 90 días', () => {
  const fila={red:'Instagram',formato:'Carrusel',hora:'12:30',alcance:100,interacciones:10,conversiones:1};
  const metricas=['2026-11-03','2026-11-10','2026-11-17','2025-11-04','2026-12-01'].map(fecha=>({...fila,fecha}));
  metricas.push({...fila,fecha:'2026-11-24',pagado:true});
  const resumen=resumirHistorico(metricas,'2026-12-01',new Date('2026-11-25T00:00:00Z'));
  assert.equal(resumen.publicaciones,3);
  assert.equal(resumen.franjas[0].muestra,3);
  assert.match(baseHorario(resumen,{red:'Instagram',fecha:'2026-12-01',hora:'12:00'}),/3 publicaciones/);
  assert.match(baseHorario(resumen,{red:'Facebook',fecha:'2026-12-01',hora:'12:00'}),/Prueba inicial/);
});

test('las referencias conservan fuente real y rechazan IDs inventados', () => {
  const catalogo=catalogarFuentes({noticias:[{titulo:'Logística humanitaria',url:'https://example.org/noticia',fecha:'20261115T000000Z'}],tendencias:[],plataformas:[{fuente:'Instagram',items:[{titulo:'Una cuenta',url:'javascript:alert(1)'}]}]});
  assert.equal(catalogo[0].id,'F1'); assert.equal(catalogo[1].url,'');
  const pieza={fecha:'2026-11-20',referencias:['F1','F1']};
  const resultado=justificarPieza(pieza,catalogo,'2026-11-15T00:00:00Z');
  assert.equal(resultado.referencias.length,1);
  assert.equal(resultado.referencias[0].url,'https://example.org/noticia');
  assert.throws(()=>justificarPieza({...pieza,referencias:['inventada']},catalogo,'2026-11-15'));
  assert.throws(()=>justificarPieza({...pieza,referencias:'F1'},catalogo,'2026-11-15'));
  assert.match(justificarPieza({...pieza,fecha:'2027-06-01'},catalogo,'2026-11-15').base_contenido,/Hipótesis/);
  assert.deepEqual(justificarPieza({fecha:'2026-11-20'},[],'2026-11-15').referencias,[]);
});

test('los bloques semanales conservan cobertura y límites mensuales', () => {
  const bloques=dividirCampana('2026-11-28','2027-02-02',7);
  assert.equal(bloques[0].inicio,'2026-11-28'); assert.equal(bloques.at(-1).fin,'2027-02-02');
  for(let i=0;i<bloques.length;i++) {
    assert.ok((Date.parse(bloques[i].fin)-Date.parse(bloques[i].inicio))/86400000<7);
    assert.equal(bloques[i].inicio.slice(0,7),bloques[i].fin.slice(0,7));
    if(i)assert.equal(Date.parse(bloques[i].inicio)-Date.parse(bloques[i-1].fin),86400000);
  }
  assert.throws(()=>dividirCampana('2026-11-01','2026-11-30',0));
});

test('CSV exporta la base y los enlaces verificables sin serializar objetos', () => {
  const csv=calendarioCsv({zona:'UTC',publicaciones:[{titulo:'Idea',base_contenido:'Referencia consultada',referencias:[{url:'https://example.org/noticia'}],herramienta:{nombre:'YouTube Studio',url:'https://studio.youtube.com/',uso:'Revisar retención'},criterio_hashtags:'Propuestas sin volumen medido'}]});
  assert.match(csv,/base_contenido,fuentes/); assert.match(csv,/https:\/\/example.org\/noticia/);
  assert.ok(!csv.includes('[object Object]'));
  assert.match(csv,/YouTube Studio/);assert.match(csv,/https:\/\/studio.youtube.com\//);
  assert.match(csv,/Revisar retención/);assert.match(csv,/Propuestas sin volumen medido/);
});
