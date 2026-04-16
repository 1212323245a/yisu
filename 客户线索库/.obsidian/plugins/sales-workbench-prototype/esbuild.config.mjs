import esbuild from 'esbuild';
import { readFileSync } from 'fs';

const prod = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const banner = `/*
 =====================================================
  Sales Workbench Plugin - Native Obsidian Views
  Rebuilt from iframe-based prototype
 =====================================================
*/
`;

const cssFiles = [
  'src/styles/design-tokens.css',
  'src/styles/cyber-effects.css',
  'src/styles/shared-components.css',
  'src/styles/obsidian-override.css',
  'src/styles/workbench-lead.css',
  'src/styles/workbench-review.css',
  'src/styles/workbench-ops.css'
];

async function build() {
  // Read all CSS files and combine
  let combinedCSS = '';
  for (const file of cssFiles) {
    try {
      combinedCSS += readFileSync(file, 'utf8') + '\n';
    } catch (e) {
      // File might not exist yet, skip
    }
  }

  const ctx = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle: true,
    external: ['obsidian', 'fs', 'path', 'electron'],
    format: 'cjs',
    target: 'es2018',
    outfile: 'main.js',
    banner: { js: banner },
    minify: prod,
    sourcemap: prod ? false : 'inline',
    plugins: [
      {
        name: 'css-bundler',
        setup(build) {
          build.onEnd(() => {
            // Write combined CSS to styles.css
            if (combinedCSS) {
              import('fs').then(fs => {
                fs.writeFileSync('styles.css', combinedCSS);
              });
            }
          });
        }
      }
    ],
    logLevel: 'info',
  });

  if (isWatch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Build complete.');
  }
}

build().catch((e) => {
  console.error('Build failed:', e);
  process.exit(1);
});