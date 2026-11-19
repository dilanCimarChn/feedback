import test from 'node:test';
import assert from 'node:assert/strict';
import {origenApiDesarrollo} from '../api/_lib/entorno.js';

test('el backend remoto de desarrollo solo admite un origen HTTPS sin credenciales',()=>{
  assert.equal(origenApiDesarrollo(''), '');
  assert.equal(origenApiDesarrollo('  https://feedback-sigma-one.vercel.app/  '),'https://feedback-sigma-one.vercel.app');
  for(const valor of ['http://feedback-sigma-one.vercel.app','https://usuario:clave@feedback-sigma-one.vercel.app','https://feedback-sigma-one.vercel.app/api','https://feedback-sigma-one.vercel.app/?token=prueba','https://feedback-sigma-one.vercel.app/#fragmento','no-es-url']){
    assert.throws(()=>origenApiDesarrollo(valor),/API_REMOTA_DESARROLLO debe ser el origen HTTPS/);
  }
});
