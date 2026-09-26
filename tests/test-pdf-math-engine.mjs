import assert from 'node:assert/strict';
import {
  detectDisplayEquation,
  formatMathBlock,
  normalizeMathSymbols
} from '../src/core/parsers/pdfMathEngine.ts';

console.log('🧪 Iniciando testes da Fatia 3: Motor de Fórmulas Matemáticas e Notações em PDF...');

// 1. Teste de Normalização de Símbolos Matemáticos
console.log('1. Testando normalização de símbolos matemáticos...');
const rawFormula = 'x \u2212 5 \u2264 y \u00D7 \u221Az \u2192 \u2211 f(x)';
const normalized = normalizeMathSymbols(rawFormula);
assert.ok(normalized.includes('−'), 'Minus sign unicode deve ser preservado/normalizado');
assert.ok(normalized.includes('≤'), 'Menor ou igual deve ser normalizado');
assert.ok(normalized.includes('×'), 'Multiplicação deve ser normalizada');
assert.ok(normalized.includes('√'), 'Raiz quadrada deve ser normalizada');
assert.ok(normalized.includes('→'), 'Seta deve ser normalizada');
console.log('✓ Normalização de símbolos matemáticos validada.');

// 2. Teste de Detecção de Equação em Bloco com Numeração Lateral
console.log('2. Testando detecção de equação em bloco com numeração (1)...');
const sampleEqText = 'Attention(Q, K, V) = softmax( QK<sup>T</sup> / √d<sub>k</sub> ) V (1)';
const detected = detectDisplayEquation(sampleEqText);

assert.ok(detected !== null, 'Deveria ter detectado como equação matemática');
assert.equal(detected.equationNumber, '(1)', 'Número da equação deve ser "(1)"');
assert.ok(detected.equationText.includes('Attention(Q, K, V)'), 'Corpo da fórmula deve ser extraído');
assert.ok(!detected.equationText.includes('(1)'), 'Número da equação não deve ficar duplicado no corpo da fórmula');

const mathHtml = formatMathBlock(detected);
assert.ok(mathHtml.includes('reader-math-block'), 'Deve conter a classe reader-math-block');
assert.ok(mathHtml.includes('(1)'), 'Deve conter a numeração da fórmula');
assert.ok(mathHtml.includes('math-content'), 'Deve conter o contêiner math-content');
console.log('✓ Detecção de equação em bloco e formatação HTML validada com sucesso.');

// 3. Teste Negativo: Texto editorial comum contendo parênteses não deve virar equação
console.log('3. Testando que texto narrativo comum não é classificado como equação...');
const normalSentence = 'According to the first author (1), the experiments showed significant improvement.';
const notAnEquation = detectDisplayEquation(normalSentence);
assert.equal(notAnEquation, null, 'Frase comum com citação numérica não deve ser tratada como fórmula');
console.log('✓ Teste negativo de texto narrativo passou.');

// 4. Teste com Equação Real de Attention Is All You Need (Page 4, Equation 1)
console.log('4. Testando extração da Equação 1 de Attention Is All You Need...');
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { groupItemsIntoLines, assembleLineText } from '../src/core/parsers/pdfTextEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const attentionPath = path.join(__dirname, 'fixtures', 'pdf', 'attention-is-all-you-need.pdf');

const attentionBuf = (await fs.readFile(attentionPath)).buffer;
const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(attentionBuf) }).promise;
const page4 = await pdf.getPage(4);
const tc = await page4.getTextContent();
const p4Items = tc.items.filter((i) => i.str && i.str.trim());

const lines = groupItemsIntoLines(p4Items);
const eqLine = lines.find((l) => Math.abs(l.y - 311.2) <= 5);
assert.ok(eqLine, 'Linha da Equação 1 deve ser encontrada na página 4');

const assembledText = assembleLineText(eqLine.items, eqLine.fontSize);
const realEq = detectDisplayEquation(assembledText);
assert.ok(realEq, 'Equação 1 real deve ser detectada');
assert.equal(realEq.equationNumber, '(1)', 'Número da equação real deve ser (1)');
console.log('✓ Equação 1 de Attention Is All You Need detectada e formatada:', realEq.equationText, realEq.equationNumber);

console.log('\n🎉 TODOS OS TESTES UNITÁRIOS DA FATIA 3 (MOTOR DE FÓRMULAS) PASSARAM!\n');
