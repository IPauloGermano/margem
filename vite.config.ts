import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'));

function lucideDirectImports(): Plugin {
  const barrelPath = path.resolve(__dirname, 'node_modules/lucide-react/dist/esm/lucide-react.mjs');
  const iconMap = new Map<string, string>();

  try {
    const barrelContent = readFileSync(barrelPath, 'utf-8');
    for (const line of barrelContent.split('\n')) {
      const match = line.match(/^export\s*\{([^}]+)\}\s*from\s*'(\.\/icons\/[^']+)'/);
      if (!match) continue;
      const targetPath = `lucide-react/dist/esm/${match[2].slice(2)}`;
      for (const specifier of match[1].split(',')) {
        const aliasMatch = specifier.trim().match(/^default\s+as\s+(\w+)$/);
        if (aliasMatch) {
          iconMap.set(aliasMatch[1], targetPath);
        }
      }
    }
  } catch {
    // Fallback silencioso caso o pacote mude de estrutura
  }

  return {
    name: 'lucide-direct-imports',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules') || !code.includes('lucide-react') || iconMap.size === 0) {
        return null;
      }

      let changed = false;
      const transformed = code.replace(
        /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]\s*;?/g,
        (fullMatch, importsBlock: string) => {
          const directLines: string[] = [];
          const remainingSpecifiers: string[] = [];

          for (const rawSpec of importsBlock.split(',')) {
            const spec = rawSpec.trim();
            if (!spec) continue;
            if (spec.startsWith('type ')) {
              remainingSpecifiers.push(spec);
              continue;
            }
            const parts = spec.split(/\s+as\s+/);
            const imported = parts[0].trim();
            const local = (parts[1] ?? parts[0]).trim();
            const target = iconMap.get(imported);
            if (target) {
              directLines.push(`import ${local} from '${target}';`);
            } else {
              remainingSpecifiers.push(spec);
            }
          }

          if (directLines.length === 0) return fullMatch;
          changed = true;
          if (remainingSpecifiers.length > 0) {
            directLines.push(`import { ${remainingSpecifiers.join(', ')} } from 'lucide-react';`);
          }
          return directLines.join('\n');
        }
      );

      return changed ? { code: transformed, map: null } : null;
    }
  };
}

const VIRTUAL_MERMAID_ID = '\0virtual:mermaid-prebuilt';
const MERMAID_SENTINEL = '__MERMAID_PREBUILT_SENTINEL__';

function mermaidPrebuiltBundle(): Plugin {
  const mermaidMinPath = path.resolve(__dirname, 'node_modules/mermaid/dist/mermaid.min.js');

  return {
    name: 'mermaid-prebuilt-bundle',
    apply: 'build',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'mermaid') {
        return VIRTUAL_MERMAID_ID;
      }
      return null;
    },
    load(id) {
      if (id === VIRTUAL_MERMAID_ID) {
        return `const mermaid = "${MERMAID_SENTINEL}"; export default mermaid;`;
      }
      return null;
    },
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && item.name === 'vendor-mermaid') {
          const rawMermaid = readFileSync(mermaidMinPath, 'utf-8').replace(
            'globalThis["mermaid"] = globalThis.__esbuild_esm_mermaid_nm["mermaid"].default;',
            'globalThis["mermaid"] = __esbuild_esm_mermaid_nm["mermaid"].default;'
          );
          item.code = `${rawMermaid}\n${item.code.replace(`"${MERMAID_SENTINEL}"`, 'globalThis["mermaid"]')}`;
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [lucideDirectImports(), mermaidPrebuiltBundle(), react(), tailwindcss()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    chunkSizeWarningLimit: 3700,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('preload-helper')
          ) {
            return 'vendor-react';
          }
          if (id.includes('pdfjs-dist')) {
            return 'vendor-pdf';
          }
          if (id.includes('jszip')) {
            return 'vendor-epub';
          }
          if (id.includes('marked') || id.includes('dompurify')) {
            return 'vendor-parser-utils';
          }
          if (id.includes('katex')) {
            return 'vendor-katex';
          }
          if (id.includes('mermaid')) {
            return 'vendor-mermaid';
          }
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 5173),
    strictPort: false
  }
});
