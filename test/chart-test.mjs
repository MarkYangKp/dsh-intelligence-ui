import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { evaluateProgram } from '../src/compiler-runtime-check.mjs'
const { renderTree } = await import('../lib/openui-runtime.node.mjs')
let pass = 0,
  fail = 0
const test = (name, fn) => {
  try {
    fn()
    pass++
    console.log('✅ ' + name)
  } catch (error) {
    fail++
    console.error('❌ ' + name + ': ' + error.message)
  }
}
const times = Array.from({ length: 10 }, (_, i) => `22:${16 + i}`)
const render = (labels, format = 'number', type = 'line', values = labels.map(() => 1.7)) => {
  const result = evaluateProgram(
    `root = Chart("CPU", "${type}", [{name: "CPU", values: ${JSON.stringify(values)}}], [], ${JSON.stringify(labels)}, 220, "${format}")`
  )
  assert.deepEqual(result.errors, [])
  return renderToStaticMarkup(renderTree(result.root))
}
const ticks = (html) => [
  ...html.matchAll(/<span[^>]*data-chart-x-tick="(\d+)"[^>]*>([^<]*)<\/span>/g)
]
const indices = (html) => ticks(html).map((m) => Number(m[1]))
const yTicks = (html) =>
  [...html.matchAll(/<span[^>]*data-chart-y-tick="[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1])
const maxTicks = Math.max(2, Math.floor((240 * 416) / 480 / (5 * 0.6 * 11 + 12)))
test('10 个等宽时间标签不超过紧凑容量，首尾保留', () => {
  const found = indices(render(times))
  assert.ok(found.length >= 2 && found.length <= maxTicks)
  assert.equal(found[0], 0)
  assert.equal(found.at(-1), 9)
})
test('SSR 两次渲染完全一致', () => assert.equal(render(times), render(times)))
test('奇数步长 3 保留末标签', () => {
  assert.deepEqual(indices(render(times)), [0, 3, 6, 9])
  assert.deepEqual(indices(render([...times, '22:26'])), [0, 3, 6, 10])
})
test('尾部余数替换邻近刻度，避免强行追加', () =>
  assert.deepEqual(indices(render(times.slice(0, 8))), [0, 4, 7]))
for (const n of [1, 2])
  test(`${n} 个标签全部保留`, () =>
    assert.deepEqual(
      indices(render(times.slice(0, n))),
      Array.from({ length: n }, (_, i) => i)
    ))
test('超长标签截断且 title 保留完整文本', () => {
  const labels = Array.from({ length: 10 }, (_, i) => `这是一个很长的服务器名称${i}`)
  const html = render(labels)
  assert.ok(ticks(html).length >= 2)
  assert.ok(ticks(html).length <= 2)
  assert.ok(ticks(html).every((m) => m[2] === '这是一个很…'))
  assert.ok(html.includes(`title="${labels.at(-1)}"`))
})
test('中文与全角按完整字号估算', () => {
  const html = render(Array.from({ length: 10 }, (_, i) => `服务节点${i}`))
  assert.ok(ticks(html).length >= 2 && ticks(html).length <= 3)
  assert.equal(indices(html).at(-1), 9)
  assert.ok(ticks(render(Array.from({ length: 10 }, () => 'ＡＢＣＤＥ'))).length <= 3)
})
test('隐藏标签保留可访问文本，数据点仍为 10 个', () => {
  const html = render(times)
  assert.ok(html.includes(`aria-label="CPU；${times.join('、')}"`))
  assert.equal((html.match(/<circle /g) || []).length, 10)
})
for (const type of ['bar', 'area'])
  test(`${type} 只抽稀标签，保留全部几何`, () => {
    const html = render(times, 'number', type)
    assert.ok(ticks(html).length >= 2 && ticks(html).length <= maxTicks)
    assert.equal((html.match(type === 'bar' ? /<rect /g : /<circle /g) || []).length, 10)
    assert.equal(indices(html).at(-1), 9)
  })
for (const format of ['number', 'compact', 'percent'])
  test(`${format} 正负小数保留前导零`, () => {
    const suffix = format === 'percent' ? '%' : ''
    assert.ok(yTicks(render(times, format)).includes('0.85' + suffix))
    const negative = yTicks(render(times, format, 'line', [-0.85, 1.7]))
    assert.ok(negative.includes('-0.85' + suffix))
    assert.ok(negative.every((v) => !/^-?\./.test(v)))
  })
test('compact 大数单位和 number 分组保留', () => {
  assert.ok(yTicks(render(times, 'compact', 'line', [10000])).includes('1.0万'))
  assert.ok(yTicks(render(times, 'compact', 'line', [100000000])).includes('1.0亿'))
  assert.ok(yTicks(render(times, 'number', 'line', [10000])).includes('10,000'))
})
console.log(`\n${pass} 通过, ${fail} 失败 (chart SSR)`)
process.exitCode = fail ? 1 : 0
