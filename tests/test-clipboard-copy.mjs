/**
 * tests/test-clipboard-copy.mjs
 * Bateria de testes para o motor de cópia de texto/código (clipboard):
 * 1. Camada 1: Desktop nativo (window.cadernoAPI.writeClipboard)
 * 2. Camada 2: Navegador moderno com suporte a navigator.clipboard.writeText
 * 3. Camada 3: Fallback universal via textarea e document.execCommand('copy') quando navigator.clipboard for undefined (ex: HTTP LAN)
 * 4. Camada 3: Fallback quando navigator.clipboard.writeText rejeitar (ex: perda de foco)
 * 5. Preservação de código bruto via data-raw-code em renderHighlightedCodeBlock
 */

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { copyTextToClipboard } from '../src/core/clipboard/clipboard.ts';
import { renderHighlightedCodeBlock } from '../src/core/syntax/syntaxHighlighter.ts';

console.log('🧪 Iniciando testes do Motor de Cópia e Clipboard...\n');

async function runTests() {
  // Configura ambiente JSDOM base
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://localhost/'
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  // -------------------------------------------------------------------------
  // 1. Camada 1: Desktop nativo (cadernoAPI.writeClipboard)
  // -------------------------------------------------------------------------
  console.log('1. Testando cópia via API nativa do Electron (Camada 1)...');
  let electronWrittenText = null;
  globalThis.window.cadernoAPI = {
    isDesktop: true,
    writeClipboard: async (text) => {
      electronWrittenText = text;
      return true;
    }
  };

  const desktopResult = await copyTextToClipboard('const desktop = true;');
  assert.strictEqual(desktopResult, true, 'Deve retornar true na cópia nativa do Electron');
  assert.strictEqual(electronWrittenText, 'const desktop = true;', 'Texto recebido pela API nativa deve ser idêntico');
  console.log('✓ Camada 1 (Electron nativo) funciona com prioridade máxima.');

  // Remove cadernoAPI para testar as camadas web
  delete globalThis.window.cadernoAPI;

  // -------------------------------------------------------------------------
  // 2. Camada 2: Navegador moderno com navigator.clipboard
  // -------------------------------------------------------------------------
  console.log('\n2. Testando cópia via navigator.clipboard.writeText (Camada 2)...');
  let navWrittenText = null;
  const mockClipboard = {
    writeText: async (text) => {
      navWrittenText = text;
    }
  };
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: mockClipboard,
    configurable: true,
    writable: true
  });

  const navResult = await copyTextToClipboard('function web() { return 42; }');
  assert.strictEqual(navResult, true, 'Deve retornar true ao usar navigator.clipboard');
  assert.strictEqual(navWrittenText, 'function web() { return 42; }', 'Texto copiado via navigator.clipboard deve ser idêntico');
  console.log('✓ Camada 2 (Navigator Clipboard) funciona em contexto seguro.');

  // -------------------------------------------------------------------------
  // 3. Camada 3: Fallback quando navigator.clipboard for undefined (HTTP LAN)
  // -------------------------------------------------------------------------
  console.log('\n3. Testando fallback com execCommand quando navigator.clipboard for undefined...');
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: undefined,
    configurable: true,
    writable: true
  }); // Simula contexto HTTP na rede local (server.mjs)

  let execCommandCalledWith = null;
  globalThis.document.execCommand = (cmd) => {
    execCommandCalledWith = cmd;
    return true;
  };

  const fallbackResult = await copyTextToClipboard('echo "LAN HTTP server"');
  assert.strictEqual(fallbackResult, true, 'Fallback deve retornar true');
  assert.strictEqual(execCommandCalledWith, 'copy', 'Deve invocar document.execCommand("copy")');
  console.log('✓ Camada 3 (Fallback textarea + execCommand) protege conexões HTTP na LAN.');

  // -------------------------------------------------------------------------
  // 4. Camada 3: Fallback quando navigator.clipboard.writeText rejeitar
  // -------------------------------------------------------------------------
  console.log('\n4. Testando fallback quando navigator.clipboard.writeText rejeitar por foco...');
  execCommandCalledWith = null;
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: {
      writeText: async () => {
        throw new Error('DOMException: Document is not focused.');
      }
    },
    configurable: true,
    writable: true
  });

  const rejectedResult = await copyTextToClipboard('codigo apos perda de foco');
  assert.strictEqual(rejectedResult, true, 'Deve recuperar com fallback mesmo se writeText rejeitar');
  assert.strictEqual(execCommandCalledWith, 'copy', 'Deve ter chamado execCommand("copy") no fallback');
  console.log('✓ Fallback recupera com sucesso rejeições de foco.');

  // -------------------------------------------------------------------------
  // 5. Preservação de data-raw-code em renderHighlightedCodeBlock
  // -------------------------------------------------------------------------
  console.log('\n5. Testando geração e decodificação do atributo data-raw-code no bloco...');
  const originalCode = `const special = "<tag> & 'quote' && \`template\`;\nline 2;\tindented";`;
  const htmlBlock = renderHighlightedCodeBlock(originalCode, 'typescript');

  assert.ok(htmlBlock.includes('data-raw-code='), 'HTML deve conter atributo data-raw-code');
  assert.ok(htmlBlock.includes('reader-code-copy-btn'), 'HTML deve conter botão de cópia');

  // Parseia o bloco no DOM e simula a extração de cópia do ReaderContent
  const div = globalThis.document.createElement('div');
  div.innerHTML = htmlBlock;
  const blockEl = div.querySelector('.reader-code-block');
  assert.ok(blockEl, 'Elemento .reader-code-block deve existir no DOM');

  const rawAttr = blockEl.getAttribute('data-raw-code');
  assert.ok(rawAttr, 'data-raw-code deve estar presente');
  const decodedCode = decodeURIComponent(rawAttr);

  assert.strictEqual(decodedCode, originalCode, 'Código decodificado deve ser idêntico ao original byte a byte');
  console.log('✓ data-raw-code preserva quebras de linha, tags, aspas e indentação sem corrupção.');

  console.log('\n🎉 TODOS OS TESTES DO MOTOR DE CÓPIA PASSARAM COM SUCESSO!');
}

runTests().catch((err) => {
  console.error('❌ Falha nos testes de cópia:', err);
  process.exit(1);
});
