import assert from 'node:assert/strict';
import { lookupDualDictionary } from '../src/core/dictionary/dictionaryEngine.ts';

console.log('🧪 Iniciando Testes de Consulta Dupla (Dicionário Léxico + Wikipédia Semântica)...\n');

async function runTests() {
  // 1. Termo composto ("redes sociais" ou "tipografia digital") -> defaultTab deve ser "wikipedia"
  console.log('--- 1. Termo composto enciclopédico ---');
  const compoundRes = await lookupDualDictionary('tipografia digital', { enableExternal: true });
  console.log('Termo composto:', compoundRes.searchedWord);
  console.log('Aba padrão:', compoundRes.defaultTab);
  console.log('Wikipédia encontrada:', compoundRes.wikipedia?.found, compoundRes.wikipedia?.entry?.word);
  assert.equal(compoundRes.defaultTab, 'wikipedia', 'Termo composto deve priorizar a aba Wikipédia');
  assert.equal(compoundRes.wikipedia?.found, true, 'Wikipédia deve encontrar artigo relevante via busca semântica');
  console.log('✓ Termo composto priorizou Wikipédia e resolveu artigo semântico com sucesso.\n');

  // 2. Palavra única com verbete léxico ("proporção") -> defaultTab deve ser "dictionary"
  console.log('--- 2. Palavra única com verbete léxico ---');
  const singleWordRes = await lookupDualDictionary('proporção', { enableExternal: true });
  console.log('Palavra:', singleWordRes.searchedWord);
  console.log('Aba padrão:', singleWordRes.defaultTab);
  console.log('Dicionário encontrado:', singleWordRes.dictionary?.found);
  assert.equal(singleWordRes.defaultTab, 'dictionary', 'Palavra única comum deve priorizar aba Dicionário');
  assert.equal(singleWordRes.dictionary?.found, true, 'Dicionário deve conter acepção');
  console.log('✓ Palavra única priorizou aba Dicionário com definição precisa.\n');

  // 3. Flexão verbal ("definiram") -> Lematização resolve para "definir"
  console.log('--- 3. Verbo conjugado ("definiram") ---');
  const verbRes = await lookupDualDictionary('definiram', { enableExternal: true });
  console.log('Palavra pesquisada:', verbRes.searchedWord);
  console.log('Dicionário encontrado:', verbRes.dictionary?.found);
  console.log('Entrada:', verbRes.dictionary?.entry?.word);
  assert.equal(verbRes.dictionary?.found, true, 'Verbo conjugado deve ser encontrado');
  assert.equal(verbRes.dictionary?.entry?.word, 'definir', 'Lema deve ser "definir"');
  console.log('✓ Flexão verbal lematizada com sucesso.\n');

  // 4. Modo sem internet (enableExternal: false)
  console.log('--- 4. Modo offline ---');
  const offlineRes = await lookupDualDictionary('tipografia', { enableExternal: false });
  assert.equal(offlineRes.dictionary?.found, true, 'Léxico local deve resolver mesmo offline');
  assert.equal(offlineRes.wikipedia, null, 'Wikipédia não deve ser consultada se external estiver desativado');
  console.log('✓ Modo offline preservado com latência instantânea.\n');

  console.log('🎉 TODOS OS TESTES DE CONSULTA DUPLA PASSARAM COM SUCESSO!');
}

runTests().catch((err) => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
