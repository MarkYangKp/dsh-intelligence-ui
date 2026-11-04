// 无头冒烟测试：模拟 DSH 浏览器环境（ModuleLoader + 平台模块表），
// 加载 lib/client.js 并 SSR 渲染 assistant-step 替换组件。
// 覆盖：① 原生围栏渲染 ② 无围栏纯文字（官方路径）③ 无围栏结构化（自动编译）
// ④ 流式未闭合围栏 ⑤ 真实 SlotCore 白屏回归（2026-10-18 事故）。
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

// ---- 平台模块表桩 ----
const platform = {
  react: React,
  'react/jsx-runtime': await import('react/jsx-runtime'),
  '@deepseek-ai/dsh-client-store': {
    createSnapshotStore: (initial) => ({
      subscribe: () => () => {},
      getSnapshot: () => initial,
      get: () => initial,
      set: () => {}
    })
  },
  '@deepseek-ai/dsh-client-ui-primitives': {
    MarkdownText: ({ text }) => React.createElement('div', { 'data-md': '' }, text),
    DisclosureRow: ({ title, children, collapsedContent }) =>
      React.createElement('div', { 'data-disclosure': title }, collapsedContent, children),
    TextShimmer: ({ children }) => React.createElement('span', {}, children),
    IconThinkOutlineRegular: () => React.createElement('i', {}, '◐'),
    JsonBlock: ({ payload }) => React.createElement('pre', {}, JSON.stringify(payload))
  }
}

let registered = null
globalThis.window = {
  __ModuleLoader__: {
    load(def) {
      registered = def.factory((spec) => platform[spec])
    }
  }
}
eval(readFileSync(join(here, '../lib/client.js'), 'utf8'))

if (!registered) throw new Error('bundle 未注册')
console.log('✅ bundle 加载成功，exports:', Object.keys(registered).join(', '))
console.log('   inject:', JSON.stringify(registered.inject))
console.log('   版本:', registered.IUI_VERSION)

let pass = 0,
  fail = 0
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++
    console.log(`✅ ${name}`)
  } else {
    fail++
    console.log(`❌ ${name}${detail ? ' — ' + detail : ''}`)
    process.exitCode = 1
  }
}

// ---- apply：模拟 ctx.slots ----
const registrations = []
const ctx = {
  effect: (fn) => fn(),
  slots: {
    inject: (name, cb) => cb(),
    register: (opts, comp) => {
      registrations.push({ opts, comp })
    }
  }
}
registered.apply(ctx)
const reg = registrations.find((r) => r.opts.key === 'assistant-step')
if (!reg) throw new Error('assistant-step 未注册')
check(
  'assistant-step 已注册 priority -20（压过旧版 OpenUI 插件的 -10）',
  reg.opts.priority === -20,
  `实际 ${reg.opts.priority}`
)

const props = {
  node: {
    data: { status: 'settled', step: 1, finalNode: undefined, blocks: [] },
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
  usePresentation: (sel) => sel({ mode: 'standard', settledReasoningPreview: true }),
  renderSlot: () => null,
  t: (k) => k
}
const render = (text, status = 'settled') =>
  renderToString(
    React.createElement(reg.comp, {
      ...props,
      node: {
        ...props.node,
        data: { ...props.node.data, status, blocks: [{ kind: 'text', text }] }
      }
    })
  )

// ① 原生围栏
const fenceText =
  '本周经营情况：\n\n```openui\nroot = Stack([kpis, chart], "column", 12)\nkpis = Stack([k1, k2], "row", 12)\nk1 = StatCard("本周收入", "¥84,300", "+12.6%", "up")\nk2 = StatCard("新增用户", "1,204", "+3.1%", "up")\nchart = Chart("日收入趋势", "bar", [{label: "一", value: 1120}, {label: "二", value: 1310}, {label: "三", value: 980}])\n```\n\n数据说明见上表。'
const html1 = render(fenceText)
check('① 原生围栏：拦截并渲染', html1.includes('data-openui') && html1.includes('本周收入'))
check(
  '① 原生围栏：围栏外文字保持 Markdown（插入式渲染）',
  html1.includes('数据说明见上表') && html1.includes('data-md')
)

// ② 纯文字 → 官方路径
const html2 = render('普通回复：这个问题的根因在于依赖数组不完整，补上就好。')
check('② 纯文字：走官方 Markdown 路径', html2.includes('data-md') && !html2.includes('data-openui'))

// ③ 无围栏结构化 → 自动编译
const mdReply = `服务运行汇总：\n\n| 服务 | 请求数 | 状态 |\n|---|---:|---|\n| api | 12,840 | healthy |\n| db | 8,200 | degraded |\n| cache | 3,100 | failed |\n\n整体可用性 99.2%。`
const html3 = render(mdReply)
check(
  '③ 自动编译：结构化 Markdown 升级为 UI',
  html3.includes('data-openui') && html3.includes('data-iui-compiled'),
  html3.slice(0, 200)
)
check('③ 自动编译：表格渲染', html3.includes('api'))
check('③ 自动编译：无解析错误', !html3.includes('OpenUI 解析失败'))

// ③-b 纯文字在流式中 → 官方路径（编译只在定稿后）
const html3b = render(mdReply, 'running')
check(
  '③-b 流式期间：不编译，走官方路径',
  html3b.includes('data-md') && !html3b.includes('data-iui-compiled')
)

// ④ 流式未闭合围栏
const html4 = render(
  '正在生成界面：\n```openui\nroot = Stack([Card([CardHeader("流式卡片")])])\n',
  'running'
)
check('④ 流式未闭合围栏即时渲染', html4.includes('data-openui') && html4.includes('data-streaming'))

// ⑤-b 流式空围栏不弹错误（刚写 ```openui、内容未到）
const htmlEmpty = render('正在生成：\n\n```openui\n', 'running')
check(
  '⑤-b 流式空围栏无错误框且显示原文',
  !htmlEmpty.includes('解析失败') && htmlEmpty.includes('data-md'),
  htmlEmpty.slice(0, 140)
)

// ⑨ Map：经纬打点 + 连线 + 区域裁剪
const mapText =
  '```openui\nroot = Stack([m], "column", 12)\nm = Map("门店", [{"lat": 31.2, "lon": 121.5, "label": "上海"}, {"lat": 30.3, "lon": 120.2, "label": "杭州"}, {"lat": 32.1, "lon": 118.8, "label": "南京"}], [[0, 1]], [110, 25, 125, 40], 240, true)\n```'
const htmlMap = render(mapText)
check(
  '⑨ Map 渲染标记与陆地',
  htmlMap.includes('data-openui') &&
    (htmlMap.match(/<circle/g) ?? []).length >= 3 &&
    !htmlMap.includes('解析失败')
)
// ⑨-b Map 缩放：bbox 裁剪后，标记半径/字号必须相对 viewBox 归一（防巨圆回归）
const vb = htmlMap.match(/viewBox="([^"]+)"/)?.[1]
const vbW = vb ? parseFloat(vb.split(' ')[2]) : 0
const radii = [...htmlMap.matchAll(/<circle[^>]*r="([\d.]+)"/g)].map((m) => parseFloat(m[1]))
// v3：字号固定 11px（FS.caption），不再引用不存在的 --dsw-font-size-caption。
const fonts = [
  ...htmlMap.matchAll(/<text[^>]*transform="[^"]*scale\(([\d.]+)\)"[^>]*font-size="11px"/g)
].map((m) => parseFloat(m[1]) * 11)
check(
  '⑨-b Map 标记半径归一（<5% 视宽）',
  vbW > 0 && radii.length > 0 && Math.max(...radii) / vbW < 0.05,
  `vbW=${vbW} r=${radii.join(',')}`
)
check(
  '⑨-b Map 字号归一（<5% 视宽）',
  vbW > 0 && fonts.length > 0 && Math.max(...fonts) / vbW < 0.05,
  `fonts=${fonts.join(',')}`
)

// ⑧ TreeView：数字/null 层序 + 字符串遍历（模型常见写法）
const treeText =
  '```openui\nroot = Stack([t], "col", 12)\nt = TreeView("示例树", [1, 2, 3, 4, 5, null, 6], "pre", 240)\n```'
const htmlTree = render(treeText)
check(
  '⑧ TreeView 数字/null/字符串遍历可渲染',
  htmlTree.includes('共 6 个节点') && !htmlTree.includes('解析失败'),
  htmlTree.slice(0, 160)
)
check(
  '⑧ Stack 方向别名 col 不报错',
  !render('```openui\nroot = Stack([a], "col", 12)\na = Badge("ok")\n```').includes('解析失败')
)

// ⑤-g 冒号式命名参数（模型常写 JS 对象风格）+ 空数据守卫
const colonText =
  '```openui\nroot = Stack([sc, ch], "column", 12)\nsc = StatCard(label: "CPU 均值", value: "9.6%", note: "平稳", accent: "success")\nch = Chart(title: "CPU", type: "area", series: [{name: "CPU", values: [9.5, 11.1, 9.6]}], labels: ["-60m", "-30m", "now"])\n```'
const htmlColon = render(colonText)
check(
  '⑤-g 冒号式参数可渲染',
  htmlColon.includes('CPU 均值') && htmlColon.includes('9.6%') && !htmlColon.includes('解析失败'),
  htmlColon.slice(0, 140)
)
check('⑤-g 冒号式参数图表有数据', (htmlColon.match(/<svg/g) ?? []).length >= 1)

const emptyChart = '```openui\nroot = Stack([c], "column", 12)\nc = Chart("空图", "bar", [])\n```'
const htmlEmptyChart = render(emptyChart)
check(
  '⑤-g 无数据图表显示占位而非空坐标轴',
  htmlEmptyChart.includes('没有可绘制的数据') && !htmlEmptyChart.includes('<svg')
)
const pointSeries =
  '```openui\nroot = Stack([c], "column", 12)\nc = Chart("点集", "bar", [{"label": "一", "value": 3}, {"label": "二", "value": 5}])\n```'
check('⑤-g 点集误放 series 位置仍可绘制', (render(pointSeries).match(/<svg/g) ?? []).length >= 1)

// ⑤-f 代码块语法高亮（颜色必须是主题 token，不能硬编码）
const hlText =
  '```openui\nroot = Stack([c, p], "column", 12)\nc = CodeBlock("const x = 42 // note\\nconst s = \\"hi\\"", "js", "js")\np = CodeBlock("def f(a):\\n    return a  # note", "python", "py")\n```'
const htmlHl = render(hlText)
const tokens = (htmlHl.match(/color:var\(--dsw-alias/g) ?? []).length
check('⑤-f 代码块有语法高亮（多色 token）', tokens >= 8, `tokens=${tokens}`)
check('⑤-f 高亮颜色无硬编码', !/style="[^"]*#[0-9a-fA-F]{3,6}/.test(htmlHl))

// ⑤-e 重内容组件必须带「展开」控件（地图/图表/饼图/热力/示意图/表格/长代码）
const heavy =
  '```openui\nroot = Stack([m, c, p, h, d, t, cb], "column", 12)\nm = Map("地图", [{"lat": 31.2, "lon": 121.5, "label": "上海"}], [], [110, 20, 130, 45], 260, true)\nc = Chart("图", "bar", [{name: "x", values: [1, 2]}], [], ["一", "二"])\np = PieChart("饼", [{"label": "A", "value": 1}])\nh = Heatmap("热", [{"value": 1}, {"value": 2}])\nd = Diagram("示意", 300, 160, [{"id": "a", "label": "A", "x": 60, "y": 80}], [])\nt = Table("表", ["a"], [{"a": 1}, {"a": 2}, {"a": 3}, {"a": 4}, {"a": 5}, {"a": 6}, {"a": 7}, {"a": 8}, {"a": 9}])\ncb = CodeBlock("l1\\nl2\\nl3\\nl4\\nl5\\nl6\\nl7\\nl8\\nl9\\nl10\\nl11\\nl12\\nl13\\nl14\\nl15\\nl16\\nl17\\nl18\\nl19\\nl20", "js")\n```'
const htmlHeavy = render(heavy)
check(
  '⑤-e 重内容组件都带展开控件',
  (htmlHeavy.match(/展开/g) ?? []).length >= 7,
  `toggles=${(htmlHeavy.match(/展开/g) ?? []).length}`
)

// ⑤-c 新增组件：Diff / FileTree / Checklist / Heatmap / CodeBlock 增强 / Table 汇总
const newComp =
  '```openui\nroot = Stack([d, t, c, h, cb, tb], "column", 12)\nd = Diff("src/a.js", "+const a = 2\\n-const a = 1")\nt = FileTree("变更", [{"path": "src/a.js", "status": "modified"}])\nc = Checklist("检查", [{"text": "构建", "status": "done"}, {"text": "灰度", "status": "doing"}])\nh = Heatmap("热力", [{"value": 1}, {"value": 5}, {"value": 9}], 3, 14)\ncb = CodeBlock("a = 1\\nb = 2", "js", "示例", true, [2])\ntb = Table("汇总", ["项", "值"], [{"项": "A", "值": 1}], false, true, false, [], null, {"项": "合计", "值": 3})\n```'
const htmlNew = render(newComp)
check(
  '⑤-c Diff 渲染（+/- 统计）',
  /\+\s*(?:<!-- -->)?1/.test(htmlNew) && /−\s*(?:<!-- -->)?1/.test(htmlNew)
)
check('⑤-c FileTree 状态标记', htmlNew.includes('>M<'))
check('⑤-c Checklist 状态', htmlNew.includes('✓') && htmlNew.includes('◐'))
check(
  '⑤-c Heatmap 网格',
  (htmlNew.match(/width:12px;height:12px;border-radius:var\(--dsw-radius-xs, 4px\)/g) ?? [])
    .length >= 3
)
check('⑤-c CodeBlock 行号/高亮', htmlNew.includes('复制'))
check('⑤-c Table 汇总行', htmlNew.includes('合计'))

// ⑤-d 枚举别名容错（模型常写 info / column / small）
const aliasText =
  '```openui\nroot = Stack([d, ch, st, tx], "column", 12)\nd = Diagram("图", 300, 160, [{"id": "a", "label": "A", "x": 60, "y": 80, "variant": "info"}, {"id": "b", "label": "B", "x": 200, "y": 80, "variant": "danger"}], [{"from": "a", "to": "b"}])\nch = Chart("柱", "column", [{name: "x", values: [1, 2]}], [], ["一", "二"])\nst = StatCard("指标", "1", null, "flat", null, null, "info")\ntx = TextContent("小字", "small")\n```'
const htmlAlias = render(aliasText)
check(
  '⑤-d 枚举别名容错（info/column/small/danger）',
  !htmlAlias.includes('解析失败') && htmlAlias.includes('指标') && htmlAlias.includes('柱'),
  htmlAlias.slice(0, 160)
)

// ⑥ 普通代码块里的 OpenUI 程序 → 抢救渲染
const recoveredText =
  '可视化如下：\n\n```js\nroot = Stack([c])\nc = Chart("t", "bar", [{name: "x", values: [1,2]}])\n```\n\n以上。'
const html6 = render(recoveredText)
check(
  '⑥ 普通代码块里的程序被抢救渲染',
  html6.includes('data-openui') && html6.includes('data-iui-recovered'),
  html6.slice(0, 160)
)
check(
  '⑥ 非程序代码块不受影响',
  !render('```js\nfunction f() { return 1 }\n```').includes('data-openui')
)

// ⑦ 命名参数 + 裸子元素（模型常见写法）
const namedText =
  '```openui\nroot = Stack(\n  Heading("命名参数测试", 2),\n  Chart("t", "bar",\n    series=[{name: "x", values: [1,2]}],\n    labels=["a","b"],\n    height=280)\n)\n```'
const html7 = render(namedText)
check(
  '⑦ 命名参数 + 裸子元素可渲染',
  html7.includes('data-openui') && !html7.includes('OpenUI 解析失败'),
  html7.slice(0, 160)
)

// ⑤ 真实 SlotCore 白屏回归（无提取物时用语义等价的仓库夹具）
try {
  // Repository fixture with the same observable registration semantics; keeps CI reproducible
  // without a local host extraction.
  const { SlotCore } = await import('./fixtures/ui-slots.mjs')
  const core = new SlotCore()
  core.record('conversation.chat.node').spec = { kind: 'keyed', scope: 'session' }
  core.register(
    {
      name: 'conversation.chat.node',
      key: 'assistant-step',
      priority: 0,
      children: {
        'conversation.chat.reasoning.body': { kind: 'single', scope: 'session' },
        'conversation.chat.message.images': { kind: 'single', scope: 'session' }
      }
    },
    () => null
  )
  // 旧版 OpenUI 插件（-10）先注册、本插件（-20）后注册——共存迁移的极端场景
  core.register(
    { name: 'conversation.chat.node', key: 'assistant-step', priority: -10 },
    () => null
  )
  const realCtx = {
    effect: (fn) => fn(),
    slots: {
      inject: (n, cb) => cb(),
      register: (opts, comp) => core.register(opts, comp)
    }
  }
  registered.apply(realCtx)
  check('⑤ 真实 SlotCore：注册不触发 already-declared 崩溃', true)
  const childSpec = core.spec('conversation.chat.reasoning.body')
  check('⑤ 子插槽可用（renderSlot 正常）', childSpec != null)
  const mine = core
    .entriesOfSlot('conversation.chat.node')
    .filter((e) => (e.options.priority ?? 0) === -20)
  check('⑤ -20 条目已生效（接管旧 -10 与官方 0）', mine.length === 1)
} catch (e) {
  check('⑤ 真实 SlotCore 验证', false, e.message)
}

console.log(`\n${pass} 通过, ${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)
