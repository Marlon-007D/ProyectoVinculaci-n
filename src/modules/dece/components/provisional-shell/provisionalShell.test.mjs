import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function load(url) {
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require });
  return exports;
}

test('DECE pages render no top header, no application breadcrumb and only their own content', () => {
  const { default: ProvisionalShell } = load(new URL('./provisional-shell.tsx', import.meta.url));
  const { renderToStaticMarkup } = require('react-dom/server');
  const { createElement } = require('react');
  const html = renderToStaticMarkup(createElement(ProvisionalShell, null, createElement('h1', null, 'Casos')));
  assert.equal(html, '<main class="main-area"><h1>Casos</h1></main>');
  assert.ok(!/<header|topbar|crumb|Unidad Educativa|Año lectivo|avatar/.test(html));
});

test('no DECE component draws the old header or the previous breadcrumb label', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const walk = dir => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx$/.test(name) ? [path] : [];
  });
  for (const file of walk(root)) {
    const source = readFileSync(file, 'utf8');
    assert.ok(!source.includes('className="topbar"') && !source.includes('Unidad Educativa <span>'), file);
    assert.ok(!source.includes('aria-label="Migas de pan"'), `${file} must use the common breadcrumb name`);
  }
});
