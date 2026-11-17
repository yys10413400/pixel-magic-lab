import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// 빌드한 index.html 을 서버 없이(파일 더블클릭, file://) 열어도 동작하도록
// 모듈 스크립트를 일반 스크립트(defer)로 바꿉니다.
function classicScript(): Plugin {
  return {
    name: 'pml-classic-script',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>').replace(/ crossorigin(?=[ >])/g, '');
    },
  };
}

// ── 한 파일 HTML 모드 (npm run build:html) ──
// 글꼴은 woff2 만 남겨 data URI 로 넣고, 스크립트를 HTML 안에 직접 넣습니다.
function woff2Only(): Plugin {
  return {
    name: 'pml-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@fontsource') || !id.endsWith('.css')) return null;
      return code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
    },
  };
}

function inlineIntoHtml(outDir: string): Plugin {
  return {
    name: 'pml-inline-html',
    apply: 'build',
    closeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const assets = join(outDir, 'assets');
      const js = readdirSync(assets).find((f) => f.endsWith('.js'))!;
      const code = readFileSync(join(assets, js), 'utf8').replace(/<\/script/gi, '<\\/script');
      const icon = 'data:image/svg+xml;base64,' + readFileSync(join(outDir, 'favicon.svg')).toString('base64');
      const out = html
        .replace(/<script defer src="[^"]+"><\/script>/, () => '')
        .replace('./favicon.svg', icon)
        .replace('</body>', () => `<script>${code}</script>\n  </body>`);
      writeFileSync(join(outDir, '..', 'pixel-magic-lab.html'), out);
      rmSync(outDir, { recursive: true, force: true });
    },
  };
}

// base: './' → 빌드 결과를 어느 폴더(정적 호스팅, USB, 학교 서버 하위 경로)에 두어도 작동합니다.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  const outDir = single ? 'build-single-tmp' : 'dist';
  return {
    base: './',
    plugins: [react(), classicScript(), ...(single ? [woff2Only(), inlineIntoHtml(outDir)] : [])],
    build: {
      outDir,
      target: 'es2019',
      modulePreload: false,
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: single ? 10_000 : 800,
      rollupOptions: {
        output: {
          format: 'iife',
          inlineDynamicImports: true,
        },
      },
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
