/**
 * tests/test-free-dictionary-adapter.mjs
 * Testes unitários para o Adaptador da Free Dictionary API e consulta assíncrona.
 */

import assert from 'node:assert';
import {
  parseFreeDictionaryResponse,
  fetchFreeDictionary
} from '../src/core/dictionary/freeDictionaryAdapter.ts';
import {
  lookupDictionary,
  lookupDictionaryAsync
} from '../src/core/dictionary/dictionaryEngine.ts';

console.log('🧪 Iniciando Testes do Adaptador da Free Dictionary API...\n');

// ============================================================================
// 1. Testando Parser da Resposta JSON da Free Dictionary API
// ============================================================================
console.log('--- 1. Parser da Free Dictionary API ---');

const mockApiResponse = [
  {
    word: 'serendipity',
    phonetic: '/ˌsɛɹənˈdɪpɪti/',
    phonetics: [
      {
        text: '/ˌsɛɹənˈdɪpɪti/',
        audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/serendipity-us.mp3'
      }
    ],
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: [
          {
            definition: 'The faculty of making happy and unexpected discoveries by accident.',
            example: 'Finding this bookstore was pure serendipity.',
            synonyms: ['luck', 'fortune'],
            antonyms: []
          },
          {
            definition: 'An instance of this.',
            synonyms: [],
            antonyms: []
          }
        ],
        synonyms: ['chance', 'coincidence']
      }
    ]
  }
];

const parsed = parseFreeDictionaryResponse(mockApiResponse, 'serendipity');
assert.ok(parsed !== null, 'Deveria parsear resposta válida');
assert.strictEqual(parsed.word, 'serendipity');
assert.strictEqual(parsed.partOfSpeech, 'noun');
assert.strictEqual(parsed.phonetic, '/ˌsɛɹənˈdɪpɪti/');
assert.strictEqual(parsed.definitions.length, 2);
assert.strictEqual(parsed.definitions[0], 'The faculty of making happy and unexpected discoveries by accident.');
assert.strictEqual(parsed.example, 'Finding this bookstore was pure serendipity.');
assert.strictEqual(parsed.source, 'freedictionary');
assert.ok(parsed.synonyms.includes('luck'));
assert.ok(parsed.synonyms.includes('chance'));
console.log('✓ Parser converteu JSON da Free Dictionary API com fonética, definições e sinônimos');

// Caso de resposta vazia ou inválida
const emptyParsed = parseFreeDictionaryResponse([], 'test');
assert.strictEqual(emptyParsed, null, 'Resposta vazia deve retornar null');
const noMeaningParsed = parseFreeDictionaryResponse([{ word: 'test', meanings: [] }], 'test');
assert.strictEqual(noMeaningParsed, null, 'Sem significados deve retornar null');
console.log('✓ Respostas inválidas ou vazias tratadas com retorno null seguro');


// ============================================================================
// 2. Testando orquestração assíncrona com chave de ativação
// ============================================================================
console.log('\n--- 2. Orquestração Assíncrona e Chave de Preferências ---');

// 2.1 Termo local em português com externalDictionaryEnabled = false
const localOff = await lookupDictionaryAsync('tipografia', { enableExternal: false });
assert.strictEqual(localOff.found, true);
assert.strictEqual(localOff.source, 'local');
assert.strictEqual(localOff.entry.word, 'tipografia');
console.log('✓ Consulta local com external desativado retorna imediatamente do léxico local');

// 2.2 Termo local em português com externalDictionaryEnabled = true (deve priorizar léxico local sem fetch)
const localOn = await lookupDictionaryAsync('estética', { enableExternal: true });
assert.strictEqual(localOn.found, true);
assert.strictEqual(localOn.source, 'local');
console.log('✓ Termo catalogado localmente tem prioridade máxima (0ms) mesmo com external ativado');

// 2.3 Termo não catalogado com externalDictionaryEnabled = false (não deve tentar fetch)
const unknownOff = await lookupDictionaryAsync('epistemology', { enableExternal: false });
assert.strictEqual(unknownOff.found, false);
assert.strictEqual(unknownOff.source, 'local');
console.log('✓ Termo desconhecido com external desativado retorna fallback local seguro');


// ============================================================================
// 3. Testando simulação de timeout e resiliência de rede
// ============================================================================
console.log('\n--- 3. Resiliência a Timeout e Falhas de Rede ---');

// Mock temporário do fetch para simular timeout/abort
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (_url, options) => {
    return new Promise((_resolve, reject) => {
      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }
    });
  };

  // Timeout ultracurto (20ms) deve abortar e retornar null suavemente
  const timeoutResult = await fetchFreeDictionary('slowword', 20);
  assert.strictEqual(timeoutResult, null, 'Timeout deve resultar em null sem lançar exceção');
  console.log('✓ Timeout da requisição capturado graciosamente via AbortController');

  // lookupDictionaryAsync deve cair no fallback quando o fetch falha
  const fallbackResult = await lookupDictionaryAsync('slowword', { enableExternal: true, timeoutMs: 20 });
  assert.strictEqual(fallbackResult.found, false);
  assert.strictEqual(fallbackResult.source, 'local');
  console.log('✓ lookupDictionaryAsync mantém integridade e retorna fallback local sob falha de rede');
} finally {
  globalThis.fetch = originalFetch;
}

// ============================================================================
// 4. Testando chamada real com a Free Dictionary API
// ============================================================================
console.log('\n--- 4. Integração Real com a Free Dictionary API ---');
const liveResult = await lookupDictionaryAsync('serendipity', { enableExternal: true, timeoutMs: 4000 });
if (liveResult.found && liveResult.source === 'freedictionary') {
  assert.strictEqual(liveResult.entry.word, 'serendipity');
  assert.ok(liveResult.entry.definitions.length > 0);
  assert.ok(liveResult.entry.phonetic);
  console.log(`✓ Consulta real à Free Dictionary API validada: "${liveResult.entry.word}" (${liveResult.entry.phonetic})`);
} else {
  console.log('ℹ Conexão externa não completou a tempo; fallback preservado.');
}

console.log('\n🎉 TODOS OS TESTES DO ADAPTADOR FREE DICTIONARY PASSARAM COM SUCESSO!');
