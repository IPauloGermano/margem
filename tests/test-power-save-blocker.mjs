import assert from 'node:assert';
import { DisplaySleepInhibitor } from '../electron/powerBlocker.ts';

console.log('🧪 Iniciando testes do Gerenciador de Inibição de Suspensão de Tela (powerSaveBlocker)...');

// Mock da API powerSaveBlocker do Electron
class MockPowerSaveBlocker {
  constructor() {
    this.currentId = 1;
    this.activeBlocks = new Map();
  }

  start(type) {
    const id = this.currentId++;
    this.activeBlocks.set(id, type);
    return id;
  }

  stop(id) {
    this.activeBlocks.delete(id);
  }

  isStarted(id) {
    return this.activeBlocks.has(id);
  }
}

const mockApi = new MockPowerSaveBlocker();
const inhibitor = new DisplaySleepInhibitor(mockApi);

// 1. Estado inicial inativo
console.log('1. Testando estado inicial inativo...');
assert.strictEqual(inhibitor.isBlocking(), false, 'Não deve iniciar bloqueando');
assert.strictEqual(mockApi.activeBlocks.size, 0, 'Nenhum blocker deve estar registrado no mock');
console.log('✓ Estado inicial inativo confirmado');

// 2. Aquisição quando a janela entra em foco (foreground)
console.log('2. Testando aquisição de inibição em foco...');
const acquired = inhibitor.acquire();
assert.strictEqual(acquired, true, 'Deve adquirir a inibição com sucesso');
assert.strictEqual(inhibitor.isBlocking(), true, 'isBlocking() deve retornar true');
assert.strictEqual(mockApi.activeBlocks.size, 1, 'Deve registrar exatamente 1 blocker no sistema');
const [blockId, blockType] = Array.from(mockApi.activeBlocks.entries())[0];
assert.strictEqual(blockType, 'prevent-display-sleep', 'Deve inibir especificamente o display sleep');
console.log('✓ Inibição de display sleep ativada com sucesso');

// 3. Idempotência: múltiplos eventos de foco sucessivos não devem vazar IDs
console.log('3. Testando idempotência (múltiplas ativações sem vazamento)...');
const secondAcquired = inhibitor.acquire();
assert.strictEqual(secondAcquired, true);
assert.strictEqual(mockApi.activeBlocks.size, 1, 'Não deve duplicar blockers no mock');
console.log('✓ Idempotência validada: nenhum vazamento de ID');

// 4. Liberação quando a janela perde foco (blur / segundo plano)
console.log('4. Testando liberação imediata ao perder foco (blur)...');
const released = inhibitor.release();
assert.strictEqual(released, true, 'Deve liberar a inibição');
assert.strictEqual(inhibitor.isBlocking(), false, 'isBlocking() deve retornar false');
assert.strictEqual(mockApi.activeBlocks.size, 0, 'Blocker deve ser removido do mock');
console.log('✓ Inibição liberada imediatamente ao perder foco');

// 5. Liberação redundante / janela minimizada
console.log('5. Testando liberação repetida segura...');
const secondRelease = inhibitor.release();
assert.strictEqual(secondRelease, false, 'Liberação redundante deve retornar false sem erro');
assert.strictEqual(mockApi.activeBlocks.size, 0);
console.log('✓ Liberação redundante tratada com segurança');

// 6. Simulação do ciclo completo de leitura: foco -> minimiza -> restaura -> fecha
console.log('6. Testando simulação do ciclo de vida da janela...');
// Usuário entra no app
inhibitor.acquire();
assert.strictEqual(inhibitor.isBlocking(), true);
// Usuário minimiza para ler email
inhibitor.release();
assert.strictEqual(inhibitor.isBlocking(), false);
// Usuário restaura a janela para continuar lendo
inhibitor.acquire();
assert.strictEqual(inhibitor.isBlocking(), true);
// Usuário fecha a janela
inhibitor.release();
assert.strictEqual(inhibitor.isBlocking(), false);
assert.strictEqual(mockApi.activeBlocks.size, 0);
console.log('✓ Ciclo completo de leitura validado perfeitamente');

console.log('\n🎉 TODOS OS TESTES DO POWERSAVEBLOCKER PASSARAM COM SUCESSO!\n');
