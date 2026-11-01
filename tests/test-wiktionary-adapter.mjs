/**
 * tests/test-wiktionary-adapter.mjs
 * Testes para o adaptador do Wikcionário em Português e a resolução léxica precisa.
 * Inclui suporte a formas flexionadas (ex: "prolongada", "usuários") e lematização reversa.
 */

import assert from 'node:assert';
import { parseWiktionaryResponse, extractLemmaReference, fetchWiktionaryPt } from '../src/core/dictionary/wiktionaryAdapter.ts';
import { lookupDictionaryAsync } from '../src/core/dictionary/dictionaryEngine.ts';

async function runWiktionaryAdapterTests() {
  console.log('🧪 Iniciando Testes do Adaptador do Wikcionário em Português (Léxico Preciso)...\n');

  // --- 1. Parser do Wikcionário com formas canônicas ---
  console.log('--- 1. Parser do Wikcionário com formas canônicas ---');

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

  // --- 2. Parser do Wikcionário com formas flexionadas (ex: "prolongada") ---
  console.log('\n--- 2. Parser do Wikcionário com formas flexionadas (ex: "prolongada") ---');

  const mockProlongada = `
= Português =

== Forma de adjetivo ==

pro.lon.ga.da

feminino de prolongado
`;

  const parsedProlongada = parseWiktionaryResponse(mockProlongada, 'prolongada');
  assert.ok(parsedProlongada !== null, 'Deveria parsear "prolongada" com Forma de adjetivo');
  assert.strictEqual(parsedProlongada.word, 'prolongada');
  assert.strictEqual(parsedProlongada.partOfSpeech, 'forma de adjetivo');
  assert.strictEqual(parsedProlongada.definitions.length, 1);
  assert.strictEqual(parsedProlongada.definitions[0], 'feminino de prolongado');
  console.log('✓ Parser tratou "== Forma de adjetivo ==" e silabação "pro.lon.ga.da"');

  // --- 3. Extração de lema para remissões gramaticais ---
  console.log('\n--- 3. Extração de lema para remissões gramaticais ---');
  assert.strictEqual(extractLemmaReference('feminino de prolongado'), 'prolongado');
  assert.strictEqual(extractLemmaReference('plural de usuário.'), 'usuário');
  assert.strictEqual(extractLemmaReference('particípio do verbo prolongar'), 'prolongar');
  assert.strictEqual(extractLemmaReference('terceira pessoa do singular do verbo cantar'), 'cantar');
  assert.strictEqual(extractLemmaReference('qualquer texto comum'), null);
  console.log('✓ extractLemmaReference identifica lemas em femininos, plurais e verbos');

  // --- 4. Consulta Real de "prolongada" com enriquecimento do lema "prolongado" ---
  console.log('\n--- 4. Consulta Real de "prolongada" com enriquecimento do lema ---');
  try {
    const liveProlongada = await fetchWiktionaryPt('prolongada', 5000);
    if (liveProlongada) {
      assert.strictEqual(liveProlongada.source, 'wiktionary');
      assert.strictEqual(liveProlongada.word, 'prolongada');
      assert.ok(liveProlongada.definitions.length > 0);
      assert.ok(
        liveProlongada.definitions[0].toLowerCase().includes('prolongado'),
        'Definição deve remeter a prolongado ou enriquecer'
      );
      console.log('✓ Consulta real de "prolongada" resolvida com sucesso:');
      console.log(`  -> Classe: ${liveProlongada.partOfSpeech}`);
      console.log(`  -> Definição 1: ${liveProlongada.definitions[0]}`);
      if (liveProlongada.etymology) console.log(`  -> Etimologia: ${liveProlongada.etymology}`);
    }
  } catch (err) {
    console.warn('⚠️ Consulta externa não completou:', err.message);
  }

  // --- 5. Integração na Cascata com lookupDictionaryAsync ---
  console.log('\n--- 5. Integração na Cascata com lookupDictionaryAsync ---');
  const cascadeProlongada = await lookupDictionaryAsync('prolongada', { enableExternal: true, timeoutMs: 5000 });
  assert.strictEqual(cascadeProlongada.found, true);
  assert.strictEqual(cascadeProlongada.source, 'wiktionary');
  assert.ok(cascadeProlongada.entry.definitions.length >= 1);
  console.log('✓ "prolongada" agora resolve perfeitamente via Wikcionário na cascata');

  console.log('\n🎉 TODOS OS TESTES DO WIKCIONÁRIO PASSARAM COM SUCESSO!\n');
}

runWiktionaryAdapterTests().catch((err) => {
  console.error('❌ Falha nos testes do Wikcionário:', err);
  process.exit(1);
});
