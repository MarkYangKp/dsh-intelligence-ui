import React from 'react'

/** Shared, bounded diagnostics; never coerce arbitrary objects via user-defined toString. */
export function displayText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—'
  try {
    return JSON.stringify(value) ?? '—'
  } catch {
    return '无法显示的数据'
  }
}

export function FallbackNotice({ children = '此内容暂时无法显示' }) {
  return (
    <div
      className="dsh-iui-notice"
      data-iui-fallback=""
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 'var(--dsh-content-font-size-secondary, 13px)',
        color: 'var(--dsw-alias-label-secondary)',
        lineHeight: 1.6,
        padding: '10px 14px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-md, 12px)',
        background: 'var(--dsw-alias-markdown-code-block)',
        overflowWrap: 'anywhere'
      }}
    >
      {children}
    </div>
  )
}

/** Reset failures on content changes without remounting healthy children. */
export class RenderBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false, resetKey: props.resetKey }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null
  }
  componentDidCatch(error, info) {
    // A visible fallback is a user-facing failure, so leave one diagnostic trace:
    // the boundary would otherwise look like a mysterious empty block in reports.
    try {
      console.error('[dsh-intelligence-ui] render boundary caught', error, info?.componentStack)
    } catch {
      /* no console in some embeddings */
    }
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? <FallbackNotice />) : this.props.children
  }
}

/** One timer per mounted control, including async clipboard rejection/unmount races. */
export function useCopyText(text) {
  const [status, setStatus] = React.useState('复制')
  const life = React.useRef({ mounted: false, timer: null, request: 0 })
  React.useEffect(() => {
    const current = life.current
    current.mounted = true
    return () => {
      current.mounted = false
      current.request++
      clearTimeout(current.timer)
    }
  }, [])
  const copy = async () => {
    const current = life.current
    const request = ++current.request
    clearTimeout(current.timer)
    let next = '已复制'
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(text)
    } catch {
      next = '请选中文字复制'
    }
    if (!current.mounted || request !== current.request) return
    setStatus(next)
    current.timer = setTimeout(() => {
      if (current.mounted) setStatus('复制')
    }, 1600)
  }
  return [status, copy]
}

/** Iterative graph budget: bounds evaluator/render work and detects ancestor cycles. */
export function assertDataBudget(value) {
  const ancestors = new Set()
  const stack = [{ value, depth: 0 }]
  let count = 0
  while (stack.length) {
    const item = stack.pop(),
      v = item.value
    if (item.leave) {
      ancestors.delete(v)
      continue
    }
    if (++count > 20000 || item.depth > 96) throw new Error('内容过于复杂，请拆分为较小的界面块')
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('数据含非有限数字')
    if (!v || typeof v !== 'object') continue
    if (ancestors.has(v)) throw new Error('数据存在循环引用')
    const entries = Object.values(v)
    if (entries.length > 1000) throw new Error('数据项过多，请分页或汇总')
    ancestors.add(v)
    stack.push({ value: v, leave: true })
    for (let i = entries.length - 1; i >= 0; i--)
      stack.push({ value: entries[i], depth: item.depth + 1 })
  }
}

/** Linear scan BEFORE recursive parser/normalizers. Quotes/comments do not count as syntax. */
export function assertSourceBudget(code) {
  if (typeof code !== 'string' || code.length > 64000)
    throw new Error('程序过长或格式无效，请拆分界面块')
  let quote = null,
    count = 0,
    syntax = ''
  const frames = [0]
  const topLevel = new Set()
  for (let i = 0; i < code.length; i++) {
    const c = code[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      syntax += ' '
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      continue
    }
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++
      syntax += '\n'
      continue
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      i = end < 0 ? code.length : end + 1
      syntax += ' '
      continue
    }
    if (frames.length === 1) topLevel.add(syntax.length)
    syntax += c
    if ('([{'.includes(c)) frames.push(0)
    if (')]}'.includes(c) && frames.length > 1) frames.pop()
    if (c === ',' && ++frames[frames.length - 1] > 1000) throw new Error('数据项过多，请分页或汇总')
    if (!/\s/.test(c)) count++
    if (frames.length > 65 || count > 16000) throw new Error('内容过于复杂，请拆分为较小的界面块')
  }
  // lang-core inlines references without memoization. A short DAG can otherwise
  // expand exponentially before the post-parse graph budget gets a chance to run.
  if (/\b(?:NaN|Infinity|\d[\d_]*_[\d_]*|0[xX][\da-fA-F]+)\b/.test(syntax))
    throw new Error('数字格式无效，请使用有限的十进制数字')
  const declarations = [...syntax.matchAll(/[A-Za-z_$][\w$]*\s*=(?!=)/g)].filter((m) =>
    topLevel.has(m.index)
  )
  if (declarations.length > 256) throw new Error('程序语句过多')
  const refs = new Map(
    declarations.map((m, i) => {
      const body = syntax.slice(m.index + m[0].length, declarations[i + 1]?.index)
      return [
        m[0].split('=')[0].trim(),
        [...body.matchAll(/[A-Za-z_$][\w$]*/g)]
          .filter((t) => !/^\s*:/.test(body.slice(t.index + t[0].length)))
          .map((t) => t[0])
      ]
    })
  )
  const memo = new Map(),
    active = new Set()
  const cost = (name) => {
    if (active.has(name) || active.size > 64) throw new Error('程序引用循环或过深')
    if (memo.has(name)) return memo.get(name)
    active.add(name)
    let total = 1
    for (const ref of refs.get(name) ?? []) {
      total += refs.has(ref) ? cost(ref) : 1
      if (total > 8000) throw new Error('程序引用展开过大，请拆分界面块')
    }
    active.delete(name)
    memo.set(name, total)
    return total
  }
  for (const name of refs.keys()) cost(name)
}
