export const SAMPLE_ESSAY_MD = `---
title: "A Arte da Leitura Tipográfica e a Construção de Leitores Digitais"
author: "Paulo Germano"
description: "Reflexões sobre design de leitura, tipografia editorial e a arquitetura de sistemas desacoplados para documentos."
---

# A Arte da Leitura Tipográfica e a Construção de Leitores Digitais

A leitura prolongada em telas digitais impõe um desafio de engenharia e ergonomia visual. Diferente de feeds de redes sociais, desenhados para retenção rápida e fragmentação de atenção, um ambiente de leitura de livros ou artigos densos exige **calmaria**, **ritmo contínuo** e **fidelidade tipográfica**.

Quando projetamos uma interface para livros digitais, estamos em contato direto com séculos de evolução da imprensa: desde as proporções de margem dos escribas medievais até as fundições tipográficas que definiram o renascimento veneziano.

> "A tipografia bem-feita deve ser invisível: uma taça de cristal límpido que permite apreciar o vinho sem que a forma do vidro roube a cena." — Beatrice Warde

---

# Os Pilares do Conforto Visual

Para que uma interface de leitura seja confortável por horas seguidas, três fatores essenciais precisam operar em harmonia:

1. **A Paleta de Contraste Suave:**  
   Branco puro (\`#FFFFFF\`) contra preto absoluto (\`#000000\`) gera fadiga visual por excesso de contraste retiniano. O uso de cinzas quentes (*Warm Charcoal*) e tons de linho (*E-Ink Paperwhite*) amortece o brilho da tela sem perder a nitidez.

2. **A Largura da Linha (Measure):**  
   O olho humano lê com maior fluidez em linhas contendo entre 60 e 75 caracteres (aproximadamente 650px a 780px de largura). Linhas muito longas cansam o leitor na transição para a linha seguinte.

3. **Hierarquia e Respiração:**  
   Espaçamentos verticais calculados (\`line-height\` entre 1.6 e 1.85) dão ritmo à prosa.

\`\`\`typescript
// Exemplo de configuração tipográfica ideal
export const readerTokens = {
  measure: "780px",
  lineHeight: 1.75,
  fontFamily: "Source Serif 4, Newsreader, Georgia, serif",
  contrastRatio: "AAA"
};
\`\`\`

---

# Arquitetura Extensível para Documentos

A engenharia por trás deste leitor foi estruturada para ser independente de formato específico:

* **O Registro de Parsers (\`ParserRegistry\`):**  
  Atua como ponto central de despacho. Cada formato implementa a interface \`DocumentParser\`.
* **Desacoplamento de Renderização:**  
  O motor de leitura lida apenas com seções padronizadas, sumários e percentual de rolagem, sem saber se a fonte original veio de um arquivo \`.epub\`, \`.md\` ou \`.txt\`.
* **Persistência Atômica:**  
  O progresso de leitura é salvo continuamente por documento, permitindo fechar o aplicativo e retornar exatamente à frase em que você parou.

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
