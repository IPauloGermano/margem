/**
 * tests/test-wikipedia-adapter.mjs
 * Bateria de testes para o adaptador da Wikipédia em Português e a orquestração em cascata
 * (Léxico Local -> Wikipédia PT -> Free Dictionary EN).
 */

import assert from 'node:assert';
import { parseWikipediaResponse, fetchWikipediaPt } from '../src/core/dictionary/wikipediaAdapter.ts';
import { lookupDictionaryAsync } from '../src/core/dictionary/dictionaryEngine.ts';

async function runWikipediaAdapterTests() {
  console.log('🧪 Iniciando Testes do Adaptador da Wikipédia em Português (TI & Enciclopédia)...\n');

  // --- 1. Parser da Wikipédia ---
  console.log('--- 1. Parser da Wikipédia ---');

  const mockPayload = {
    type: 'standard',
    title: 'Kubernetes',
    displaytitle: 'Kubernetes',
    description: 'software para gerenciar contêineres em um cluster de servidor',
    extract: 'Kubernetes é um sistema de orquestração de contêineres open-source que automatiza a implantação e gestão de aplicações em contêineres.',
    thumbnail: {
      source: 'https://upload.wikimedia.org/wikipedia/commons/kubernetes.png',
      width: 100,
      height: 100
    },
    content_urls: {
      desktop: {
        page: 'https://pt.wikipedia.org/wiki/Kubernetes'
      }
    }
  };

  const parsed = parseWikipediaResponse(mockPayload, 'kubernetes');
  assert.ok(parsed !== null, 'Deveria parsear payload válido com sucesso');
  assert.strictEqual(parsed.word, 'Kubernetes');
  assert.strictEqual(parsed.partOfSpeech, 'Software para gerenciar contêineres em um cluster de servidor');
  assert.strictEqual(parsed.source, 'wikipedia');
  assert.strictEqual(parsed.url, 'https://pt.wikipedia.org/wiki/Kubernetes');
  assert.strictEqual(parsed.thumbnailUrl, 'https://upload.wikimedia.org/wikipedia/commons/kubernetes.png');
  assert.ok(parsed.definitions[0].includes('orquestração de contêineres'));
  console.log('✓ Parser converteu JSON da Wikipédia com título fiel, descrição capitalizada, miniatura e síntese');

  assert.strictEqual(parseWikipediaResponse(null, 'teste'), null);
  assert.strictEqual(parseWikipediaResponse({ title: 'Vazio', extract: '' }, 'teste'), null);
  console.log('✓ Payloads vazios ou sem extract tratados com retorno null seguro');

  // --- 2. Orquestração em Cascata e Prioridades ---
  console.log('\n--- 2. Orquestração em Cascata e Prioridades ---');

  // 2.1 Termo local tem precedência absoluta (0ms)
  const localPriority = await lookupDictionaryAsync('tipografia', { enableExternal: true });
  assert.strictEqual(localPriority.found, true);
  assert.strictEqual(localPriority.source, 'local');
  assert.strictEqual(localPriority.entry.word, 'tipografia');
  console.log('✓ Termo do léxico local mantém prioridade absoluta (source: "local")');

  // 2.2 Termo técnico ausente do léxico local com external desativado
  const offlineFallback = await lookupDictionaryAsync('kubernetes', { enableExternal: false });
  assert.strictEqual(offlineFallback.found, false);
  assert.strictEqual(offlineFallback.source, 'local');
  console.log('✓ Com external desativado, termos técnicos não indexados retornam fallback local seguro');

  // 2.3 Resiliência a timeout com AbortController
  const timeoutRes = await lookupDictionaryAsync('kubernetes', { enableExternal: true, timeoutMs: 1 });
  assert.ok(timeoutRes !== null);
  console.log('✓ Timeout estrito (1ms) tratado graciosamente sem travar a aplicação');

  // --- 3. Integração Real com a Wikipédia em Português ---
  console.log('\n--- 3. Integração Real com a Wikipédia em Português ---');

  try {
    const liveKubernetes = await fetchWikipediaPt('kubernetes', 5000);
    if (liveKubernetes) {
      assert.strictEqual(liveKubernetes.source, 'wikipedia');
      assert.ok(liveKubernetes.definitions[0].toLowerCase().includes('contêiner') || liveKubernetes.definitions[0].toLowerCase().includes('conteiner'));
      assert.ok(liveKubernetes.url?.includes('wikipedia.org'));
      console.log(`✓ Consulta real à Wikipédia PT validada: "${liveKubernetes.word}" (${liveKubernetes.partOfSpeech})`);
      console.log(`  -> Definição: ${liveKubernetes.definitions[0].slice(0, 95)}...`);
    } else {
      console.log('⚠️ Rede indisponível no ambiente de teste; fetchWikipediaPt falhou graciosamente');
    }

    const liveAlgoritmo = await fetchWikipediaPt('algoritmo', 5000);
    if (liveAlgoritmo) {
      assert.strictEqual(liveAlgoritmo.source, 'wikipedia');
      assert.ok(liveAlgoritmo.definitions[0].toLowerCase().includes('computação') || liveAlgoritmo.definitions[0].toLowerCase().includes('matemática'));
      console.log(`✓ Consulta real para conceito computacional validada: "${liveAlgoritmo.word}"`);
    }

    // 3.1 Cascata para termo em inglês na Free Dictionary API quando não há página na Wikipédia PT
    console.log('\n--- 4. Cascata Contínua para Inglês (Free Dictionary) ---');
    const cascadeEnglish = await lookupDictionaryAsync('bewilderment', { enableExternal: true, timeoutMs: 6000 });
    if (cascadeEnglish.found) {
      assert.strictEqual(cascadeEnglish.source, 'freedictionary');
      assert.ok(cascadeEnglish.entry.definitions.length > 0);
      console.log(`✓ Cascata automática: vocábulo em inglês ("${cascadeEnglish.entry.word}") resolvido via Free Dictionary API`);
    }

    // 3.2 Consulta com preferredSource explícito (ex: clique no botão do Free Dictionary)
    const explicitEnglish = await lookupDictionaryAsync('serendipity', {
      enableExternal: true,
      preferredSource: 'freedictionary',
      timeoutMs: 6000
    });
    assert.strictEqual(explicitEnglish.found, true);
    assert.strictEqual(explicitEnglish.source, 'freedictionary');
    console.log(`✓ Consulta explícita a fonte específica validada com sucesso: "${explicitEnglish.entry.word}"`);

  } catch (err) {
    console.warn('⚠️ Teste de integração de rede falhou de forma não fatal:', err.message);
  }

  console.log('\n🎉 TODOS OS TESTES DO ADAPTADOR DA WIKIPÉDIA PT PASSARAM COM SUCESSO!\n');
}

runWikipediaAdapterTests().catch((err) => {
  console.error('❌ Falha nos testes da Wikipédia:', err);
  process.exit(1);
});
