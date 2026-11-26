import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/analizar-marca.js';

test('el análisis del manual conserva misión y vocabulario explícito separados de términos inferidos', async () => {
  const original = { fetch: globalThis.fetch, key: process.env.GEMINI_API_KEY, codigo: process.env.APP_ACCESS_CODE };
  process.env.GEMINI_API_KEY = 'manual-simulado';
  delete process.env.APP_ACCESS_CODE;
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /generativelanguage/);
    const partes = JSON.parse(options.body).contents[0].parts;
    assert.ok(partes.some(p => p.inlineData?.mimeType === 'application/pdf'));
    assert.match(partes[0].text, /solo cuando el material los identifique explícitamente/);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ nombre: 'TSCP', mision: 'Misión expresamente indicada.', vocabulario_aprobado: ['Recurso correcto'], palabras_clave: ['Palabra observada'], notas: 'Revisar antes de confirmar.' }) }] } }] }) };
  };
  const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  try {
    await handler({ method: 'POST', headers: {}, body: { documento: 'data:application/pdf;base64,JVBERi0xLjQ=', imagenes: [] } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.data.perfil.mision, 'Misión expresamente indicada.');
    assert.deepEqual(res.data.perfil.vocabulario_aprobado, ['Recurso correcto']);
    assert.deepEqual(res.data.perfil.palabras_clave, ['Palabra observada']);
    assert.equal(JSON.stringify(res.data).includes('JVBERi0xLjQ='), false);
  } finally {
    globalThis.fetch = original.fetch;
    if (original.key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = original.key;
    if (original.codigo === undefined) delete process.env.APP_ACCESS_CODE; else process.env.APP_ACCESS_CODE = original.codigo;
  }
});
