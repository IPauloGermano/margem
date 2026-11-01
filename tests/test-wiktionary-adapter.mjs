/**
 * tests/test-wiktionary-adapter.mjs
 * Testes para o adaptador do Wikcionário em Português e a resolução léxica precisa.
 */

import assert from 'node:assert';
import { parseWiktionaryResponse, fetchWiktionaryPt } from '../src/core/dictionary/wiktionaryAdapter.ts';
import { lookupDictionaryAsync } from '../src/core/dictionary/dictionaryEngine.ts';

async function runWiktionaryAdapterTests() {
  console.log('🧪 Iniciando Testes do Adaptador do Wikcionário em Português (Léxico Preciso)...\n');

  // --- 1. Parser do Wikcionário ---
  console.log('--- 1. Parser do Wikcionário ---');

  const mockExtract = `
= Português =

== Substantivo ==

re.cur.so, masculino

meios viáveis de se conseguir alcançar um dado objetivo
(Direito) meio de se apresentar uma justificativa ou pedir revisão de uma determinação superior
riquezas, dinheiro, crédito

=== Expressões ===
entrar com recurso: recorrer

== Etimologia ==
Do latim recursus (la).

== Pronúncia ==
AFI: \\xe.'kur.su\\

= Espanhol =
== Substantivo ==
recurso
`;

  const parsed = parseWiktionaryResponse(mockExtract, 'recurso');
  assert.ok(parsed !== null, 'Deveria parsear verbete do Wikcionário');
  assert.strictEqual(parsed.word, 'recurso');
  assert.strictEqual(parsed.partOfSpeech, 'substantivo masculino');
  assert.strictEqual(parsed.etymology, 'Do latim recursus');
  assert.strictEqual(parsed.phonetic, '/xe.\'kur.su/');
  assert.strictEqual(parsed.definitions.length, 3);
  assert.ok(parsed.definitions[0].includes('meios viáveis'));
  assert.strictEqual(parsed.source, 'wiktionary');
  console.log('✓ Parser extraiu classe, gênero, etimologia, fonética AFI e 3 definições concisas');

  assert.strictEqual(parseWiktionaryResponse('', 'teste'), null);
  assert.strictEqual(parseWiktionaryResponse(null, 'teste'), null);
  console.log('✓ Extratos vazios ou nulos tratados com segurança');

  // --- 2. Consulta Real com a palavra "recurso" ---
  console.log('\n--- 2. Consulta Real com a palavra "recurso" ---');
  try {
    const liveRecurso = await fetchWiktionaryPt('recurso', 5000);
    if (liveRecurso) {
      assert.strictEqual(liveRecurso.source, 'wiktionary');
      assert.strictEqual(liveRecurso.partOfSpeech, 'substantivo masculino');
      assert.ok(liveRecurso.definitions.length > 0);
      assert.ok(liveRecurso.definitions[0].toLowerCase().includes('meio') || liveRecurso.definitions[0].toLowerCase().includes('objetivo'));
      console.log(`✓ Consulta real de "recurso" resolvida com sucesso pelo Wikcionário:`);
      console.log(`  -> Classe: ${liveRecurso.partOfSpeech}`);
      console.log(`  -> Definição 1: ${liveRecurso.definitions[0]}`);
      if (liveRecurso.etymology) console.log(`  -> Etimologia: ${liveRecurso.etymology}`);
    }
  } catch (err) {
    console.warn('⚠️ Consulta externa não completou:', err.message);
  }

  // --- 3. Integração na Cascata com lookupDictionaryAsync ---
  console.log('\n--- 3. Integração na Cascata com lookupDictionaryAsync ---');
  const cascadeRecurso = await lookupDictionaryAsync('recurso', { enableExternal: true, timeoutMs: 5000 });
  assert.strictEqual(cascadeRecurso.found, true);
  assert.strictEqual(cascadeRecurso.source, 'wiktionary');
  assert.ok(cascadeRecurso.entry.definitions.length >= 1);
  assert.strictEqual(cascadeRecurso.entry.partOfSpeech, 'substantivo masculino');
  console.log('✓ "recurso" agora resolve via Wikcionário (em vez de desambiguação da Wikipédia)');

  console.log('\n🎉 TODOS OS TESTES DO WIKCIONÁRIO PASSARAM COM SUCESSO!\n');
}

runWiktionaryAdapterTests().catch((err) => {
  console.error('❌ Falha nos testes do Wikcionário:', err);
  process.exit(1);
});
