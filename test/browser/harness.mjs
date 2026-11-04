// 在真实浏览器里加载 lib/client.js（ModuleLoader 格式），注册渲染器并渲染一条消息。
// 这是唯一能抓到「模块级引用错误 / 浏览器专属崩溃」的测试。
import React from 'react'
import { createRoot } from 'react-dom/client'
import * as jsxRuntime from 'react/jsx-runtime'

const scheduleReport = window.setTimeout.bind(window)

const platform = {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  '@deepseek-ai/dsh-client-store': {
    createSnapshotStore: (i) => ({
      subscribe: () => () => {},
      getSnapshot: () => i,
      get: () => i,
      set: () => {}
    })
  },
  '@deepseek-ai/dsh-client-ui-primitives': {
    MarkdownText: (p) => React.createElement('div', { 'data-md': '' }, p.text),
    DisclosureRow: (p) => React.createElement('div', null, p.collapsedContent, p.children),
    TextShimmer: (p) => React.createElement('span', null, p.children),
    IconThinkOutlineRegular: () => React.createElement('i'),
    JsonBlock: (p) => React.createElement('pre', null, JSON.stringify(p.payload))
  }
}
window.__ModuleLoader__ = {
  load(def) {
    try {
      window.__client = def.factory((spec) => platform[spec])
    } catch (e) {
      window.__loadError = String(e)
    }
  }
}
const report = (o) => {
  const pre = document.createElement('pre')
  pre.id = 'report'
  pre.textContent = 'REPORT:' + JSON.stringify(o)
  document.body.appendChild(pre)
}

const script = document.createElement('script')
script.src = 'client.js'
script.onload = () => {
  try {
    if (window.__loadError) return report({ error: 'factory threw: ' + window.__loadError })
    const mod = window.__client
    if (!mod) return report({ error: 'module not loaded' })
    const regs = []
    mod.apply({
      effect: (f) => f(),
      slots: { inject: (n, cb) => cb(), register: (o, c) => regs.push({ o, c }) }
    })
    const comp = (regs.find((r) => r.o.key === 'assistant-step') ?? {}).c
    if (!comp) return report({ error: 'assistant-step not registered' })
    const text =
      '说明文字\n\n```openui\nroot = Stack([k, c], "column", 12)\nk = StatCard("收入", "¥100", "+5%", "up")\nc = Chart("趋势", "bar", [{name: "x", values: [1, 2, 3]}], [], ["一", "二", "三"])\n```'
    // 模型输出形态回归：Text 的位置尺寸 token 曾被重绑到 weight，
    // 渲染出「field /weight ... got "sm"」警告。这里在真实浏览器里整条消息渲染一遍。
    const real =
      '关键路径：\n\n```openui\nroot = Stack([\n  Text("放行 → 表单提交耗时（测试环境实测 RTT≈30ms）", "sm", color="secondary"),\n  ComparisonBar("单次提交耗时", [{label: "旧：串行校验", value: 960, variant: "error"}, {label: "新：预取码", value: 40, variant: "success"}], true, "ms"),\n  Text("失败重试间隔：中位 3200ms → 约 90ms", "sm", color="secondary"),\n])\n```'
    createRoot(document.getElementById('root')).render(
      React.createElement(comp, {
        node: {
          data: {
            status: 'settled',
            step: 1,
            finalNode: undefined,
            blocks: [
              { kind: 'text', text },
              { kind: 'text', text: real }
            ]
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
    window.__bundleReady = true
    scheduleReport(() => {
      const html = document.getElementById('root').innerHTML
      const text = document.getElementById('root').textContent
      report({
        ok: html.includes('data-openui'),
        md: html.includes('data-md'),
        chip: html.includes('收入'),
        chart: html.includes('<svg'),
        err: html.includes('解析失败'),
        warn: html.includes('个警告'),
        real: text.includes('放行'),
        len: html.length
      })
    }, 600)
  } catch (e) {
    report({ error: String(e) })
  }
}
script.onerror = () => report({ error: 'client.js failed to load' })
document.head.appendChild(script)
