// 交互回归：地图展开；Chart 刻度在展开、缩放与中文/长标签下不重叠。
// 需要一个 Chrome/Chromium；找不到时跳过（与 measure.mjs 同一策略）。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { CHROME, runChromeFrames } from './chrome.mjs'

const here = dirname(fileURLToPath(import.meta.url))
if (!CHROME) {
  console.log('⏭  跳过交互测试：未找到 Chrome（设置 CHROME 环境变量）')
  process.exit(0)
}

// 先确保 Node 版运行时存在（仓库里它是构建产物，不在版本库中）
await import('../src/compiler-runtime-check.mjs')
const pkgRoot = join(here, '..')
const esbuild = [
  join(pkgRoot, 'node_modules', '.bin', 'esbuild'),
  join(pkgRoot, '..', 'node_modules', '.bin', 'esbuild')
].find((p) => existsSync(p))
if (!esbuild) {
  console.log('⏭  跳过交互测试：未找到 esbuild（pnpm install）')
  process.exit(0)
}

const work = join(tmpdir(), 'iui-interact')
execFileSync('mkdir', ['-p', work])
writeFileSync(join(work, 'page.html'), readFileSync(join(here, 'interact/page.html'), 'utf8'))
// 入口放在包内构建（react 才能解析），产物写到临时目录
execFileSync(
  esbuild,
  [
    join(here, 'interact/index.mjs'),
    '--bundle',
    '--format=iife',
    '--outfile=' + join(work, 'bundle.js'),
    '--define:process.env.NODE_ENV="production"',
    '--log-level=error'
  ],
  { cwd: pkgRoot }
)

const dom = await runChromeFrames({
  url: 'file://' + join(work, 'page.html'),
  profile: join(work, 'profile'),
  ready:
    "document.querySelector('#report') && [...document.querySelectorAll('pre')].some(p => p.textContent.startsWith('CHART_REPORT:'))"
})
const m = dom.match(/<pre id="report">REPORT:(\{[\s\S]*?\})</)
let pass = 0,
  fail = 0
const check = (n, c, d = '') => {
  c ? (pass++, console.log('✅ ' + n)) : (fail++, console.log('❌ ' + n + (d ? ' — ' + d : '')))
}
if (!m) {
  check('交互测试产生报告', false)
  process.exit(1)
}
const r = JSON.parse(m[1].replace(/&quot;/g, '"'))
check('地图存在「展开」按钮', r.found === true, JSON.stringify(r))
check('点击后视图变大（>1.2x）', r.expanded === true, `before=${r.before} after=${r.after}`)
const chartReport = dom.match(/CHART_REPORT:(\{[\s\S]*?\})<\/pre>/)
check('Chart 交互测试产生报告', Boolean(chartReport))
if (chartReport) {
  for (const result of JSON.parse(chartReport[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
    .checks)
    check(result.name, result.ok)
}
console.log(`\n${pass} 通过, ${fail} 失败  (before ${r.before}px → after ${r.after}px)`)
process.exit(fail > 0 ? 1 : 0)
