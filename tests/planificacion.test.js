import test from 'node:test';
import assert from 'node:assert/strict';
import { dividirCampana, rangoCampana } from '../src/lib/marketing.js';
import { PERIODOS_CAMPANA, MAXIMO_POR_UNIDAD, periodoSeleccionado, mesSiguiente, rangoMes, cantidadAutomatica, cuposPorBloque, celdasMes } from '../src/lib/planificacion.js';

test('duraciones visibles permiten desde un día hasta un año y conservan las opciones guardadas', () => {
  for(const periodo of PERIODOS_CAMPANA) {
    const rango=rangoCampana('2028-01-01',periodo.cantidad,periodo.unidad);
    assert.ok(rango.dias>=1&&rango.dias<=366);
    assert.equal(periodoSeleccionado({...periodo,modo:'duracion'}),periodo.id);
  }
  assert.equal(rangoCampana('2028-01-01',1,'dias').dias,1);
  assert.equal(rangoCampana('2028-01-01',1,'anos').dias,366);
  assert.equal(periodoSeleccionado({modo:'duracion',cantidad:'3',unidad:'meses'}),'trimestre');
  assert.equal(periodoSeleccionado({modo:'mes',cantidad:3,unidad:'meses'}),'mes_completo');
  assert.equal(periodoSeleccionado({modo:'personalizado',cantidad:10,unidad:'dias'}),'personalizado');
  for(const [unidad,maximo] of Object.entries(MAXIMO_POR_UNIDAD)) {
    assert.doesNotThrow(()=>rangoCampana('2028-01-01',maximo,unidad));
    assert.throws(()=>rangoCampana('2028-01-01',maximo+1,unidad));
  }
});

test('el mes completo incluye febrero bisiesto y el próximo mes cruza de año', () => {
  assert.deepEqual(rangoMes('2028-02'), { inicio:'2028-02-01', fin:'2028-02-29', dias:29 });
  assert.equal(rangoMes('2027-02').dias, 28);
  assert.equal(mesSiguiente(new Date(2026,11,20)), '2027-01');
  for(const mes of ['2026-00','2026-13','2026-2','2019-12','']) assert.throws(()=>rangoMes(mes));
});

test('la cuota conserva el total solicitado incluso con semanas de cero publicaciones', () => {
  const bloques=dividirCampana('2026-12-01','2026-12-31',7);
  const una=cuposPorBloque(bloques,1);
  assert.equal(una.reduce((a,b)=>a+b,0),1);
  assert.ok(una.includes(0));
  for(const total of [6,22,120]) {
    const cupos=cuposPorBloque(bloques,total);
    assert.equal(cupos.reduce((a,b)=>a+b,0),total);
    assert.equal(cupos.length,bloques.length);
    assert.ok(cupos.every(n=>Number.isInteger(n)&&n>=0));
  }
  assert.equal(cantidadAutomatica(31),22);
  assert.equal(cantidadAutomatica(365),261);
  assert.throws(()=>cuposPorBloque(bloques,1.5));
});

test('el calendario alinea cada fecha con su día semanal y conserva siete columnas', () => {
  for(const mes of ['2026-11','2026-12','2027-02','2028-02']) {
    const celdas=celdasMes(mes);
    assert.equal(celdas.length%7,0);
    assert.equal(celdas.filter(Boolean).length,rangoMes(mes).dias);
    celdas.forEach((fecha,i)=>{
      if(fecha)assert.equal(i%7,new Date(`${fecha}T00:00:00Z`).getUTCDay());
    });
  }
  assert.equal(celdasMes('2026-12')[0],null);
  assert.equal(celdasMes('2026-12')[2],'2026-12-01');
  assert.equal(celdasMes('2101-01').filter(Boolean).length,31);
});
