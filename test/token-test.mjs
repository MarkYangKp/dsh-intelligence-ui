// Token 保真测试：渲染层引用的每个 DSH 主题变量都必须真实存在。
// 背景：插件曾引用 --dsw-font-size-body / --dsw-font-family-code 这类不存在的变量，
// 结果全部走回退值，生产环境与设计稿不一致，而且没有任何测试能发现。
// 口径：扫描构建产物里的所有 var(--dsw-*/--dsh-*/--ds-*)，对照 DSH 主题快照的 token 集合。
import { readFileSync } from 'node:fs'

const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const known = new Set(
  JSON.parse(readFileSync(new URL('./fixtures/dsh-tokens.json', import.meta.url), 'utf8'))
)

// 组件/宿主可能同时出现在内联样式与注入 CSS 里；统一抽取。
const referenced = new Set(
  [...bundle.matchAll(/var\(\s*(--(?:dsw|dsh|ds)-[a-z0-9-]+)/g)].map((m) => m[1])
)

// 允许的回退命名空间：DSH 自身在部分产品包里用 --dsw-* 但快照未收录的极少变量，
// 一律显式列出（新增项必须有对应说明），不允许悄悄放过。
const ALLOW = new Set([
  // DSH 滚动条在 WebKit 路径下由 ui-theme 全局注入，快照按需收录；组件仅读取其回退值。
  '--dsw-alias-label-dimmed'
])

const missing = [...referenced].filter((t) => !known.has(t) && !ALLOW.has(t)).sort()
const unusedWarn = []

console.log(`引用 token ${referenced.size} 个，DSH 快照 ${known.size} 个`)
if (unusedWarn.length) console.log('提示：', unusedWarn.join(', '))
if (missing.length) {
  console.log('❌ 引用了 DSH 主题中不存在的 token：')
  for (const t of missing.slice(0, 40)) console.log('  -', t)
  process.exit(1)
}
console.log('✅ 所有主题 token 均存在于 DSH token 表')
