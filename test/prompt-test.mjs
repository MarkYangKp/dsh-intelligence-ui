// 提示词质量测试：两个模块（呈现策略 / 组件能力）的完整性，以及「无固定模板」的约束。
import { evaluateProgram } from '../src/compiler-runtime-check.mjs'

const m = await import('../index.js')
let policy = '',
  capability = ''
let sections = 0
const contexts = []
m.apply({
  effect: (fn) => fn(),
  systemPrompt: {
    section: () => {
      sections++
      return () => {}
    },
    context: (o) => {
      contexts.push(o)
      if (/presentation-policy/.test(o.name)) policy = o.text
      else capability = o.text
      return () => {}
    }
  }
})

let pass = 0,
  fail = 0
const check = (n, c, d = '') => {
  c ? (pass++, console.log('✅ ' + n)) : (fail++, console.log('❌ ' + n + (d ? ' — ' + d : '')))
}

// ---- 模块拆分 ----
check(
  '两个模块都在 runtime context（system message 保持干净）',
  sections === 0 && contexts.length === 2,
  `section=${sections} context=${contexts.length}`
)
check(
  '策略先于能力（order 100 < 150）',
  contexts.length === 2 && contexts[0].order < contexts[1].order,
  contexts.map((c) => `${c.name}@${c.order}`).join(', ')
)
check('策略模块 > 2000 字', policy.length > 2000, `len=${policy.length}`)
check('能力模块 > 1500 字', capability.length > 1500, `len=${capability.length}`)

// ---- 呈现策略：自适应、非模板 ----
check('核心目标（形式服从内容）', policy.includes('用最适合内容的方式传递信息'))
check('明确「不是固定模板」', policy.includes('不是一套固定的页面模板'))
check('内容优先原则', policy.includes('内容优先，形式服务于表达'))
check('自适应组织信息', policy.includes('自适应组织信息'))
check('禁止相同骨架', policy.includes('不要让不同内容的回答呈现出相同的页面骨架'))
check(
  '自由组合（原语可自建）',
  policy.includes('自由组合，而非机械套用') && policy.includes('Box、Row、Col、Text、Icon')
)
check('准确克制（不编数据）', policy.includes('不得为了填充图表或指标卡片而编造数据'))
check('动态呈现策略章节', policy.includes('动态内容呈现策略'))
check('视觉组织章节', policy.includes('视觉组织与排版'))
check('生成与自检', policy.includes('生成与自检') && policy.includes('是否为了使用组件而使用组件'))
check(
  '策略里不含组件签名（职责分离）',
  !policy.includes('Stack([children]') && !policy.includes('StatCard(label')
)
check('混排策略：文字 + 界面块', policy.includes('普通文字与界面块混排'))
check(
  '职责边界：围栏机制只在能力模块',
  !policy.includes('openui 围栏') && capability.includes('插入的一块界面')
)
check(
  '能力模块：围栏可任意位置/多次',
  capability.includes('任意位置') && capability.includes('多次使用')
)

// ---- 旧模板痕迹必须消失 ----
for (const stale of [
  '内容原子 → 组件',
  '汇报型页面的结构范式',
  '默认用界面回复',
  '决策程序（每次回复前跑一遍'
]) {
  check(`旧模板已移除：${stale}`, !policy.includes(stale) && !capability.includes(stale))
}

// ---- 组件能力：完整 + 语法约定 ----
const comps = [
  'Box',
  'Row',
  'Col',
  'Text',
  'Stack',
  'Grid',
  'Card',
  'Callout',
  'StatCard',
  'Table',
  'SearchTable',
  'Chart',
  'PieChart',
  'Sparkline',
  'TreeView',
  'Diagram',
  'Button',
  'Tabs',
  'Accordion',
  'SegmentedControl',
  'Map',
  'Diff',
  'FileTree',
  'Checklist',
  'Heatmap',
  'CodeBlock',
  'KeyValue',
  'Timeline',
  'Steps',
  'ProgressBar',
  'ComparisonBar'
]
for (const c of comps) check(`能力模块含组件：${c}`, new RegExp(`\\b${c}\\(`).test(capability))
check('位置参数说明', capability.includes('位置参数'))
check('Text 尺寸值域说明', capability.includes('size=数字(px) 或 sm|md|lg|xl'))
check('weight 值域说明', capability.includes('weight=normal|medium|semibold|bold'))
check('布局方向值域说明', capability.includes('direction=column|row'))
check(
  'CodeBlock 增强参数',
  capability.includes('showLineNumbers') && capability.includes('highlight')
)
check('Table 汇总行参数', capability.includes('summary?'))
check(
  '视觉克制指引（高光数量 / 不堆卡 / 图标可选）',
  capability.includes('一屏只用 1–2 处彩色高光') &&
    capability.includes('不要堆叠同构卡片') &&
    capability.includes('图标是可选的')
)
check(
  'Card 强调/浮起参数说明',
  capability.includes('accent=none|brand|success|warning|error|info|neutral') &&
    capability.includes('elevated=false')
)
check(
  '语法约定（root / 中文键 / 无颜色）',
  capability.includes('root = Stack([...])') &&
    capability.includes('中文键加双引号') &&
    capability.includes('不写颜色')
)
check('围栏承载说明', capability.includes('openui 围栏'))

// ---- 语法约定抽样可解析（用能力模块里的签名写一个小程序）----
const sample = `root = Stack([h, t], "column", 12)
h = Heading("标题", 2)
t = Table(null, ["列"], [{"列": "值"}])`
const { root, errors } = evaluateProgram(sample)
check(
  '抽样程序可解析',
  root !== null && errors.length === 0,
  errors.map((e) => e.message).join(';')
)

console.log(
  `\n${pass} 通过, ${fail} 失败  (策略 ${policy.length} 字 / 能力 ${capability.length} 字)`
)
process.exit(fail > 0 ? 1 : 0)
