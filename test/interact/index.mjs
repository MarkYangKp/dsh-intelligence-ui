import React from 'react'
import { createRoot } from 'react-dom/client'
import { renderTree, evaluateProgram } from '../../lib/openui-runtime.node.mjs'

const { root } = evaluateProgram(`root = Stack([m, c], "column", 12)
m = Map("测试地图", [{"lat": 31.2, "lon": 121.5, "label": "上海"}, {"lat": 39.9, "lon": 116.4, "label": "北京"}], [], [110, 20, 130, 45], 260, true)
c = Chart("测试图", "bar", [{name: "x", values: [1, 2, 3]}], [], ["一", "二", "三"])`)

const labels = Array.from({ length: 10 }, (_, i) => `22:${16 + i}`)
const fixtures = [
  labels,
  labels.slice(0, 8),
  ['22:16'],
  ['22:16', '22:17'],
  labels.map((_, i) => `服务节点${i}`),
  labels.map((_, i) => `这是很长的中文服务器标签${i}`),
  labels.map(() => 'ＡＢＣＤＥ'),
  ['很长的中文首标签', '很长的中文末标签'],
  labels.map((_, i) => `很长的中文服务器标签${i}`)
]
function App() {
  return React.createElement(
    'div',
    null,
    renderTree(root),
    ...fixtures.map((ticks, i) =>
      React.createElement(
        'div',
        {
          key: i,
          id: `chart-ticks-${i}`,
          style: { width: i >= 7 ? 120 : 240, fontFamily: 'Arial, sans-serif' }
        },
        renderTree(
          evaluateProgram(
            `root = Chart("CPU", "line", [{name: "CPU", values: ${JSON.stringify(ticks.map(() => 1.7))}}], [], ${JSON.stringify(ticks)}, 220, "number")`
          ).root
        )
      )
    )
  )
}
createRoot(document.getElementById('root')).render(React.createElement(App))
import './chart.mjs'
