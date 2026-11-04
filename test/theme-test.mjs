// 深色主题回归：渲染输出（原生 + 自动编译）的 style 属性不得含硬编码颜色。
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const platform = {
  react: React,
  'react/jsx-runtime': await import('react/jsx-runtime'),
  '@deepseek-ai/dsh-client-store': {
    createSnapshotStore: (i) => ({
      subscribe: () => () => {},
      getSnapshot: () => i,
      get: () => i,
      set: () => {}
    })
  },
  '@deepseek-ai/dsh-client-ui-primitives': {
    MarkdownText: ({ text }) => React.createElement('div', null, text),
    DisclosureRow: ({ children }) => React.createElement('div', null, children),
    TextShimmer: ({ children }) => React.createElement('span', null, children),
    IconThinkOutlineRegular: () => React.createElement('i'),
    JsonBlock: () => React.createElement('pre')
  }
}
let reg = null
globalThis.window = {
  __ModuleLoader__: {
    load: (d) => {
      reg = d.factory((s) => platform[s])
    }
  }
}
eval(readFileSync(join(here, '../lib/client.js'), 'utf8'))
const regs = []
reg.apply({
  effect: (f) => f(),
  slots: { inject: (n, cb) => cb(), register: (o, c) => regs.push({ o, comp: c }) }
})
const comp = regs.find((r) => r.o.key === 'assistant-step').comp

const texts = [
  '```openui\nroot = Stack([c, s, t, b, ch], "column", 12)\nc = Card([CardHeader("标题", "副标题"), TextContent("正文"), Badge("成功", "success")])\ns = Stack([k1, k2], "row", 12)\nk1 = StatCard("收入", "¥100", "+5%", "up")\nk2 = StatCard("成本", "¥60", "-2%", "down")\nt = Table(null, ["名", "值"], [{"名": "A", "值": 1}])\nb = Button("操作", "act")\nch = Chart("趋势", "bar", [{label: "一", value: 10}])\n```',
  '自动编译：\n\n| 服务 | 数 | 状态 |\n|---|---:|---|\n| a | 1,200 | healthy |\n| b | 800 | failed |\n\n结论：可用。',
  '```openui\nroot = Stack([Chart("seven series", "bar", [' +
    Array.from({ length: 7 }, (_, i) => `{name: "s${i}", values: [${i + 1}, ${i + 2}]}`).join(',') +
    ']), PieChart(null, [' +
    Array.from({ length: 7 }, (_, i) => `{label: "s${i}", value: ${i + 1}}`).join(',') +
    ']), SegmentedControl([{label: "one", content: Text("panel")}]), Box([Text("content")], "block", null, 0, null, null, false, null, null, null, null, null, null, null, null, null, "sm")])\n```',
  '```openui\nroot = Stack([Table("empty", ["A"], []), Chart(), Chart("warning", "bad"), Badge("ready"), Card([Text("raised")], 16, "none", true)])\n```'
]
let allHtml = ''
for (const t of texts) {
  allHtml += renderToString(
    React.createElement(comp, {
      node: {
        data: {
          status: 'settled',
          step: 1,
          finalNode: undefined,
          blocks: [{ kind: 'text', text: t }]
        },
        location: { kind: 'step', turn: { status: 'closed' } }
      },
      groupPart: undefined,
      useDisclosure: () => ({ expanded: false, toggle: () => {} }),
      useGroupAction: () => null,
      useTurnData: () => undefined,
      turnProcess: undefined,
      openFile: () => {},
      loadImage: () => {},
      fileMentions: () => undefined,
      usePresentation: (s) => s({ mode: 'standard', settledReasoningPreview: true }),
      renderSlot: () => null,
      t: (k) => k
    })
  )
}
const styleAttrs = [...allHtml.matchAll(/style="([^"]*)"/g)].map((m) => m[1])
const colorDecls = styleAttrs
  .flatMap((s) => s.split(';'))
  .filter((d) => /color|background|border/.test(d))
const hardcoded = colorDecls.filter(
  (d) => /#[0-9a-fA-F]{3,6}\b|\brgba?\(/.test(d) && !/var\(--/.test(d)
)
const svgColors = [...allHtml.matchAll(/(?:fill|stroke)="([^"]*)"/g)].map((m) => m[1])
hardcoded.push(...svgColors.filter((color) => /#[\da-f]{3,8}\b|rgba?\(/i.test(color)))
hardcoded.push(
  ...[...(reg.PLUGIN_CSS ?? '').matchAll(/#[\da-f]{3,8}\b|rgba?\([^)]*\)/gi)].map((m) => m[0])
)
console.log(
  `颜色声明 ${colorDecls.length} 条，token 化 ${colorDecls.filter((d) => /var\(--dsw-/.test(d)).length} 条`
)
if (hardcoded.length) {
  console.log('❌ 硬编码颜色:')
  hardcoded.slice(0, 5).forEach((d) => console.log('  -', d.trim()))
  process.exit(1)
}
console.log('✅ 无硬编码颜色，深色主题自动跟随')
