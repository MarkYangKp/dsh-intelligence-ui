import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { loadClient, messageProps } from './client-fixture.mjs'
await import('../src/compiler-runtime-check.mjs')
const { evaluateProgram, renderTree, OpenUICard, normalizeNamedArgs } =
  await import('../lib/openui-runtime.node.mjs')
import { compileReply } from '../src/compiler.mjs'

let pass = 0,
  fail = 0
function test(name, fn) {
  try {
    fn()
    pass++
    console.log('✅ ' + name)
  } catch (e) {
    fail++
    console.error('❌ ' + name + ': ' + e.message.slice(0, 500))
  }
}
const client = loadClient()
const message = (text, status) =>
  renderToString(
    React.createElement(client.IntelligenceAssistantNodeView, messageProps(text, status))
  )
const card = (code, streaming = false) =>
  renderToString(React.createElement(OpenUICard, { code, streaming }))
const rejected = (code) => {
  const r = evaluateProgram(code)
  assert.ok(r.root === null, 'expected bounded rejection')
  assert.ok(r.errors.length)
  assert.match(card(code), /data-iui-fallback|解析失败/)
}
test('200 层原语在解析前降级', () =>
  rejected('root = ' + 'Box(['.repeat(200) + 'Text("leaf")' + '])'.repeat(200)))
test('巨型数组在解析前降级', () =>
  rejected('root = TreeView(null, [' + Array(5000).fill('1').join(',') + '])'))
test('超长程序有界降级', () => rejected('root = Text("' + 'a'.repeat(100000) + '")'))
test('短程序引用膨胀在解析前降级', () => {
  const lines = ['a0 = Text("leaf")']
  for (let i = 1; i <= 24; i++) lines.push(`a${i} = Box([a${i - 1}, a${i - 1}])`)
  rejected(lines.join('\n') + '\nroot = a24')
})
test('200 层变量引用链有界降级', () => {
  rejected(
    Array.from({ length: 200 }, (_, i) => `a${i} = Box([a${i + 1}])`).join('\n') +
      '\na200 = Text("leaf")\nroot = a0'
  )
})
test('200 层文件路径安全降级', () =>
  assert.match(
    card('root = FileTree(null, [{path: "' + 'dir/'.repeat(200) + 'file"}])'),
    /data-iui-fallback/
  ))
test('Chart 混合非法数据不会产生 NaN 几何', () =>
  assert.doesNotMatch(
    card('root = Chart(null, "line", [{name: "x", values: [1, {}]}])'),
    /(?:d|cy)="[^"]*NaN/
  ))
for (const code of [
  'root = Chart(null,"line",[{name:"x",values:[1e308,-1e308]}])',
  'root = Sparkline([1e308,-1e308])',
  'root = PieChart(null,[{label:"a",value:1e308},{label:"b",value:1e308}])',
  'root = Diagram(null, 0, 0)'
])
  test('派生几何溢出/无效尺寸降级：' + code.split('(')[0], () => {
    const html = card(code)
    assert.match(html, /data-iui-fallback/)
    assert.doesNotMatch(html, /NaN|Infinity/)
  })
test('同一行引用膨胀不可绕过预算', () => {
  const lines = ['a0 = Text("leaf")']
  for (let i = 1; i <= 24; i++) lines.push(`a${i} = Box([a${i - 1}, a${i - 1}])`)
  rejected(lines.join(' ') + ' root = a24')
})
test('对象同名键不误判为变量自引用', () =>
  assert.ok(evaluateProgram('data = {data: 1}\nroot = Table(null, ["data"], [data])').root))
for (const [name, source] of [
  ['自引用对象', 'a = {next: a}\nroot = TreeView(null, [a])'],
  ['互相引用', 'a = Box([b])\nb = Box([a])\nroot = Stack([a])'],
  ['非字符串键', 'root = Table(null, [1, {}], [{a: 1}])'],
  ['NaN', 'root = Chart(null, "bar", [{name: "bad", values: [NaN]}])'],
  ['Infinity', 'root = Chart(null, "line", [{name: "bad", values: [Infinity]}])'],
  ['指数溢出', 'root = Chart(null, "line", [{name: "bad", values: [1e999, 2]}])'],
  ['数字分隔符', 'root = Sparkline([1_000, 2])'],
  ['十六进制', 'root = Sparkline([0x10, 2])'],
  ['乱序参数截断', 'root = Chart(height: 240, series: [{name: "a", values: [1,'],
  ['字符串截断', 'root = Text("hello'],
  ['Map 畸形坐标', 'root = Map(null, [{lat: {}, lon: "x"}], [[null]])'],
  ['Diagram 畸形节点', 'root = Diagram(null, 420, 240, [{id: {}, x: "x"}], [{from: 1}])']
])
  test(name + '不抛异常且不输出非法几何', () => {
    const html = card(source)
    assert.ok(typeof html === 'string')
    assert.doesNotMatch(html, /(?:d|viewBox|cx|cy|x|y|width|height)="[^"]*(?:NaN|Infinity)/)
  })
test('Table 对象汇总值安全显示，兄弟组件保留', () => {
  const html = card(
    'root = Stack([Table(null, ["a"], [{a: 1}], false, true, false, [], null, {a: {total: 1}}), Text("sibling")])'
  )
  assert.match(html, /sibling/)
  assert.match(html, /total/)
})
test('Chart 非标量图例安全显示', () => {
  const html = card(
    'root = Chart(null, "line", [{name: {a: 1}, values: [1, 2]}, {name: "ok", values: [2, 3]}])'
  )
  assert.match(html, /ok/)
})
test('未知组件不沿原型链查找', () => {
  const html = renderToString(renderTree({ type: 'element', typeName: 'constructor', props: {} }))
  assert.match(html, /data-iui-fallback/)
})
test('循环渲染树有界降级', () => {
  const v = []
  v.push(v)
  assert.match(renderToString(renderTree(v)), /data-iui-fallback/)
})
test('命名参数不会修改字符串里的示例代码', () => {
  const r = normalizeNamedArgs('root = Text(text: "Box(gap: 3)")')
  assert.match(r.code, /"Box\(gap: 3\)"/)
})
test('命名槽不被混合位置参数覆盖', () => {
  const r = evaluateProgram('root = Section(title: "kept", [Text("child")])')
  assert.equal(r.root.props.title, 'kept')
  assert.match(renderToString(renderTree(r.root)), /child/)
})
test('定稿未闭合坏围栏不永久静默', () => {
  assert.match(message('```openui\n???'), /data-iui-fallback|解析失败/)
})
test('流式空围栏保留原文', () => assert.match(message('```openui\n', 'running'), /data-md/))
test('嵌套 Markdown 围栏不误执行内层程序', () => {
  const parts = client.splitOpenUIFences(
    '````markdown\n```openui\nroot = Text("example")\n```\n````'
  )
  assert.ok(parts.every((p) => p.kind === 'md'))
})
test('超过 100 个围栏不丢尾文', () => {
  const parts = client.splitOpenUIFences(
    '```openui\nroot = Text("x")\n```\n'.repeat(101) + 'tail-marker'
  )
  assert.ok(parts.some((p) => p.text?.includes('tail-marker')))
})
test('坏围栏不影响后面的兄弟围栏', () => {
  const html = message('```openui\n???\n```\n```openui\nroot = Text("survives")\n```')
  assert.match(html, /survives/)
})
test('警告可折叠且有可复制诊断', () => {
  const html = card('root = Stack([Text("survives"), Chart("x", "invalid")])')
  assert.match(html, /survives/)
  assert.match(html, /<details/)
  assert.match(html, /复制/)
  assert.match(html, /<pre/)
})
for (const [name, md] of [
  ['表格错列', '| A | B |\n|---|---|\n| 1 | 2 | extra |'],
  ['表格重复键', '| A | A |\n|---|---|\n| 1 | 2 |'],
  ['表格空键', '| A | |\n|---|---|\n| 1 | 2 |'],
  ['表格坏分隔', '| A | B |\n|---|x-|\n| 1 | 2 |'],
  ['表格溢出数字', '| A | B |\n|---|---|\n| row | ' + '9'.repeat(400) + ' |'],
  ['超长行', 'a'.repeat(2500) + '\n\n1. first\n2. second'],
  ['混合嵌套列表', '1. first\n  - nested\n    1. deeper\n2. second'],
  ['未闭合代码块', '1. first\n2. second\n\n```js\nconst x = 1']
])
  test('编译器确定性退回文字：' + name, () => {
    const r = compileReply(md)
    assert.equal(r.mode, 'text')
    assert.deepEqual(compileReply(md), r)
  })
// —— 命名参数兜底的采用标准与 KeyValue 速记纠正(回归语料:13 条警告 → 1 条真实错误) ——
const mixedNamed = `root = Stack([
  Row([
    StatCard("CPU 使用率", "9.2%", note="user 5.1% · system 3.7%", accent="success"),
    StatCard("内存已用", "4.4 GB / 32 GB", note="实际占 13%", accent="success")
  ], 12),
  Row([
    Section("CPU 趋势", [
      Chart(type="line", series=[{name: "CPU 使用率", values: [9.4, 9.5, 9.3]}], labels=["-15m","-13.5m","-12m"], height=140, showLegend=false)
    ]),
    Section("系统负载", [
      KeyValue(items=[{"load 1min": "0.40"}, {"load 5min": "0.50"}], columns=3),
      TextContent("负载远低于核数。", "sm", true)
    ])
  ], 12, 6)
])`
test('命名参数+真实错误混合时采用更优重试(警告收敛)', () => {
  const r = evaluateProgram(mixedNamed)
  assert.ok(r.root !== null, 'root 应渲染')
  assert.equal(
    r.errors.length,
    0,
    'Row(x, 12, 6) 的 6 落在 align 槽属类型不可能值,应被静默丢弃,实际: ' +
      r.errors.map((e) => e.message).join(' // ')
  )
  const s = JSON.stringify(r.root)
  assert.ok(s.includes('CPU 使用率'), 'StatCard label 应绑定')
  assert.ok(s.includes('user 5.1%'), 'note 应绑定')
  assert.ok(s.includes('9.4'), 'Chart 系列应绑定')
  assert.ok(s.includes('0.40'), 'KeyValue 值应绑定')
})
test('类型不可能值落可选枚举槽被静默丢弃(位置参数)', () => {
  const r = evaluateProgram('root = Row([TextContent("x")], 12, 6)')
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
  assert.ok(r.root)
})
test('类型不可能值落可选枚举槽被静默丢弃(命名参数)', () => {
  const r = evaluateProgram('root = Row([TextContent("x")], gap=12, align=6)')
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
  assert.ok(r.root)
})
test('丢弃错误值后后续参数仍按形状入槽', () => {
  const r = evaluateProgram('root = Row([TextContent("x")], 12, 6, "center")')
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
  assert.ok(r.root)
})
test('字符串值不合法的枚举仍保留警告(可修正反馈)', () => {
  const r = evaluateProgram('root = Row([TextContent("x")], 12, "6")')
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0].message, /align/)
})
test('必填槽的类型错误不因丢弃而静默(仍报错)', () => {
  const r = evaluateProgram('root = TextContent(123)')
  assert.ok(r.errors.length >= 1, '必填 text 槽收数字必须产生错误反馈')
})
test('KeyValue 单键对象速记纠正为 {label, value}(命名参数)', () => {
  const r = evaluateProgram(
    'root = KeyValue(items=[{"load 1min": "0.40"}, {"load 5min": "0.50"}], columns=3)'
  )
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
  assert.ok(JSON.stringify(r.root).includes('0.40'))
})
test('KeyValue 单键对象速记纠正(位置参数)', () => {
  const r = evaluateProgram('root = KeyValue([{"负载 1min": "0.40"}], 3)')
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
  assert.ok(JSON.stringify(r.root).includes('0.40'))
})
test('KeyValue 规范 {label,value} 写法不受速记纠正影响', () => {
  const r = evaluateProgram(
    'root = KeyValue([{label: "a", value: "1"}, {label: "b", value: "2"}], 2)'
  )
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
  const s = JSON.stringify(r.root)
  assert.ok(s.includes('"a"') && s.includes('"2"'))
})
test('混合条目只纠正单键对象,多键条目保留', () => {
  const r = evaluateProgram('root = KeyValue([{label: "a", value: "1"}, {"b": "2"}])')
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
  const s = JSON.stringify(r.root)
  assert.ok(s.includes('"a"') && s.includes('"b"') && s.includes('"2"'))
})

// —— 模型输出形态回归:Text 的 size 位置参常写成 sm/lg 等尺寸 token ——
// 旧行为把 "sm" 重绑到 weight 槽 → "field /weight expects one of [...] but got sm"
const realWeightCase = `root = Stack([
  Text("放行 → 表单提交耗时（测试环境实测 RTT≈30ms）", "sm", color="secondary"),
  ComparisonBar("单次提交耗时", [{label: "旧：串行校验", value: 960, variant: "error"}, {label: "新：预取码", value: 40, variant: "success"}], true, "ms"),
  Text("失败重试间隔：中位 3200ms → 约 90ms", "sm", color="secondary"),
])`
test('Text 位置尺寸 token 不再被重绑到 weight(回归语料)', () => {
  const r = evaluateProgram(realWeightCase)
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
  const texts = r.root.props.children.filter((c) => c && c.typeName === 'Text')
  assert.equal(texts.length, 2)
  assert.equal(texts[0].props.size, 'sm')
  assert.equal(texts[0].props.color, 'secondary')
  assert.equal(texts[1].props.size, 'sm')
})
test('Text 尺寸 token 与 weight 各自归槽', () => {
  const sm = evaluateProgram('root = Text("x", "sm")')
  assert.equal(sm.errors.length, 0, sm.errors.map((e) => e.message).join(' // '))
  assert.equal(sm.root.props.size, 'sm')
  const bold = evaluateProgram('root = Text("x", "bold")')
  assert.equal(bold.errors.length, 0, bold.errors.map((e) => e.message).join(' // '))
  assert.equal(bold.root.props.weight, 'bold')
  const both = evaluateProgram('root = TextContent("x", "lg", "bold")')
  assert.equal(both.errors.length, 0, both.errors.map((e) => e.message).join(' // '))
  assert.equal(both.root.props.size, 'lg')
  assert.equal(both.root.props.weight, 'bold')
})
test('命名参数把尺寸值写进 weight 槽时归位到 size', () => {
  const r = evaluateProgram('root = Text("x", weight="sm")')
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
  assert.equal(r.root.props.size, 'sm')
})
test('Stack 方向/对齐混写(回归语料)被语义归位', () => {
  const r = evaluateProgram('root = Stack([TextContent("a")], "flex", "column", 18)')
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
  assert.equal(r.root.props.direction, 'column')
  assert.equal(r.root.props.gap, 18)
})
test('无法归位的字符串值不硬塞进可选枚举槽', () => {
  const r = evaluateProgram('root = Stack([TextContent("a")], direction="flex")')
  assert.equal(r.errors.length, 0, r.errors.map((e) => e.message).join(' // '))
})

// —— 默认形状绑定不许破坏合法的声明顺序位置参数（回归语料:Map links / TreeView traversals） ——
test('嵌套数组与联合枚举数组按声明顺序入槽', () => {
  const map = evaluateProgram(
    'root = Map("标题", [{lat: 31.2, lon: 121.4, label: "上海", value: 42}], [[0, 1]], [116, 28, 124, 35], 280, true)'
  )
  assert.equal(map.errors.length, 0, map.errors.map((e) => e.message).join(' // '))
  assert.deepEqual(map.root.props.links, [[0, 1]])
  assert.deepEqual(map.root.props.bbox, [116, 28, 124, 35])
  assert.equal(map.root.props.height, 280)
  const tv = evaluateProgram(
    'root = TreeView("", ["A", "B", "C"], ["pre", "in", "post", "level"], 230)'
  )
  assert.equal(tv.errors.length, 0, tv.errors.map((e) => e.message).join(' // '))
  assert.deepEqual(tv.root.props.values, ['A', 'B', 'C'])
  assert.deepEqual(tv.root.props.traversals, ['pre', 'in', 'post', 'level'])
  assert.equal(tv.root.props.height, 230)
})
test('Text 尺寸 token 输出主题字号而非落回正文', () => {
  const html = card('root = Stack([Text("小字", "sm"), Text("大字", "lg")])')
  // v3 字号阶梯：sm→small（---dsh-content-font-size-secondary）、lg→lead（正文字号 +1px）。
  assert.match(html, /--dsh-content-font-size-secondary/)
  assert.match(html, /--dsh-content-font-size, 14px\) \+ 1px/)
})

// 用户报障的端到端形态：真实回复消息里带 openui 围栏，卡片不出现警告面板。
test('真实回复围栏不再渲染 weight 警告面板', () => {
  const html = message(
    '关键路径对比：\n\n```openui\n' + realWeightCase + '\n```\n\n- 结论：预取码后耗时 40ms。'
  )
  assert.match(html, /放行/)
  assert.doesNotMatch(html, /个警告/)
  assert.doesNotMatch(html, /data-iui-fallback|解析失败/)
})

console.log(`\n${pass} 通过, ${fail} 失败 (adversarial)`)
process.exitCode = fail ? 1 : 0
