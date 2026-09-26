import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { watch } from 'node:fs';
import { JSDOM } from 'jsdom';

// Setup de ambiente DOM para parsers
const { window } = new JSDOM('', { url: 'https://localhost/' });
globalThis.window = window;
globalThis.DOMParser = window.DOMParser;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.Node = window.Node;
globalThis.Element = window.Element;

import os from 'node:os';

const { MarkdownParser } = await import('../src/core/parsers/MarkdownParser.ts');

const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'caderno-watch-'));
const testFilePath = path.join(testDir, 'watcher-live-test.md');

console.log('🧪 Iniciando testes de Sincronização Dinâmica (Folder Watcher / Auto-Reload)...');

// 1. Criação do arquivo de teste
console.log('1. Criando arquivo de teste inicial em diretório temporário...');
const initialContent = `# Notas de Escrita no Obsidian

Primeiro parágrafo escrito no editor externo.
`;

await fs.writeFile(testFilePath, initialContent, 'utf-8');

// 2. Parse inicial e validação de estado
const parser = new MarkdownParser();
const initialDoc = await parser.parse(Buffer.from(initialContent), 'watcher-live-test.md');
assert.strictEqual(initialDoc.sections.length, 1);
assert.ok(initialDoc.sections[0].content.includes('Primeiro parágrafo'));
const initialSecId = initialDoc.sections[0].id;
console.log(`✓ Parse inicial concluído. Seção ID: ${initialSecId}, Palavras: ${initialDoc.metadata.wordCount}`);

// 3. Simulação do File Watcher com Debounce (idêntico ao do electron/main.ts)
console.log('2. Monitorando alterações em tempo real via fs.watch com debounce...');
let changeDetected = false;
let changeDetails = null;

let debounceTimer = null;
const watcher = watch(testFilePath, (eventType, filename) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    changeDetected = true;
    changeDetails = { eventType, filename };
  }, 100);
});

// 4. Edição externa (como se fosse feita no VS Code, Neovim ou Obsidian)
console.log('3. Simulando salvamento externo (Ctrl+S) no editor...');
const updatedContent = `# Notas de Escrita no Obsidian

Primeiro parágrafo escrito no editor externo.

Segundo parágrafo adicionado externamente sem perder o scroll!
`;

await fs.writeFile(testFilePath, updatedContent, 'utf-8');

// Aguarda o debounce disparar
await new Promise((resolve) => setTimeout(resolve, 350));

assert.strictEqual(changeDetected, true, 'O watcher deve detectar a modificação do arquivo no disco');
console.log('✓ Modificação detectada pelo File Watcher com sucesso.');

// 5. Simulação de Live Reload e preservação de estado
console.log('4. Executando Live Reload e verificando estabilidade da seção...');
const reloadedBuffer = await fs.readFile(testFilePath);
const reloadedDoc = await parser.parse(reloadedBuffer, 'watcher-live-test.md');

// A seção principal deve manter a integridade
assert.strictEqual(reloadedDoc.sections[0].id, initialSecId, 'ID da seção deve permanecer idêntico para não resetar scroll');
assert.ok(reloadedDoc.sections[0].content.includes('Segundo parágrafo adicionado externamente'));
assert.ok(reloadedDoc.metadata.wordCount > initialDoc.metadata.wordCount, 'Contagem de palavras deve refletir o novo conteúdo');
console.log(`✓ Documento recarregado instantaneamente. Novo número de palavras: ${reloadedDoc.metadata.wordCount}`);

// 6. Limpeza
watcher.close();
await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

console.log('\n🎉 TODOS OS TESTES DO FOLDER WATCHER / AUTO-RELOAD PASSARAM COM SUCESSO!\n');
