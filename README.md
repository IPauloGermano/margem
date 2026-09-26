# Caderno Reader 📖

> Aplicativo desktop de leitura tipográfica para Linux (empacotado em AppImage), construído com **Electron**, **React 18**, **TypeScript**, **Tailwind CSS v4** e **Vite**, com estética visual e rigor editorial inspirados no ecossistema do **PauloGerm.dev**.

---

## 1. Visão Geral e Filosofia de Design

O **Caderno Reader** foi projetado para transformar a leitura de textos técnicos, anotações de estudo e livros digitais em uma experiência calma, ergonômica e focada.

### Elementos Visuais e Conceitos Herdados da UI:
1. **Paleta Warm Charcoal & E-Ink:**
   - **Dark (Warm Charcoal & Linen):** Fundo cinza-carvão aquecido (`#1C1B19`), superfícies em camadas (`#242220`), bordas nítidas e sutis (`#3A3632`) e o tom de sinal quente (*Accent Signal* `#DE6B44`).
   - **Light (Kindle Paperwhite / E-Ink Substrate):** Fundo papel linho suave (`#EFECE6`), superfícies acolhedoras (`#F6F3ED`) e tipografia de alto contraste sem ofuscar a retina (`#1F1D1B`).
   - **Sepia (Linen Sepia):** Tonalidade clássica de papel de livro antigo (`#F4EFE6`).
   - **OLED (Pitch Black):** Fundo preto absoluto (`#0A0A09`) para telas OLED e leitura no escuro.
2. **Tipografia Editorial:**
   - Prosa em **Source Serif 4 Variable** e **Newsreader**, com proporção de entrelinha refinada (`line-height` configurável de 1.4 a 2.2) e *measure* ajustável (550px a 950px, com o padrão de 780px).
   - Metadados, índices (`#01`, `#02`), tags de formato e atalhos em **JetBrains Mono**.
3. **Estante & Organização:**
   - Visualização em cartões com status de leitura ("Lendo agora", "Lido"), tempo estimado em minutos, contagem de palavras e barra de progresso individual.
   - Filtros instantâneos por formato (`EPUB`, `Markdown`, `Texto`) e busca em tempo real.

---

## 2. Arquitetura Modular e Extensível

O projeto adota o **Registry Pattern** para suporte a documentos, garantindo que novos formatos de arquivo possam ser adicionados sem refatorar o núcleo de renderização ou o leitor:

```text
src/
├── core/
│   ├── types/               # Modelos de dados puros (Book, Section, TOC, Progress, Preferences)
│   ├── parsers/             # Camada desacoplada de parsers
│   │   ├── DocumentParser.ts    # Interface comum (canParse, parse)
│   │   ├── ParserRegistry.ts    # Registro central extensível
│   │   ├── MarkdownParser.ts    # Suporte a .md e .markdown (Frontmatter, Headings, HTML)
│   │   ├── TextParser.ts        # Suporte a .txt (Detecção inteligente de capítulos)
│   │   └── EpubParser.ts        # Suporte a .epub (Descompactação ZIP, OPF, Spine, NCX/NAV, imagens)
│   └── storage/
│       └── db.ts                # Persistência via IndexedDB + localStorage (Livros, Posição, Marcadores)
├── components/
│   ├── Library/             # Estante, Cards, Filtros, Drag & Drop
│   └── Reader/              # Leitor, Header, Footer com Progresso, Sidebar com TOC/Busca, Modais
├── electron/
│   ├── main.ts              # Processo principal (IPC, diálogos nativos do OS, leitura de disco)
│   └── preload.ts           # ContextBridge seguro expondo window.cadernoAPI
└── styles/
    └── theme.css            # Tokens de cores, fontes editoriais e classes de leitura
```

### Como Adicionar um Novo Formato (ex: PDF ou MOBI):
Basta criar uma classe implementando `DocumentParser`:

```typescript
import { DocumentParser } from './DocumentParser';
import { ParsedDocument } from '../types';

export class PdfParser implements DocumentParser {
  readonly format = 'pdf';
  readonly extensions = ['pdf'];

  canParse(filename: string): boolean {
    return filename.toLowerCase().endsWith('.pdf');
  }

  async parse(buffer: ArrayBuffer, filename: string): Promise<ParsedDocument> {
    // Extrai texto, metadados e capítulos...
    return { metadata, sections, toc };
  }
}

// No ParserRegistry.ts ou na inicialização:
defaultParserRegistry.register(new PdfParser());
```

---

- [x] **Suporte a Múltiplos Formatos:** Leitura completa de arquivos `.md`, `.markdown`, `.txt` e `.epub`.
- [x] **Importação de Pastas e Caminhos Inteiros:** Adicione diretórios completos pelo seletor nativo do sistema ou digitando/colando caminhos absolutos (ex: `/home/user/Livros` ou `~/Documents/Ebooks`). O leitor varre recursivamente e indexa todos os documentos suportados em lote.
- [x] **Abertura Local & Diálogos Nativos:** Diálogo nativo do sistema via Electron (`dialog.showOpenDialog`) e suporte a Drag & Drop direto na estante.
- [x] **Filtros por Coleção/Pasta:** Filtre rapidamente sua estante por pasta de origem ou formato de arquivo.
- [x] **Estante / Biblioteca Completa:** Persistência em IndexedDB com capas, progresso percentual, contagem de palavras e ordenação pelos lidos mais recentemente.
- [x] **Controle Tipográfico Preciso:** Ajuste em tempo real de tamanho de fonte (14px–28px), espaçamento de linha (1.4–2.2), largura da coluna (550px–950px), alinhamento (esquerda/justificado) e família de fontes (Serif, Sans, Mono, Alta Legibilidade).
- [x] **4 Temas de Leitura:** Warm Charcoal, Kindle Paperwhite, Linen Sepia e Pitch Black OLED.
- [x] **Sumário (TOC) & Navegação Estruturada:** Painel lateral sanfonado com saltos diretos entre capítulos e seções.
- [x] **Busca de Texto Integrada:** Pesquisa textual completa em todos os capítulos do livro com trechos contextuais e navegação direta para o resultado.
- [x] **Barra de Progresso e Scrubber:** Indicador sutil de rolagem, percentual de conclusão e salto rápido de leitura.
- [x] **Salvamento Automático:** Posição de rolagem e capítulo atual gravados automaticamente por livro.
- [x] **Marcadores e Anotações:** Criação de marcadores na posição exata da leitura (`Ctrl+D`) com data, percentual e trecho citado.
- [x] **Atalhos de Teclado:**
  - `J` / `Espaço`: Rolar para baixo
  - `K` / `Shift+Espaço`: Rolar para cima
  - `[` / `]`: Capítulo anterior / próximo
  - `Ctrl + F`: Buscar no texto
  - `Ctrl + B`: Abrir/fechar sumário lateral
  - `Ctrl + ,`: Ajustes de aparência e tema
  - `Ctrl + D`: Criar marcador
  - `?`: Guia de atalhos
  - `Esc`: Fechar modais / Voltar à estante

---

## 4. Como Executar e Empacotar

### Pré-requisitos
- Node.js 20+ ou Bun 1.2+

### Modo Desenvolvimento
```bash
cd /home/user/Documents/projects/caderno-reader

# Rodar a interface web com Vite
npm run dev
```

### Build do Projeto
```bash
# Compila o frontend e os scripts do Electron
npm run build
```

### Gerar AppImage para Linux
```bash
npm run package:appimage
```

O binário executável será gerado em:
`dist-package/Caderno Reader-1.0.0.AppImage`

Para executá-lo diretamente no Linux:
```bash
chmod +x "dist-package/Caderno Reader-1.0.0.AppImage"
./dist-package/Caderno\ Reader-1.0.0.AppImage
```

---

## 5. Licença e Autoria
Desenvolvido de forma independente para **Paulo Germano**, mantendo separação estrita em relação ao repositório do site pessoal.
