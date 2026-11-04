// 真实浏览器加载客户端 bundle 的回归测试：
// 1) lib/client.js 能在浏览器里被 ModuleLoader 加载（无模块级引用错误）
// 2) 注册 assistant-step 渲染器并渲染一条含围栏的消息
// 3) 输出里必须有 data-openui（说明界面渲染成功），且无解析错误
import { execFileSync } from 'node:child_process'
import { existsSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { CHROME, runChrome } from './chrome.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
await import('../src/compiler-runtime-check.mjs') // 确保运行时存在（不直接使用，避免未构建时报错）

if (!CHROME) {
  console.log('⏭  跳过浏览器测试：未找到 Chrome（设置 CHROME 环境变量）')
  process.exit(0)
}

const esbuild = [
  join(pkgRoot, 'node_modules', '.bin', 'esbuild'),
  join(pkgRoot, '..', 'node_modules', '.bin', 'esbuild')
].find((p) => existsSync(p))
if (!esbuild) {
  console.log('⏭  跳过浏览器测试：未找到 esbuild')
  process.exit(0)
}

const work = join(tmpdir(), 'iui-browser')
execFileSync('mkdir', ['-p', work])
writeFileSync(
  join(work, 'page.html'),
  readFileSync(join(here, 'browser/page.html'), 'utf8').replace(
    '</body>',
    '<script src="lifecycle.js"></script></body>'
  )
)
copyFileSync(join(pkgRoot, 'lib/client.js'), join(work, 'client.js'))
execFileSync(
  esbuild,
  [
    join(here, 'browser/harness.mjs'),
    '--bundle',
    '--format=iife',
    '--outfile=' + join(work, 'harness.js'),
    '--define:process.env.NODE_ENV="production"',
    '--log-level=error'
  ],
  { cwd: pkgRoot }
)
execFileSync(
  esbuild,
  [
    join(here, 'browser/lifecycle.jsx'),
    '--bundle',
    '--format=iife',
    '--outfile=' + join(work, 'lifecycle.js'),
    '--define:process.env.NODE_ENV="production"',
    '--log-level=error',
    ...['@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-primitives'].map(
      (name) => `--alias:${name}=${join(here, 'browser/platform.mjs')}`
    )
  ],
  { cwd: pkgRoot }
)

const dom = runChrome([
  '--virtual-time-budget=10000',
  '--enable-precise-memory-info',
  '--js-flags=--expose-gc',
  '--dump-dom',
  'file://' + join(work, 'page.html')
])
const m = dom.match(/REPORT:(\{[\s\S]*?\})</)
let pass = 0,
  fail = 0
const check = (n, c, d = '') => {
  c ? (pass++, console.log('✅ ' + n)) : (fail++, console.log('❌ ' + n + (d ? ' — ' + d : '')))
}
if (!m) {
  check('浏览器产生报告', false)
  process.exit(1)
}
const r = JSON.parse(m[1].replace(/&quot;/g, '"'))
check('bundle 在浏览器中可加载', !r.error, r.error)
check('围栏渲染为界面（data-openui）', r.ok === true, JSON.stringify(r))
check('图表 SVG 已渲染', r.chart === true)
check('无解析错误', r.err !== true)
check('合成回归语料在浏览器中渲染出内容', r.real === true, JSON.stringify(r))
check('合成回归语料不出现警告面板', r.warn !== true, JSON.stringify(r))
const lifecycle = dom.match(/LIFECYCLE:(\{[\s\S]*?\})<\/pre>/)
check('生命周期测试产生报告', Boolean(lifecycle))
if (lifecycle) {
  for (const result of JSON.parse(lifecycle[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
    .checks)
    check(result.name, result.ok)
}
console.log(`\n${pass} 通过, ${fail} 失败  (html ${r.len} bytes)`)
process.exit(fail > 0 ? 1 : 0)
