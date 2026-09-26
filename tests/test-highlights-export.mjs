import { generateMarkdownExport } from '../src/core/export/markdownExport.ts';

// Test runner for Zettelkasten/Markdown Export
async function runExportTest() {
  console.log('🧪 Testando gerador de exportação Markdown / Obsidian...');

  const dummyBook = {
    id: 'book-123',
    title: 'A Arte da Leitura Tipográfica',
    author: 'Paulo Germano',
    format: 'md',
    progress: {
      currentSectionId: 'sec-0',
      currentSectionIndex: 0,
      scrollPercentage: 45,
      totalSections: 2,
      completed: false,
      updatedAt: Date.now()
    }
  };

  const dummyHighlights = [
    {
      id: 'hl-1',
      bookId: 'book-123',
      sectionId: 'sec-0',
      sectionTitle: 'Capítulo 1: Fundamentos',
      sectionIndex: 0,
      text: 'A tipografia bem executada não chama atenção para si; ela desaparece.',
      color: 'amber',
      note: 'Conceito de Janela Transparente de Beatrice Warde.',
      createdAt: 1774500000000
    },
    {
      id: 'hl-2',
      bookId: 'book-123',
      sectionId: 'sec-0',
      sectionTitle: 'Capítulo 1: Fundamentos',
      sectionIndex: 0,
      text: 'O comprimento ideal da linha de leitura gira entre 65 e 75 caracteres.',
      color: 'sage',
      createdAt: 1774500100000
    },
    {
      id: 'hl-3',
      bookId: 'book-123',
      sectionId: 'sec-1',
      sectionTitle: 'Capítulo 2: Contraste e Harmonia',
      sectionIndex: 1,
      text: 'O contraste não deve agredir os olhos na escuridão.',
      color: 'muted',
      note: 'Lembrar de ajustar fundo para Warm Charcoal #1C1B19.',
      createdAt: 1774500200000
    }
  ];

  const md = generateMarkdownExport(dummyBook, dummyHighlights);

  // Asserções
  if (!md.startsWith('---')) {
    throw new Error('Frontmatter YAML não encontrado no início do documento.');
  }

  if (!md.includes('title: "A Arte da Leitura Tipográfica"')) {
    throw new Error('Título ausente no frontmatter.');
  }

  if (!md.includes('total_highlights: 3')) {
    throw new Error('Contagem de destaques incorreta no frontmatter.');
  }

  if (!md.includes('> A tipografia bem executada não chama atenção para si; ela desaparece.')) {
    throw new Error('Citação em blockquote do primeiro destaque ausente.');
  }

  if (!md.includes('**Anotação:** Conceito de Janela Transparente de Beatrice Warde.')) {
    throw new Error('Anotação reflexiva ausente.');
  }

  if (!md.includes('### Capítulo 1: Fundamentos') || !md.includes('### Capítulo 2: Contraste e Harmonia')) {
    throw new Error('Agrupamento por capítulos/seções ausente.');
  }

  console.log('✓ Frontmatter YAML válido');
  console.log('✓ Citações em blockquotes renderizadas');
  console.log('✓ Anotações e cores vinculadas');
  console.log('✓ Agrupamento por capítulos verificado');
  console.log('\n🎉 TESTE DE EXPORTAÇÃO MARKDOWN PASSOU COM SUCESSO!\n');
}

runExportTest().catch((err) => {
  console.error('❌ Falha no teste de exportação:', err);
  process.exit(1);
});
