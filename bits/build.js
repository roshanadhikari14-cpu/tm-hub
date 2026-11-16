// Rebuilds public/bits.js and public/bits.css from the React Bits repo.
// Run with: npm run build:bits
const path = require('path');
require('esbuild')
  .build({
    entryPoints: [path.join(__dirname, 'entry.jsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    jsx: 'automatic',
    loader: { '.js': 'jsx' },
    alias: { '@/lib/utils': path.join(__dirname, 'cn.js') },
    nodePaths: [path.join(__dirname, '..', 'node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: path.join(__dirname, '..', 'public', 'bits.js'),
    logLevel: 'info',
  })
  .then(() =>
    // Magic UI's Tailwind classes, compiled to plain CSS.
    require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'), '-i', path.join(__dirname, 'magic.css'), '-o', path.join(__dirname, '..', 'public', 'magic.css'), '--minify'], { stdio: 'inherit', cwd: path.join(__dirname, '..') })
  )
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
