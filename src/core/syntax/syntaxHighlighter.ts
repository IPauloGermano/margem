/**
 * src/core/syntax/syntaxHighlighter.ts
 * Motor de syntax highlighting editorial, leve e seguro para o Margem.
 * Zero dependências externas; preserva indentação exata e whitespace.
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface GrammarRule {
  type: string;
  regex: RegExp;
}

// Gramáticas por família de linguagem
const GRAMMARS: Record<string, GrammarRule[]> = {
  typescript: [
    { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/ },
    {
      type: 'keyword',
      regex: /\b(?:import|export|from|as|const|let|var|function|return|class|interface|type|extends|implements|if|else|for|while|do|try|catch|finally|switch|case|default|break|continue|new|delete|typeof|instanceof|void|async|await|yield|in|of|throw|static|public|private|protected|readonly|abstract|declare|namespace|enum)\b/
    },
    { type: 'boolean', regex: /\b(?:true|false|null|undefined|NaN|Infinity)\b/ },
    { type: 'number', regex: /\b(?:0x[\da-fA-F]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/ },
    { type: 'type', regex: /\b(?:string|number|boolean|any|unknown|never|void|object|symbol|bigint)\b|\b[A-Z][\w$]*/ },
    { type: 'function', regex: /\b[a-zA-Z_$][\w$]*(?=\s*\()/ },
    { type: 'operator', regex: /=>|===|!==|==|!=|<=|>=|\+\+|--|&&|\|\||\?\.|\?\?|[+\-*/%&|^~!=<>?:|]/ },
    { type: 'punctuation', regex: /[{}[\]();,.]/ }
  ],

  python: [
    { type: 'comment', regex: /#[^\n]*/ },
    { type: 'string', regex: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
    {
      type: 'keyword',
      regex: /\b(?:def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|global|nonlocal|lambda|pass|raise|break|continue|yield|async|await|assert|del|in|is|not|and|or)\b/
    },
    { type: 'boolean', regex: /\b(?:True|False|None)\b/ },
    {
      type: 'type',
      regex: /\b(?:int|float|str|bool|list|dict|set|tuple|bytes|bytearray|object|type|self|cls)\b|\b[A-Z]\w*/
    },
    { type: 'number', regex: /\b(?:0x[\da-fA-F]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?j?)\b/ },
    { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\s*\()/ },
    { type: 'operator', regex: /==|!=|<=|>=|\/\/|\*\*|->|[+\-*/%&|^~!=<>]/ },
    { type: 'punctuation', regex: /[{}[\]();,.:]/ }
  ],

  json: [
    { type: 'property', regex: /"(?:\\.|[^"\\])*"\s*(?=:)/ },
    { type: 'string', regex: /"(?:\\.|[^"\\])*"/ },
    { type: 'number', regex: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/ },
    { type: 'boolean', regex: /\b(?:true|false|null)\b/ },
    { type: 'punctuation', regex: /[{}[\]:,]/ }
  ],

  html: [
    { type: 'comment', regex: /<!--[\s\S]*?-->/ },
    { type: 'tag', regex: /<\/?[a-zA-Z0-9:-]+(?=[\s/>]|$)/ },
    { type: 'property', regex: /\b[a-zA-Z0-9:-]+(?=\=)/ },
    { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
    { type: 'punctuation', regex: /[/<>=]/ }
  ],

  css: [
    { type: 'comment', regex: /\/\*[\s\S]*?\*\// },
    { type: 'property', regex: /\b[a-zA-Z-]+(?=\s*:)/ },
    { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
    { type: 'type', regex: /\.[a-zA-Z0-9_-]+|#[a-zA-Z0-9_-]+/ },
    { type: 'number', regex: /\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|s|ms|deg)?\b/ },
    { type: 'keyword', regex: /!important|\b(?:inherit|initial|unset|none|block|flex|grid|auto)\b/ },
    { type: 'punctuation', regex: /[{}[\]();:,.]/ }
  ],

  bash: [
    { type: 'comment', regex: /#[^\n]*/ },
    { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
    {
      type: 'keyword',
      regex: /\b(?:echo|cd|ls|mkdir|rm|cp|mv|cat|grep|chmod|chown|git|npm|node|npx|cargo|python|python3|docker|curl|wget|export|source|if|then|else|elif|fi|for|in|do|done|while|case|esac|function|return|exit|sudo)\b/
    },
    { type: 'variable', regex: /\$[a-zA-Z0-9_]+|\$\{[^}]+\}/ },
    { type: 'operator', regex: /\|\||&&|>>|>|<|\||;/ },
    { type: 'punctuation', regex: /[{}[\]()]/ }
  ],

  rust: [
    { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    { type: 'string', regex: /b?"(?:\\.|[^"\\])*"|b?'(?:\\.|[^'\\])*'/ },
    {
      type: 'keyword',
      regex: /\b(?:as|async|await|break|const|continue|crate|dyn|else|enum|extern|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|type|union|unsafe|use|where|while)\b/
    },
    { type: 'boolean', regex: /\b(?:true|false)\b/ },
    {
      type: 'type',
      regex: /\b(?:i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str|String|Vec|Option|Some|None|Result|Ok|Err|Box|Rc|Arc)\b|\b[A-Z]\w*/
    },
    { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\s*\()/ },
    { type: 'number', regex: /\b(?:0x[\da-fA-F_]+|0b[01_]+|0o[0-7_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?(?:i\d+|u\d+|f\d+)?)\b/ },
    { type: 'operator', regex: /=>|->|::|==|!=|<=|>=|\+\+|--|&&|\|\||[+\-*/%&|^~!=<>?:|]/ },
    { type: 'punctuation', regex: /[{}[\]();,.]/ }
  ],

  go: [
    { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`/ },
    {
      type: 'keyword',
      regex: /\b(?:break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/
    },
    { type: 'boolean', regex: /\b(?:true|false|nil|iota)\b/ },
    {
      type: 'type',
      regex: /\b(?:bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr)\b|\b[A-Z]\w*/
    },
    { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\s*\()/ },
    { type: 'number', regex: /\b(?:0x[\da-fA-F]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?i?)\b/ },
    { type: 'operator', regex: /:=|==|!=|<=|>=|<-|\+\+|--|&&|\|\||[+\-*/%&|^~!=<>?:|]/ },
    { type: 'punctuation', regex: /[{}[\]();,.]/ }
  ],

  sql: [
    { type: 'comment', regex: /--[^\n]*|\/\*[\s\S]*?\*\// },
    { type: 'string', regex: /'(?:''|\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/ },
    {
      type: 'keyword',
      regex: /\b(?:SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|AS|DISTINCT|UNION|ALL|CREATE|TABLE|DROP|ALTER|VIEW|INDEX|AND|OR|NOT|IN|BETWEEN|LIKE|IS|NULL|EXISTS|CASE|WHEN|THEN|ELSE|END|PRIMARY|KEY|FOREIGN|REFERENCES|CHECK|DEFAULT|CONSTRAINT)\b/i
    },
    {
      type: 'type',
      regex: /\b(?:INT|INTEGER|BIGINT|SMALLINT|TINYINT|VARCHAR|CHAR|TEXT|BOOLEAN|DATE|TIMESTAMP|DATETIME|TIME|FLOAT|DOUBLE|DECIMAL|NUMERIC|BLOB|JSON)\b/i
    },
    { type: 'number', regex: /\b\d+(?:\.\d+)?\b/ },
    { type: 'operator', regex: /<>|!=|<=|>=|:=|[=+\-*/%<>&|^]/ },
    { type: 'punctuation', regex: /[();,.]/ }
  ],

  clike: [
    { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
    {
      type: 'keyword',
      regex: /\b(?:auto|break|case|catch|class|const|continue|default|do|else|enum|explicit|export|extern|final|finally|for|goto|if|inline|namespace|new|noexcept|nullptr|operator|override|private|protected|public|return|sizeof|static|struct|switch|template|this|throw|try|typedef|typename|union|using|virtual|while)\b/
    },
    { type: 'boolean', regex: /\b(?:true|false|NULL|nullptr)\b/ },
    {
      type: 'type',
      regex: /\b(?:void|bool|char|int|short|long|float|double|signed|unsigned|size_t|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|string)\b|\b[A-Z]\w*/
    },
    { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\s*\()/ },
    { type: 'number', regex: /\b(?:0x[\da-fA-F]+|0b[01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?:[uUlLfF]+)?)\b/ },
    { type: 'operator', regex: /::|->|==|!=|<=|>=|\+\+|--|&&|\|\||[+\-*/%&|^~!=<>?:|]/ },
    { type: 'punctuation', regex: /[{}[\]();,.]/ }
  ]
};

// Aliases para identificadores comuns de linguagem
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'typescript',
  jsx: 'typescript',
  javascript: 'typescript',
  typescript: 'typescript',

  py: 'python',
  python: 'python',

  json: 'json',

  html: 'html',
  xml: 'html',
  svg: 'html',

  css: 'css',
  scss: 'css',
  sass: 'css',

  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  shell: 'bash',

  rs: 'rust',
  rust: 'rust',

  go: 'go',
  golang: 'go',

  sql: 'sql',

  c: 'clike',
  cpp: 'clike',
  'c++': 'clike',
  h: 'clike',
  hpp: 'clike',
  java: 'clike',
  cs: 'clike',
  csharp: 'clike'
};

// Cache de regexes compiladas para performance instantânea
const COMPILED_REGEX_CACHE = new Map<string, { regex: RegExp; rules: GrammarRule[] }>();

function getCompiledGrammar(canonicalLang: string): { regex: RegExp; rules: GrammarRule[] } | null {
  const rules = GRAMMARS[canonicalLang];
  if (!rules) return null;

  let cached = COMPILED_REGEX_CACHE.get(canonicalLang);
  if (!cached) {
    const combinedSource = rules.map((r, i) => `(?<G${i}>${r.regex.source})`).join('|');
    cached = {
      regex: new RegExp(combinedSource, 'g'),
      rules
    };
    COMPILED_REGEX_CACHE.set(canonicalLang, cached);
  }
  return cached;
}

/**
 * Normaliza o identificador de linguagem informado no markdown
 */
export function normalizeLanguage(lang?: string): string {
  if (!lang) return '';
  const clean = lang.trim().toLowerCase().split(/\s+/)[0];
  return LANGUAGE_ALIASES[clean] || clean;
}

/**
 * Retorna o nome amigável para exibição discreta no cabeçalho do bloco
 */
export function getLanguageDisplayName(lang?: string): string {
  if (!lang) return '';
  const clean = lang.trim().toLowerCase().split(/\s+/)[0];
  const canonical = LANGUAGE_ALIASES[clean] || clean;

  const names: Record<string, string> = {
    typescript: 'TypeScript',
    python: 'Python',
    json: 'JSON',
    html: 'HTML',
    css: 'CSS',
    bash: 'Bash',
    rust: 'Rust',
    go: 'Go',
    sql: 'SQL',
    clike: clean.toUpperCase() === 'C' ? 'C' : clean.toUpperCase() === 'CPP' || clean === 'c++' ? 'C++' : clean
  };

  return names[canonical] || clean.toUpperCase();
}

/**
 * Executa o highlighting gramatical de um trecho de código
 */
export function highlightCode(code: string, lang?: string): string {
  const canonical = normalizeLanguage(lang);
  const compiled = canonical ? getCompiledGrammar(canonical) : null;

  // Fallback neutro: sem linguagem conhecida, apenas escapa mantendo indentação exata
  if (!compiled) {
    return escapeHtml(code);
  }

  const { regex, rules } = compiled;
  regex.lastIndex = 0;

  let output = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    // Texto plano antes do token
    if (match.index > lastIndex) {
      output += escapeHtml(code.slice(lastIndex, match.index));
    }

    // Identifica qual regra bateu pelo grupo nomeado
    let tokenType = 'plain';
    const groups = match.groups;
    if (groups) {
      for (let i = 0; i < rules.length; i++) {
        if (groups[`G${i}`] !== undefined) {
          tokenType = rules[i].type;
          break;
        }
      }
    }

    output += `<span class="hl-${tokenType}">${escapeHtml(match[0])}</span>`;
    lastIndex = regex.lastIndex;
  }

  // Segmento final de texto plano
  if (lastIndex < code.length) {
    output += escapeHtml(code.slice(lastIndex));
  }

  return output;
}

/**
 * Constrói o HTML estruturado do bloco de código com estética editorial e scroll horizontal contido
 */
export function renderHighlightedCodeBlock(codeText: string, lang?: string): string {
  const cleanLang = (lang || '').trim().toLowerCase();
  const highlighted = highlightCode(codeText, cleanLang);
  const displayLang = cleanLang ? getLanguageDisplayName(cleanLang) : '';
  const badgeText = (displayLang || 'CÓDIGO').toUpperCase();

  return `<div class="reader-code-block group relative my-6 rounded-lg border border-[var(--border-rule-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
  <div class="reader-code-header flex items-center justify-between px-3.5 py-1.5 border-b border-[var(--border-rule-subtle)]/60 bg-[var(--bg-canvas)]/35 text-[11px] font-mono text-[var(--text-muted)] select-none">
    <span class="reader-code-lang tracking-wider font-medium">${badgeText}</span>
    <button type="button" class="reader-code-copy-btn p-1 px-2 rounded text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all cursor-pointer select-none" title="Copiar código" aria-label="Copiar código">Copiar</button>
  </div>
  <pre class="reader-code-pre p-3.5 sm:p-4 overflow-x-auto font-mono text-xs sm:text-[13px] leading-relaxed text-[var(--text-primary)] select-text"><code class="language-${cleanLang || 'text'}">${highlighted}</code></pre>
</div>\n`;
}
