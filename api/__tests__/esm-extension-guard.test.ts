/**
 * ESM extension guard (regression test for the 2026-06-03 capture-500 incident).
 *
 * ROOT CAUSE: `src/lib/paintCalculator.ts` imported `'../data/paintPalette'`
 * with NO `.js` extension. The frontend (Vite/Vitest) resolves extensionless
 * relative imports fine, so build + unit tests stayed green. But Vercel ships
 * serverless functions as native Node ESM, and Node ESM requires explicit
 * file extensions. Because `api/merchants-router.ts` transitively imports that
 * src file (via the paint-calc handler), the WHOLE function crashed at
 * module-load on Vercel — every route (capture PDF, calc, signup, calibrate,
 * upload) returned HTTP 500 FUNCTION_INVOCATION_FAILED in production.
 *
 * This test walks the dependency graph of every `src/**` module reachable
 * from an `api/**` function and asserts that EVERY relative value-import
 * carries an explicit `.js` extension — the exact invariant Node ESM needs.
 * If a future edit drops an extension on an api-reachable src file, this
 * fails locally instead of 500-ing in prod.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import ts from 'typescript';

const REPO_ROOT = resolve(__dirname, '..', '..');

/** Parse multiline declarations as well as mixed value/type imports. */
function valueSpecifiers(source: string) {
  const file = ts.createSourceFile('module.ts', source, ts.ScriptTarget.Latest, true);
  const specs: { spec: string; jsonAttribute: boolean }[] = [];
  function property(object: ts.Expression | undefined, key: string): ts.Expression | undefined {
    if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
    const found = object.properties.find((item): item is ts.PropertyAssignment => ts.isPropertyAssignment(item)
      && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === key);
    return found?.initializer;
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const module = node.moduleSpecifier;
      const imports = ts.isImportDeclaration(node) ? node.importClause : undefined;
      const bindings = imports?.namedBindings;
      const exports = ts.isExportDeclaration(node) ? node.exportClause : undefined;
      const typeOnly = imports?.isTypeOnly || (ts.isExportDeclaration(node) && node.isTypeOnly)
        || (imports && !imports.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every(e => e.isTypeOnly))
        || (exports && ts.isNamedExports(exports) && exports.elements.length > 0 && exports.elements.every(e => e.isTypeOnly));
      if (!typeOnly && module && ts.isStringLiteral(module)) specs.push({
        spec: module.text,
        jsonAttribute: !!node.attributes?.elements.some(attribute => attribute.name.text === 'type' && ts.isStringLiteral(attribute.value) && attribute.value.text === 'json'),
      });
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length && ts.isStringLiteral(node.arguments[0])) {
      const type = property(property(node.arguments[1], 'with'), 'type');
      specs.push({ spec: node.arguments[0].text, jsonAttribute: !!type && ts.isStringLiteral(type) && type.text === 'json' });
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return specs;
}

/** Discover API→src edges so newly shared engines cannot evade the guard. */
function apiSourceFiles(directory = join(REPO_ROOT, 'api')): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : apiSourceFiles(join(directory, entry.name));
    return entry.name.endsWith('.ts') ? [relative(REPO_ROOT, join(directory, entry.name))] : [];
  });
}

function resolveTsPath(fromFile: string, spec: string): string | null {
  const base = join(dirname(fromFile), spec.replace(/\.js$/, ''));
  for (const cand of [`${base}.ts`, `${base}.tsx`]) {
    if (existsSync(resolve(REPO_ROOT, cand))) return cand;
  }
  return null;
}

function collectGraph(entry: string, seen: Set<string>, violations: string[]): void {
  if (seen.has(entry)) return;
  seen.add(entry);
  const abs = resolve(REPO_ROOT, entry);
  if (!existsSync(abs)) return;
  const src = readFileSync(abs, 'utf8');
  for (const { spec, jsonAttribute } of valueSpecifiers(src)) {
    if (!spec.startsWith('.')) continue;
    if (spec.endsWith('.json')) {
      if (!jsonAttribute) violations.push(`${entry} → '${spec}' (missing JSON import attribute)`);
      continue;
    }
    if (!spec.endsWith('.js')) {
      violations.push(`${entry} → '${spec}' (missing .js extension)`);
      continue;
    }
    const next = resolveTsPath(entry, spec);
    if (next) collectGraph(next, seen, violations);
    else violations.push(`${entry} → '${spec}' (target file not found; directory imports are unsupported)`);
  }
}

describe('ESM extension guard (api-reachable src modules)', () => {
  it('every relative value-import in the api→src graph has an explicit .js extension', () => {
    const violations: string[] = [];
    const seen = new Set<string>();
    for (const entry of apiSourceFiles()) {
      for (const { spec } of valueSpecifiers(readFileSync(resolve(REPO_ROOT, entry), 'utf8'))) {
        const next = resolveTsPath(entry, spec);
        if (next?.replaceAll('\\', '/').startsWith('src/')) collectGraph(next, seen, violations);
      }
    }
    expect(violations, `Node-ESM resolution would 500 on Vercel:\n${violations.join('\n')}`).toEqual([]);
  });
  it('includes multiline and mixed imports while ignoring erased types', () => {
    expect(valueSpecifiers("import { value,\n type Shape\n} from './engine.js';\nimport type { Only } from './type';\nimport { type Also } from './type';\nexport { value } from './value.js';\nconst load = () => import('./lazy.js');").map(entry => entry.spec)).toEqual(['./engine.js', './value.js', './lazy.js']);
  });
});
