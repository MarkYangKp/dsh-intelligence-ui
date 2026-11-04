// 语料回归：56 段自编的合成程序（已去标识化），必须全部零错误渲染。
// 它们不是普通示例，而是刻意覆盖模型输出常见写法的回归样本——任何解析/求值/渲染容错回归都会在这里暴露。
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// 先确保 Node 版运行时存在（构建产物，不在版本库中）
await import('../src/compiler-runtime-check.mjs')
const { evaluateProgram, renderTree } = await import('../lib/openui-runtime.node.mjs')

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, 'corpus')
const files = readdirSync(dir)
  .filter((n) => n.endsWith('.openui'))
  .sort()
let pass = 0
const failures = []
for (const f of files) {
  const code = readFileSync(join(dir, f), 'utf8')
  const { root, errors } = evaluateProgram(code)
  let html = ''
  try {
    html = root ? renderToStaticMarkup(renderTree(root)) : ''
  } catch (e) {
    failures.push({ f, why: 'render threw: ' + e.message })
    continue
  }
  const flatErrors = errors.map((e) => e.message ?? String(e))
  if (!root) failures.push({ f, why: 'no root', errors: flatErrors.slice(0, 3) })
  else if (flatErrors.length > 0)
    failures.push({ f, why: `${flatErrors.length} errors`, errors: flatErrors.slice(0, 3) })
  else if (html.includes('解析失败')) failures.push({ f, why: 'error box rendered' })
  else if (html.length < 120) failures.push({ f, why: 'empty render', len: html.length })
  else pass++
}
for (const f of failures) {
  console.log('❌', f.f, '—', f.why)
  for (const e of f.errors ?? []) console.log('    ', e)
}
console.log(`\n${pass}/${files.length} 通过，${failures.length} 失败`)
process.exit(failures.length > 0 ? 1 : 0)
