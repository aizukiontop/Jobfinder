import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const modules = new Map()

export function loadTypeScript(filename) {
  filename = path.resolve(filename)
  if (!path.extname(filename)) filename += '.ts'
  if (modules.has(filename)) return modules.get(filename).exports
  const module = { exports: {} }
  modules.set(filename, module)
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const execute = runInThisContext('(function(require,module,exports){\n' + outputText + '\n})', { filename })
  execute(specifier => specifier.startsWith('.')
    ? loadTypeScript(path.resolve(path.dirname(filename), specifier))
    : require(specifier), module, module.exports)
  return module.exports
}
