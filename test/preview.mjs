#!/usr/bin/env node
// 单 agent 视觉预览：用当前源码构建一份**独立 bundle**，渲染可筛选的画廊分区，
// 截全页图到自己的临时目录。并行编辑时互不干扰（不碰 lib/client.js 与 /tmp 公共文件）。
//
// 用法：
//   node test/preview.mjs --name data --only charts --theme dark --width 920
//   node test/preview.mjs --name data --theme light,暗 --only 容器|图表
//
// 参数：
//   --name   必填，临时目录后缀（/tmp/iui-preview-<name>/）
//   --only   可选，按分区标题正则过滤（默认全部）；多次给则并集
//   --theme  light | dark | both（默认 both）
//   --width  视口宽度（默认 920）
// 输出：/tmp/iui-preview-<name>/<theme>.png 与 .html；退出码 0 表示截图成功。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildClient } from '../build.mjs'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const name = opt('name', 'agent')
const themes = (opt('theme', 'both') === 'both' ? 'light,dark' : opt('theme', 'light')).split(',')
const width = Number(opt('width', '920'))
const onlyFilters = []
for (let i = 0; i < args.length; i++)
  if (args[i] === '--only' && args[i + 1]) onlyFilters.push(args[i + 1])
const filters = onlyFilters.map((f) => new RegExp(f))

const dir = `/tmp/iui-preview-${name}`
mkdirSync(dir, { recursive: true })
const outfile = join(dir, 'client.js')

console.log('⚙️  构建独立 bundle …')
const { bytes } = await buildClient({ outfile, logLevel: 'silent' })
console.log(`   ${(bytes / 1024).toFixed(0)} KB`)

// gallery.mjs 通过环境变量读取 bundle 与输出目录；导入时会写出完整画廊 HTML。
process.env.IUI_BUNDLE = outfile
process.env.IUI_GALLERY_OUT = dir
const gallery = await import('./gallery.mjs')

const { capturePage } = await import('./chrome.mjs')
const generated = new URL('./fixtures/dsh-theme.css', import.meta.url)
const themeCss = readFileSync(
  fileURLToPath(generated) && existsSync(generated)
    ? generated
    : new URL('./fixtures/theme-fallback.css', import.meta.url),
  'utf8'
)
const pluginCss = gallery.pluginCss

const pick = (sections) => {
  if (!filters.length) return sections
  return sections.filter((s) => filters.some((r) => r.test(s.title)))
}

const html = (sections, dark) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="color-scheme" content="${dark ? 'dark' : 'light'}">
<style>${themeCss}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif);
-webkit-font-smoothing:antialiased}
body{padding:28px 20px 56px}
.gallery{max-width:780px;margin:0 auto;display:flex;flex-direction:column;gap:40px}
.sec{display:flex;flex-direction:column;gap:12px;min-width:0}
.cap{font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption);display:flex;align-items:center;gap:8px}
.cap::after{content:"";flex:1;height:1px;background:var(--dsw-alias-border-l1)}
.msg{min-width:0}
.dsh-iui-root{font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px))}
.dsh-iui-body{display:flex;flex-direction:column;gap:20px}
.fake-md{font-size:var(--dsh-content-font-size,14px);color:var(--dsw-alias-label-primary)}
${pluginCss}
</style></head><body${dark ? ' data-ds-dark-theme' : ''}><div class="gallery">
${pick(gallery.sections)
  .map(
    (s) =>
      `<section class="sec"><div class="cap">${s.title}</div><div class="msg">${s.html}</div></section>`
  )
  .join('\n')}
</div></body></html>`

let count = 0
for (const theme of themes) {
  const dark = theme === 'dark'
  const file = join(dir, `${theme}.html`)
  writeFileSync(file, html(gallery.sections, dark))
  const png = join(dir, `${theme}.png`)
  await capturePage({
    url: 'file://' + file,
    out: png,
    width,
    height: 1200,
    profile: `/tmp/iui-preview-${name}/chrome-${theme}`
  })
  console.log(`🖼  ${png}`)
  count++
}
if (!count) throw new Error('没有生成截图：检查 --theme 参数')
