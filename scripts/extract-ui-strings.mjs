import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Inventory only: do not rewrite source records or application code.
const root = path.resolve(import.meta.dirname, '..');
const files = ['app/workbench.tsx', 'app/knowledge-graph.tsx', 'app/heritage-map.tsx', 'lib/knowledge-graph.ts', 'lib/map-style.ts'];
const occurrences = new Map();
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const value = node.text.trim().replace(/\s+/g, ' ');
      if (/[\u3400-\u9fff]/.test(value)) {
        const locations = occurrences.get(value) || [];
        locations.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
        occurrences.set(value, locations);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'lib/en-ui.json'), 'utf8'));
const missing = [...occurrences].filter(([value]) => !Object.hasOwn(dictionary, value));
if (process.argv.includes('--missing')) {
  console.log(JSON.stringify(missing.map(([text, locations]) => ({ text, locations })), null, 2));
} else if (process.argv.includes('--check')) {
  console.log(JSON.stringify({ strings: occurrences.size, translated: occurrences.size - missing.length, missing: missing.length }, null, 2));
  if (missing.length) process.exitCode = 1;
} else {
  console.log(JSON.stringify([...occurrences].map(([text, locations]) => ({ text, translation: dictionary[text] ?? null, locations })), null, 2));
}
