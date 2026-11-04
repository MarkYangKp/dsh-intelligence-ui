// 把含 JSX 的运行时编译成 Node 可导入的 ESM，供测试验证编译器发射的程序可解析。
// Compiles the JSX runtime into an ESM file that Node-based tests can import. The output
// lives in lib/ with an .mjs suffix so bundlers do not pick it up.
import { build } from 'esbuild'
import { existsSync, statSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, 'openui-runtime.jsx')
const out = join(here, '..', 'lib', 'openui-runtime.node.mjs')

const watched = ['openui-runtime.jsx', 'render-safety.jsx', 'world-map.mjs']
for (const file of readdirSync(join(here, 'ui'))) watched.push(join('ui', file))
if (
  !existsSync(out) ||
  watched.some((file) => statSync(join(here, file)).mtimeMs > statSync(out).mtimeMs)
) {
  await build({
    entryPoints: [src],
    outfile: out,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    bundle: true,
    packages: 'external',
    target: 'node24',
    logLevel: 'silent'
  })
}

export const { evaluateProgram, library } = await import(out)
