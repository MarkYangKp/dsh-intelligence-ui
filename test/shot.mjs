// 画廊截图：渲染当前 bundle 的明/暗两套画廊并截全页图（视觉审查用）。
// 用法：node build.mjs && node test/shot.mjs [输出目录]
import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { capturePage } from './chrome.mjs'

const outDir = process.argv[2] ?? 'docs'
mkdirSync(outDir, { recursive: true })
await import('./gallery.mjs')

const jobs = [
  ['/tmp/iui-gallery.html', join(outDir, 'gallery.png'), 920, 1400],
  ['/tmp/iui-gallery-dark.html', join(outDir, 'gallery-dark.png'), 920, 1400],
  ['/tmp/iui-gallery.html', join(outDir, 'gallery-mobile.png'), 390, 1000]
]
// 静态画廊：docs/gallery.html（README 链接的“可交互画廊”入口，预览/排障用）。
copyFileSync('/tmp/iui-gallery.html', join(outDir, 'gallery.html'))

for (const [html, out, width, height] of jobs) {
  await capturePage({
    url: 'file://' + html,
    out,
    width,
    height,
    profile: '/tmp/iui-shot-' + width + (out.includes('dark') ? '-d' : '')
  })
  console.log('🖼  ' + out + '  (' + width + 'px)')
}
