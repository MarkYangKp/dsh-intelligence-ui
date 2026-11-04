// Real React DOM fault injection and lifecycle regressions, no mock reconciler.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { IntelligenceAssistantNodeView } from '../../src/client.jsx'
import { OpenUICard, library } from '../../src/openui-runtime.jsx'

const checks = []
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) })
const host = document.createElement('div')
document.body.appendChild(host)
const root = createRoot(host)
const render = (node) => flushSync(() => root.render(node))
const nativeTimeout = window.setTimeout
const wait = () => new Promise((resolve) => nativeTimeout(resolve, 0))
const props = (text, status = 'settled') => ({
  node: {
    data: { status, step: 1, blocks: [{ kind: 'text', text }] },
    location: { kind: 'step', turn: { status: 'closed' } }
  },
  useDisclosure: () => ({ expanded: false, toggle: () => {} }),
  useGroupAction: () => null,
  useTurnData: () => undefined,
  fileMentions: () => undefined,
  usePresentation: (s) => s({ settledReasoningPreview: true }),
  renderSlot: () => null,
  t: (k) => k
})
const message = (text, status) => <IntelligenceAssistantNodeView {...props(text, status)} />
const failures = []
const uncaught = (e) => {
  failures.push(String(e.error ?? e.reason ?? e.message))
  e.preventDefault()
}
window.addEventListener('error', uncaught)
window.addEventListener('unhandledrejection', uncaught)

async function run() {
  // The independent bundle smoke root installs React's document delegation once.
  // Finish its initialization before measuring resources owned by this lifecycle.
  for (let i = 0; i < 100 && !window.__bundleReady; i++) await wait()
  if (!window.__bundleReady) throw new Error('bundle smoke did not initialize')
  for (const name of ['Chart', 'Map', 'Diagram', 'TreeView']) {
    const original = library.components[name].component
    library.components[name].component = () => {
      throw new Error('injected ' + name)
    }
    render(<OpenUICard key={name} code={`root = Stack([${name}(), Text("sibling")])`} />)
    check(
      name + ' 单组件异常保留兄弟',
      host.textContent.includes('sibling') && host.querySelector('[data-iui-fallback]')
    )
    library.components[name].component = original
    const recovered =
      name === 'Chart'
        ? 'Chart("recovered", "bar", [], [{label: "x", value: 1}])'
        : name === 'Map'
          ? 'Map("recovered", [{lat: 31, lon: 121}])'
          : name + '("recovered")'
    render(<OpenUICard key={name} code={`root = Stack([${recovered}, Text("sibling")])`} />)
    check(name + ' 内容修正后边界恢复', !host.querySelector('[data-iui-fallback]'))
  }
  const originalTable = library.components.Table.component
  library.components.Table.component = () => {
    throw new Error('compiled table fault')
  }
  const md = '| A | B |\n|---|---|\n| one | 2 |'
  render(message(md))
  check(
    '编译器发射程序受组件边界保护',
    host.querySelector('[data-iui-compiled] [data-iui-fallback]')
  )
  library.components.Table.component = originalTable
  const originalMap = library.components.Map.component
  library.components.Map.component = () => {
    const [expanded, expand] = React.useState(false)
    if (expanded) throw new Error('expansion render fault')
    return <button onClick={() => expand(true)}>expand-fault</button>
  }
  render(
    <OpenUICard
      code={
        'root = ' + 'Box(['.repeat(20) + 'Stack([Map(), Text("deep-sibling")])' + '])'.repeat(20)
      }
    />
  )
  check('深度原语组合正常显示', host.textContent.includes('deep-sibling'))
  flushSync(() => host.querySelector('button').click())
  check(
    '展开触发渲染异常仍保留深层兄弟',
    host.querySelector('[data-iui-fallback]') && host.textContent.includes('deep-sibling')
  )
  library.components.Map.component = originalMap
  render(message('```openui\n???\n```\n```openui\nroot = Text("fence-sibling")\n```'))
  check(
    '围栏块隔离',
    host.textContent.includes('fence-sibling') && host.querySelector('[data-iui-fallback]')
  )
  const invalid = props(null)
  invalid.node.data.blocks.push({ kind: 'text', text: 'block-sibling' })
  render(<IntelligenceAssistantNodeView {...invalid} />)
  check(
    '文本块预处理异常隔离',
    host.textContent.includes('block-sibling') && host.querySelector('[data-iui-fallback]')
  )
  render(
    <>
      <IntelligenceAssistantNodeView {...props('x')} node={null} />
      {message('message-sibling')}
    </>
  )
  check(
    '消息异常隔离',
    host.textContent.includes('message-sibling') && host.querySelector('[data-iui-fallback]')
  )

  // 用带展开控件的图表做流式稳定性回归（Map 在无数据时不再渲染展开按钮）。
  const source = '```openui\nroot = Chart("stream", "bar", [{name: "x", values: [1, 2, 3]}])'
  render(message(source, 'running'))
  await wait()
  const svg = host.querySelector('svg'),
    toggle = host.querySelector('button')
  flushSync(() => toggle.click())
  const scroll = host.querySelector('[data-openui]')
  scroll.style.height = '100px'
  scroll.style.overflow = 'auto'
  scroll.scrollTop = 30
  const beforeScroll = scroll.scrollTop
  for (let i = 0; i < 40; i++) render(message(source + '\n// chunk ' + i, 'running'))
  check(
    '快速流式重渲染保留控件实例',
    host.querySelector('svg') === svg && toggle.getAttribute('aria-expanded') === 'true'
  )
  render(message(source + '\nbad = Chart(height:', 'running'))
  check(
    '截断帧保留最近有效树及展开状态',
    host.querySelector('svg') === svg && toggle.getAttribute('aria-expanded') === 'true'
  )
  render(message(source + '\n```', 'settled'))
  check(
    '定稿不重挂载展开控件',
    host.querySelector('svg') === svg && toggle.getAttribute('aria-expanded') === 'true'
  )
  check('定稿保留滚动位置', scroll.scrollTop === beforeScroll && beforeScroll > 0)
  check('流式定稿不重播入场动画', getComputedStyle(scroll).animationName === 'none')

  render(<OpenUICard code={'root = Table(null, ["value"], [{value: 2}, {value: 1}])'} />)
  const header = host.querySelector('th')
  header.focus()
  flushSync(() =>
    header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  check(
    '表格键盘排序与焦点可用',
    document.activeElement === header &&
      header.getAttribute('aria-sort') === 'ascending' &&
      host.querySelector('tbody td').textContent === '1'
  )

  render(<OpenUICard code={'root = Stack([Text("ok"), Chart("x", "bad")])'} />)
  const details = host.querySelector('details')
  check('警告默认折叠且不阻塞正文', details && !details.open && host.textContent.includes('ok'))
  details.open = true
  check('诊断可展开选择', details.querySelector('pre')?.textContent.length > 0)
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.reject(new Error('denied')) }
  })
  details.querySelector('button').click()
  await wait()
  check('剪贴板拒绝有手动复制提示', details.textContent.includes('请选中文字复制'))
  render(null)

  // Count only resources created after React root initialization and test setup.
  const timers = new Map()
  const nativeClear = window.clearTimeout
  window.setTimeout = (fn, ms, ...args) => {
    const id = nativeTimeout(() => {
      timers.delete(id)
      fn(...args)
    }, ms)
    timers.set(id, ms)
    return id
  }
  window.clearTimeout = (id) => {
    timers.delete(id)
    nativeClear(id)
  }
  const nativeAdd = EventTarget.prototype.addEventListener
  const nativeRemove = EventTarget.prototype.removeEventListener
  const globalListeners = new Map()
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (this === window || this === document) globalListeners.set(listener, type)
    return nativeAdd.call(this, type, listener, options)
  }
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    globalListeners.delete(listener)
    return nativeRemove.call(this, type, listener, options)
  }
  const observers = new Set(),
    observerClasses = {}
  for (const name of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) {
    const Original = window[name]
    if (!Original) continue
    observerClasses[name] = Original
    window[name] = class extends Original {
      observe(...args) {
        observers.add(this)
        return super.observe(...args)
      }
      disconnect() {
        observers.delete(this)
        return super.disconnect()
      }
    }
  }
  let resolveCopy
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () =>
        new Promise((r) => {
          resolveCopy = r
        })
    }
  })
  render(<OpenUICard code={'root = CodeBlock("x", "js")'} />)
  host.querySelector('button').click()
  render(null)
  resolveCopy()
  await wait()
  check('复制 Promise 在卸载后完成不创建定时器', timers.size === 0)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.resolve() }
  })
  render(<OpenUICard code={'root = CodeBlock("x", "js")'} />)
  host.querySelector('button').click()
  await wait()
  check('复制反馈最多一个定时器', timers.size === 1)
  render(null)
  check('复制反馈定时器卸载清理', timers.size === 0)

  for (const code of [
    // 空 nodes 现在渲染空态（不再播放空图），给出两个真实节点回归播放定时器生命周期。
    'root = Diagram(null, 420, 240, [{id: "a", label: "A", x: 120, y: 120}, {id: "b", label: "B", x: 300, y: 120}], [{from: "a", to: "b"}], [{label: "one", highlight: ["a"]}, {label: "two", highlight: ["b"]}])',
    'root = TreeView(null, [1, 2, 3])'
  ]) {
    render(<OpenUICard code={code} />)
    const play = [...host.querySelectorAll('button')].find((b) => b.textContent === '播放')
    flushSync(() => play.click())
    check('播放创建单个定时器', timers.size === 1)
    render(null)
    check('播放卸载清理定时器', timers.size === 0)
  }
  const heaps = []
  for (let round = 0; round < 5; round++) {
    render(
      <>
        {Array.from({ length: 100 }, (_, i) => (
          <OpenUICard key={i} code={`root = Stack([Text("message-${round}-${i}"), Map()])`} />
        ))}
      </>
    )
    if (round === 0)
      check('百条消息同时渲染', host.querySelectorAll('[data-openui]').length === 100)
    for (let i = 0; i < 10; i++)
      render(
        <>
          {Array.from({ length: 100 }, (_, n) => (
            <OpenUICard key={n} code={`root = Text("update-${round}-${i}-${n}")`} />
          ))}
        </>
      )
    render(null)
    await wait()
    if (window.gc && performance.memory) {
      window.gc()
      heaps.push(performance.memory.usedJSHeapSize)
    }
  }
  check('长会话反复更新卸载无残留节点/定时器', host.childNodes.length === 0 && timers.size === 0)
  check('长会话无残留全局监听器/observer', globalListeners.size === 0 && observers.size === 0)
  check(
    '长会话 GC 后堆稳定（五轮百条，增量 < 8MiB）',
    heaps.length === 5 && heaps.at(-1) - heaps[0] < 8 * 1024 * 1024
  )
  checks.push({
    name: `堆测量：${heaps.map((n) => (n / 1048576).toFixed(2)).join(' → ')} MiB`,
    ok: heaps.length === 5
  })
  window.setTimeout = nativeTimeout
  window.clearTimeout = nativeClear
  EventTarget.prototype.addEventListener = nativeAdd
  EventTarget.prototype.removeEventListener = nativeRemove
  for (const [name, Original] of Object.entries(observerClasses)) window[name] = Original
  if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
  else delete navigator.clipboard
  await wait()
  check('无未捕获异常/Promise rejection', failures.length === 0)
}
run()
  .catch((e) => {
    check(
      '生命周期测试执行完成：' +
        e.message +
        ' @ ' +
        String(e.stack ?? '')
          .split('\n')
          .slice(1, 4)
          .join(' | '),
      false
    )
  })
  .finally(() => {
    root.unmount()
    window.removeEventListener('error', uncaught)
    window.removeEventListener('unhandledrejection', uncaught)
    const report = document.createElement('pre')
    report.textContent = 'LIFECYCLE:' + JSON.stringify({ checks })
    document.body.appendChild(report)
  })
