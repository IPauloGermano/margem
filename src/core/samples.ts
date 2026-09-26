export const SAMPLE_ESSAY_MD = `---
title: "A Arte da Leitura Tipográfica e a Construção de Leitores Digitais"
author: "Paulo Germano"
description: "Reflexões sobre design de leitura, tipografia editorial e a arquitetura de sistemas desacoplados para documentos — com demonstração viva dos recursos do leitor."
---

# A Arte da Leitura Tipográfica e a Construção de Leitores Digitais

A leitura prolongada em telas digitais impõe um desafio de engenharia e ergonomia visual. Diferente de feeds de redes sociais, desenhados para retenção rápida e fragmentação de atenção, um ambiente de leitura de livros ou artigos densos exige **calmaria**, **ritmo contínuo** e **fidelidade tipográfica**.

Este próprio texto é uma demonstração: ele foi escrito para exercitar cada recurso do leitor. Navegue pelo sumário lateral (\`Ctrl+B\`), troque de tema (\`Ctrl+,\`), busque qualquer termo (\`Ctrl+F\`) e grife à vontade — nada aqui é maquete, tudo responde de verdade.

Quando projetamos uma interface para livros digitais, estamos em contato direto com séculos de evolução da imprensa: desde as proporções de margem dos escribas medievais até as fundições tipográficas que definiram o renascimento veneziano.

> "A tipografia bem-feita deve ser invisível: uma taça de cristal límpido que permite apreciar o vinho sem que a forma do vidro roube a cena." — Beatrice Warde

---

# Os Pilares do Conforto Visual

Para que uma interface de leitura seja confortável por horas seguidas, três fatores essenciais precisam operar em harmonia:

## A Paleta de Contraste Suave

Branco puro (\`#FFFFFF\`) contra preto absoluto (\`#000000\`) gera fadiga visual por excesso de contraste retiniano. O uso de cinzas quentes (*Warm Charcoal*) e tons de linho (*E-Ink Paperwhite*) amortece o brilho da tela sem perder a nitidez. Experimente os quatro temas no painel de aparência e perceba como o mesmo parágrafo muda de humor:

| Tema | Canvas | Quando usar |
| --- | --- | --- |
| Warm Charcoal | \`#1C1B19\` | Leitura noturna, padrão do leitor |
| Paperwhite | \`#EFECE6\` | Dia claro, simula e-ink |
| Linen Sepia | \`#F4EFE6\` | Romance e textos longos |
| Pitch Black | \`#0A0A09\` | Telas OLED no escuro total |

## A Largura da Linha (Measure)

O olho humano lê com maior fluidez em linhas contendo entre 60 e 75 caracteres (aproximadamente 650px a 780px de largura). Linhas muito longas cansam o leitor na transição para a linha seguinte. A relação pode ser estimada assim:

$$
CPL = \\frac{Medida\\ (px)}{0,5 \\times Fonte\\ (px)}
$$

Ou seja: com fonte de $18px$ e medida de $780px$, obtemos cerca de 86 toques por linha — dentro da faixa confortável quando somamos o entrelinhamento de $1,4$ a $2,2$ ajustável no painel.

## Hierarquia e Respiração

Espaçamentos verticais calculados dão ritmo à prosa. Repare como os títulos deste artigo alimentam sozinhos o sumário lateral — cada \`#\`, \`##\` e \`###\` vira um ponto de navegação, sem nenhum índice manual:

\`\`\`typescript
// Exemplo de configuração tipográfica ideal
export const readerTokens = {
  measure: "780px",
  lineHeight: 1.75,
  fontFamily: "Source Serif 4, Newsreader, Georgia, serif",
  contrastRatio: "AAA"
};
\`\`\`

Blocos de código como o acima ganham realce de sintaxe e botão de cópia automaticamente.

---

# Arquitetura Extensível para Documentos

A engenharia por trás deste leitor foi estruturada para ser independente de formato específico:

* **O Registro de Parsers (\`ParserRegistry\`):**
  Atua como ponto central de despacho. Cada formato implementa a interface \`DocumentParser\`.
* **Desacoplamento de Renderização:**
  O motor de leitura lida apenas com seções padronizadas, sumários e percentual de rolagem, sem saber se a fonte original veio de um arquivo \`.epub\`, \`.md\` ou \`.txt\`.
* **Higienização na Fronteira:**
  Todo HTML que chega à tela passa por sanitização (DOMPurify), então até documentos vindos de terceiros são renderizados sem risco de scripts embutidos.
* **Persistência Atômica:**
  O progresso de leitura é salvo continuamente por documento, permitindo fechar o aplicativo e retornar exatamente à frase em que você parou.

O percurso de um arquivo até os seus olhos segue este fluxo:

\`\`\`mermaid
graph TD
  A[Documento md txt epub pdf] --> B[ParserRegistry]
  B --> C[Secoes + Sumario + TOC]
  C --> D[Sanitizacao DOMPurify]
  D --> E[Leitor tipografico]
  E --> F[Grifos, notas e exportacao]
\`\`\`

Vale notar que fórmulas como a da seção anterior e diagramas como este são renderizados nativamente — matemática com KaTeX e fluxos com Mermaid, sem plugins externos.

---

# Ler, Marcar e Exportar

Ler é só metade do trabalho; a outra metade é **reter**. Selecione qualquer trecho deste parágrafo com o mouse para abrir a barra de grifos: três cores (ideia-chave, fato/exemplo, vocabulário) e um campo de nota ancorada exatamente na frase. Pressione \`Ctrl+D\` em qualquer ponto para criar um marcador de posição com data e percentual.

Tudo o que você grifa pode sair do aplicativo em Markdown pronto para o Obsidian — frontmatter YAML, citações em blockquote e agrupamento por capítulo. É assim que anotações de leitura viram Zettelkasten sem copiar e colar.

Alguns hábitos que este leitor recompensa:

1. **Importe pastas inteiras** — arraste um diretório para a estante: cada livro é empacotado com capítulos ordenados, capa detectada e metadados lidos.
2. **Edite fora, releia dentro** — altere o \`.md\` no seu editor favorito e o capítulo recarrega sozinho na tela (sincronização de pasta).
3. **Navegue sem mouse** — \`J\`/\`K\` rolam, \`[\`/\`]\` trocam de capítulo, \`?\` abre o guia completo.
4. **Cole um link do YouTube** em linha isolada num documento e ele vira um cartão de vídeo assistível sem sair da página.

Boa leitura e bons estudos!
`;

export const SAMPLE_TEXT_TXT = `O LIVRO DAS PEQUENAS COISAS
Autor: Machado de Assis (Edição de Exemplo)

CAPÍTULO I
Do Início das Idéias

Havia naqueles dias uma quietude singular pelas ruas de terra batida. O sol de outono dourava as copas das figueiras antigas, e as sombras alongavam-se pela calçada com uma lentidão quase meditativa. 

A leitura, dizia ele enquanto ajeitava os óculos de aros de prata, não é mero passatempo: é a arte silenciosa de conversar com os mortos e aprender a paciência dos séculos. Quem corre não lê; quem lê descobre que a pressa é a ilusão dos que não têm para onde ir.

CAPÍTULO II
Das Horas Noturnas e da Vigília

Quando a cidade adormecia sob o manto escuro da madrugada, acendia-se a lamparina sobre a escrivaninha de jacarandá. As traças voavam em círculos concêntricos ao redor da chama trêmula, como filósofos perseguindo uma verdade inalcançável.

Ali, rodeado de fólios amarelados e cadernos encadernados à mão, o mundo exterior deixava de existir. Não havia urgências, prazos ou notificações: apenas o tilintar da pena sobre o papel áspero e o eco compassado do relógio de parede.
`;
