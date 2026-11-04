// 视觉验收：SSR 出真实回复（原生围栏 / 自动编译 / 纯文字），组装成画廊 HTML。
// 页面复刻生产环境：宿主主题 token（本地抽取优先，离线用 theme-fallback.css）
// + 聊天画布背景 + 780px 内容宽度。
// 输出：/tmp/iui-gallery.html、/tmp/iui-gallery-dark.html（供 chrome 截图与设计门禁）。
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// 允许预览脚本指定自定义 bundle 与输出目录（并行视觉迭代互不干扰）。
const BUNDLE = process.env.IUI_BUNDLE ?? join(here, '../lib/client.js')
const OUT_DIR = process.env.IUI_GALLERY_OUT ?? '/tmp'

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
    MarkdownText: ({ text }) =>
      React.createElement('div', { 'data-md': '', className: 'fake-md' }, text),
    DisclosureRow: ({ children }) => React.createElement('div', null, children),
    TextShimmer: ({ children }) => React.createElement('span', null, children),
    IconThinkOutlineRegular: () => React.createElement('i', null, ''),
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
eval(readFileSync(BUNDLE, 'utf8'))
const registrations = []
reg.apply({
  effect: (fn) => fn(),
  slots: { inject: (n, cb) => cb(), register: (o, c) => registrations.push({ opts: o, comp: c }) }
})
const comp = registrations.find((r) => r.opts.key === 'assistant-step').comp

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
  usePresentation: (s) => s({ mode: 'standard', settledReasoningPreview: true }),
  renderSlot: () => null,
  t: (k) => k
}
export const renderReply = (text) =>
  renderToString(
    React.createElement(comp, {
      ...props,
      node: { ...props.node, data: { ...props.node.data, blocks: [{ kind: 'text', text }] } }
    })
  )
const fence = (code) => '```openui\n' + code.trim() + '\n```'
const readExample = (name) => readFileSync(join(here, '../examples', name), 'utf8')

// ---------- ① 经营周报：标题 / KPI / 面积图 / 表格 / 结论 ----------
const weekly = `本周经营情况：

${fence(`
root = Stack([hd, kpis, ch, tbl, ok], "column", 20)
hd = Heading("本周经营周报", 2)
kpis = Grid([k1, k2, k3], 3, 12, 150)
k1 = StatCard("本周收入", "¥84,300", "+12.6%", "up", "💰", "含税 GMV", "brand")
k2 = StatCard("新增用户", "1,204", "+3.1%", "up", "👥", "环比上周", "success")
k3 = StatCard("退款率", "1.2%", "-0.3%", "down", "↩️", "低于 2% 警戒线", "warning")
ch = Chart("近七日收入趋势", "area", [{name: "收入", values: [82, 94, 110, 129, 105, 138, 152]}], [], ["一", "二", "三", "四", "五", "六", "日"], 220, "compact", true, true, false)
tbl = Table("渠道分布", ["渠道", "订单", "占比", "状态"], rows, false, false, true, [], -1, [{"key": "订单", "format": "number"}, {"key": "占比", "format": "percent"}, {"key": "状态", "status": true}])
rows = [{"渠道": "小程序", "订单": 5320, "占比": 44.2, "状态": "healthy"}, {"渠道": "App", "订单": 4210, "占比": 35, "状态": "healthy"}, {"渠道": "Web", "订单": 1804, "占比": 15, "状态": "degraded"}, {"渠道": "其它", "订单": 690, "占比": 5.8, "状态": "healthy"}]
ok = Callout("结论", "收入连续三周环比正增长，App 渠道增速最快，建议把华东区预算向 App 倾斜。", "success")
`)}

以上数据口径为含税 GMV，退款率按订单口径统计。`

// ---------- ② 图表族：柱 / 多线 / 环 / 迷你图 / 热力 ----------
const charts = `图表族（柱状 / 多系列折线 / 环形 / 迷你图 / 热力图）

${fence(`
root = Stack([bar, line, row, heat], "column", 20)
bar = Chart("各渠道日订单", "bar", [{name: "订单", values: [320, 410, 380, 520, 610, 540, 480]}], [], ["一", "二", "三", "四", "五", "六", "日"], 200, "compact", true, true, false)
line = Chart("收入与成本（万元）", "line", [{name: "收入", values: [82, 94, 110, 129, 105, 138, 152]}, {name: "成本", values: [61, 66, 74, 88, 79, 92, 96]}], [], ["一", "二", "三", "四", "五", "六", "日"], 220, "compact", true, true, false)
row = Grid([pie, spark, gauge], 3, 16, 180)
pie = PieChart("渠道占比", [{"label": "小程序", "value": 44.2}, {"label": "App", "value": 35}, {"label": "Web", "value": 15}, {"label": "其它", "value": 5.8}], true, 160)
spark = Stack([sparkTitle, s1, s2, s3], "column", 8)
sparkTitle = Text("近七日趋势", "sm", "secondary", "medium")
s1 = Sparkline([12, 14, 13, 18, 16, 21, 24], 160, 32)
s2 = Sparkline([22, 19, 21, 17, 16, 14, 13], 160, 32)
s3 = Sparkline([8, 9, 12, 10, 13, 15, 18], 160, 32)
gauge = Stack([g1, g2, g3], "column", 12)
g1 = ProgressBar("目标完成", 78, 100, "brand")
g2 = ProgressBar("服务可用性", 99.2, 100, "success")
g3 = ProgressBar("退款率", 1.2, 5, "warning")
heat = Heatmap("近 30 天活跃度", days, 10, 18)
days = [{"label": "周一", "value": 3}, {"label": "周二", "value": 5}, {"label": "周三", "value": 8}, {"label": "周四", "value": 12}, {"label": "周五", "value": 9}, {"label": "周六", "value": 4}, {"label": "周日", "value": 2}, {"label": "周一", "value": 6}, {"label": "周二", "value": 11}, {"label": "周三", "value": 15}, {"label": "周四", "value": 18}, {"label": "周五", "value": 16}, {"label": "周六", "value": 7}, {"label": "周日", "value": 3}, {"label": "周一", "value": 9}, {"label": "周二", "value": 13}, {"label": "周三", "value": 17}, {"label": "周四", "value": 20}, {"label": "周五", "value": 19}, {"label": "周六", "value": 10}, {"label": "周日", "value": 5}, {"label": "周一", "value": 8}, {"label": "周二", "value": 14}, {"label": "周三", "value": 16}, {"label": "周四", "value": 18}, {"label": "周五", "value": 17}, {"label": "周六", "value": 9}, {"label": "周日", "value": 4}, {"label": "周一", "value": 11}, {"label": "周二", "value": 15}]
`)}`

// ---------- ③ 结构化数据：搜索表 / 时间线 / 步骤 / 清单 ----------
const dataWide = `结构化数据（搜索表 / 时间线 / 步骤 / 清单）

${fence(`
root = Stack([st, tl, bottom], "column", 20)
st = SearchTable("服务健康度", ["服务", "QPS", "错误率", "P99", "状态"], svc, "搜索服务…", "没有匹配的服务", false, [{"key": "QPS", "format": "number", "align": "right"}, {"key": "错误率", "format": "percent", "align": "right"}, {"key": "P99", "align": "right"}, {"key": "状态", "status": true}])
svc = [{"服务": "api-gateway", "QPS": 128400, "错误率": 0.3, "P99": "42ms", "状态": "healthy"}, {"服务": "user-service", "QPS": 82000, "错误率": 2.1, "P99": "128ms", "状态": "degraded"}, {"服务": "search", "QPS": 3100, "错误率": 15.4, "P99": "1.2s", "状态": "failed"}, {"服务": "billing", "QPS": 45600, "错误率": 0.1, "P99": "65ms", "状态": "healthy"}]
tl = Timeline([{"title": "14:02 告警触发", "description": "search 错误率超过 15%，值班收到 P1 告警", "time": "14:02", "variant": "error"}, {"title": "14:08 定位根因", "description": "新版本索引构建任务把连接池打满", "time": "14:08", "variant": "warning"}, {"title": "14:26 回滚完成", "description": "回滚到 v2.8.1，错误率回落至 0.4%", "time": "14:26", "variant": "success"}])
bottom = Grid([steps, ck], 2, 20, 240)
steps = Steps(["确认影响面与值班同步", "回滚到上一个稳定版本", "观察 30 分钟指标", "补充连接池上限与告警"], 1)
ck = Checklist("发版检查", [{"text": "变更单已审批", "status": "done"}, {"text": "灰度批次已配置", "status": "doing"}, {"text": "回滚脚本已验证", "status": "todo"}])
`)}`

// ---------- ④ 文本与容器：卡片 / 章节 / 提示 / 引用 / 键值 / 徽章 ----------
const textContainers = `容器与文本（Card / Section / Callout / Quote / KeyValue / Badge）

${fence(`
root = Stack([c1, c2, c3], "column", 20)
c1 = Card([CardHeader("支付网关", "v2.8.1 · 华东集群", "⚡"), kv, bg], 20, "brand")
kv = KeyValue([{"label": "负责人", "value": "张一鸣"}, {"label": "上线时间", "value": "2026-10-28"}, {"label": "SLA", "value": "99.95%"}, {"label": "依赖", "value": "订单中心 / 风控"}], 2)
bg = BadgeGroup(["生产", "灰度 10%", "已审批"], "success")
c2 = Section("方案对比", "两种同步策略的取舍", [q, call])
q = Quote("先让数据可用，再让数据实时。多数业务不需要跨机房强一致，只需要可解释的延迟预算。", "架构评审")
call = Callout("注意", "切换方案后需同步更新监控看板与告警阈值，否则会出现静默失败。", "warning")
c3 = Row([b1, b2, b4, b5], 8, "center", "start", true)
b1 = Badge("默认", "default")
b2 = Badge("成功", "success")
b4 = Badge("警告", "warning")
b5 = Badge("错误", "error")
`)}`

// ---------- ⑤ 代码与文件：CodeBlock / Diff / FileTree ----------
const code = `代码与文件（CodeBlock / Diff / FileTree）

${fence(readExample('code-change.openui'))}

代码高亮与行号：

${fence(readExample('code-highlight.openui'))}`

// ---------- ⑥ 过程：Diagram / TreeView ----------
const processDemo = `过程与结构（Diagram / TreeView）

${fence(`
root = Stack([dg, tv], "column", 20)
dg = Diagram("发布流程", 640, 260, [{"id": "a", "label": "提交变更", "x": 60, "y": 120, "variant": "brand"}, {"id": "b", "label": "构建镜像", "x": 200, "y": 60}, {"id": "c", "label": "单测 + 扫描", "x": 200, "y": 180}, {"id": "d", "label": "灰度发布", "x": 350, "y": 120}, {"id": "e", "label": "全量放量", "x": 500, "y": 120, "variant": "success"}], [{"from": "a", "to": "b"}, {"from": "a", "to": "c"}, {"from": "b", "to": "d"}, {"from": "c", "to": "d"}, {"from": "d", "to": "e", "label": "观察 30m"}], [{"label": "提交变更", "highlight": ["a"]}, {"label": "构建与测试", "visited": ["a"], "highlight": ["b", "c"]}, {"label": "灰度发布", "visited": ["a", "b", "c"], "highlight": ["d"]}, {"label": "完成", "visited": ["a", "b", "c", "d"], "highlight": ["e"]}])
tv = TreeView("发布单状态机", [1, 2, 3, null, null, 4, 5], ["pre"])
`)}`

// ---------- ⑦ 交互：Tabs / Accordion / SegmentedControl / Button ----------
const interactive = `交互组件（Tabs / Accordion / SegmentedControl / Button）

${fence(`
root = Stack([tabs, acc, seg, btns], "column", 16)
tabs = Tabs([{"label": "概览", "content": TextContent("华东区本月 GMV ¥2.4M，环比 +18%。")}, {"label": "风险", "content": TextContent("三家门店租约在 Q1 到期，需提前续签。")}], 0)
acc = Accordion([{"title": "为什么选择异步补偿？", "content": TextContent("同步调用在跨机房场景下 P99 会放大 3 倍，异步补偿把失败率降到 0.1%。")}, {"title": "回滚预案", "content": TextContent("保留旧版本镜像 7 天，回滚操作单条命令完成。")}])
seg = SegmentedControl([{"label": "按日", "content": Text("按日视图")}, {"label": "按周", "content": Text("按周视图")}, {"label": "按月", "content": Text("按月视图")}], 0)
btns = Row([Button("查看详情", "open", "primary"), Button("导出 CSV", "export"), Button("忽略", "dismiss", "ghost")], 8, "center", "start", true)
`)}`

// ---------- ⑧ 地图 ----------
const mapDemo = `地图（区域裁剪 / 打点 / 连线）

${fence(`
root = Stack([hd, m], "column", 16)
hd = Heading("华东门店分布", 3)
m = Map("点大小 = 营收，连线 = 供货关系", [{"lat": 31.23, "lon": 121.47, "label": "上海", "value": 42}, {"lat": 30.27, "lon": 120.15, "label": "杭州", "value": 21}, {"lat": 32.06, "lon": 118.80, "label": "南京", "value": 14}, {"lat": 31.30, "lon": 120.62, "label": "苏州", "value": 18}], [[0, 1], [0, 2], [0, 3]], [116, 27, 124, 35], 320, true)
`)}`

// ---------- ⑨ 原语自由组合 ----------
const primitives = `原语自由组合（Box / Row / Col / Text / Icon）

${fence(`
root = Stack([hero, strip], "column", 16)
hero = Box([left, right], "flex", "row", 24, "center", "between", false, "100%", null, null, null, "22px", "0", "color-mix(in srgb, var(--dsw-alias-state-business-primary) 6%, var(--dsw-alias-bg-layer-1))", "1px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 20%, transparent)", "var(--dsw-radius-lg)", "none", "relative", null, null, null, null, "visible", 1)
left = Col([eyebrow, title, desc], 6, "start")
eyebrow = Row([dot, Text("季度复盘 · Q3", "sm", "secondary", "medium")], 8, "center", "start", false)
dot = Box([], "block", null, null, null, false, "5px", "5px", null, null, null, "0", "0", "var(--dsw-alias-state-business-primary)", null, "999px")
title = Text("华东区提前完成季度目标", 22, "semibold", "primary", "left", false, 1.3, "none", "-0.02em")
desc = Text("GMV 达成 108%，新客成本下降 14%，三家新店进入爬坡期。", "md", "secondary")
right = Col([num, label], 2, "end")
num = Text("108%", 36, "semibold", "brand", "right", false, 1.05, "none", "-0.03em")
label = Text("目标达成率", "sm", "secondary")
strip = Grid([m1, m2, m3], 3, 12, 140)
m1 = Box([m1t, m1v], "flex", "column", 4, "start", "start", false, null, null, null, null, "14px 16px", "0", "var(--dsw-alias-markdown-code-block)", "1px solid var(--dsw-alias-border-l2)", "var(--dsw-radius-md)")
m1t = Text("客单价", "sm", "secondary")
m1v = Text("¥268", 20, "semibold", "primary", "left", false, 1.2, "none", "-0.02em")
m2 = Box([m2t, m2v], "flex", "column", 4, "start", "start", false, null, null, null, null, "14px 16px", "0", "var(--dsw-alias-markdown-code-block)", "1px solid var(--dsw-alias-border-l2)", "var(--dsw-radius-md)")
m2t = Text("复购率", "sm", "secondary")
m2v = Text("41.2%", 20, "semibold", "primary", "left", false, 1.2, "none", "-0.02em")
m3 = Box([m3t, m3v], "flex", "column", 4, "start", "start", false, null, null, null, null, "14px 16px", "0", "var(--dsw-alias-markdown-code-block)", "1px solid var(--dsw-alias-border-l2)", "var(--dsw-radius-md)")
m3t = Text("履约时效", "sm", "secondary")
m3v = Text("1.8 天", 20, "semibold", "primary", "left", false, 1.2, "none", "-0.02em")
`)}`

// ---------- ⑩ 自动编译 ----------
const mdTable = `这是没有写围栏的普通 Markdown 回复，编译器应自动升级：

| 服务 | 请求数 | 错误率 | 状态 |
|---|---:|---:|---|
| api-gateway | 128,400 | 0.3% | healthy |
| user-service | 82,000 | 2.1% | degraded |
| search | 3,100 | 15.4% | failed |
| billing | 45,600 | 0.1% | healthy |
| notify | 12,800 | 0.8% | healthy |

整体可用性 99.2%，环比 +0.3%。`

const mdKpi = `本周核心指标：

- **本周收入** ¥84,300（+12.6%）
- **新增用户** 1,204（+3.1%）
- **退款率** 1.2%（-0.3%）

以上为含税口径。`

const mdSteps = `发布流程如下：

1. 构建镜像并推送到仓库
2. 更新 helm values 文件
3. 触发灰度发布并观察 15 分钟
4. 全量放量并通知值班群

完成后在发布单上回填版本号。`

// ---------- 组装 ----------
export const sections = [
  ['① 原生围栏 · 经营周报', weekly],
  ['② 图表族', charts],
  ['③ 结构化数据', dataWide],
  ['④ 容器与文本', textContainers],
  ['⑤ 代码与文件', code],
  ['⑥ 过程与结构', processDemo],
  ['⑦ 交互组件', interactive],
  ['⑧ 地图', mapDemo],
  ['⑨ 原语自由组合', primitives],
  ['⑩ 自动编译 · Markdown 表格', mdTable],
  ['⑪ 自动编译 · KPI 列表', mdKpi],
  ['⑫ 自动编译 · 有序步骤', mdSteps]
].map(([title, text]) => ({ title, html: renderReply(text) }))

// 优先使用本地抽取的宿主主题（scripts/extract-theme.mjs 生成，已 gitignore）；
// 没有时退回仓库自带的近似主题，保证离线环境可测。
const generatedTheme = join(here, 'fixtures/dsh-theme.css')
const fallbackTheme = join(here, 'fixtures/theme-fallback.css')
const themeCss = readFileSync(existsSync(generatedTheme) ? generatedTheme : fallbackTheme, 'utf8')
export const pluginCss = reg.PLUGIN_CSS ?? ''

const layoutCss = `
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif);
-webkit-font-smoothing:antialiased}
body{padding:28px 20px 64px}
.gallery{max-width:780px;margin:0 auto;display:flex;flex-direction:column;gap:44px}
.sec{display:flex;flex-direction:column;gap:12px;min-width:0}
.cap{font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption);letter-spacing:.01em;
display:flex;align-items:center;gap:8px}
.cap::after{content:"";flex:1;height:1px;background:var(--dsw-alias-border-l1)}
.msg{min-width:0}
.dsh-iui-root{font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));
color:var(--dsw-alias-label-primary)}
.dsh-iui-body{display:flex;flex-direction:column;gap:20px}
.fake-md{font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-primary)}
@media(max-width:520px){body{padding:16px 14px 40px}.gallery{gap:32px}}
`

const page = (dark) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="color-scheme" content="${dark ? 'dark' : 'light'}">
<style>${themeCss}${layoutCss}
${pluginCss}
</style></head><body${dark ? ' data-ds-dark-theme' : ''}><div class="gallery">
${sections.map((s, i) => `<section class="sec" data-sec="${i}"><div class="cap">${s.title}</div><div class="msg">${s.html}</div></section>`).join('\n')}
</div></body></html>`

const light = page(false)
writeFileSync(join(OUT_DIR, 'iui-gallery.html'), light)
writeFileSync(join(OUT_DIR, 'iui-gallery-dark.html'), page(true))
const warn = (light.match(/个警告/g) ?? []).length + (light.match(/解析失败/g) ?? []).length
console.log(
  '✅ gallery →',
  join(OUT_DIR, 'iui-gallery.html'),
  (light.length / 1024).toFixed(0) + 'KB',
  '| sections',
  sections.length,
  '| 原生卡片:',
  light.includes('data-openui'),
  '| 自动编译:',
  light.includes('data-iui-compiled'),
  '| 警告:',
  warn
)
