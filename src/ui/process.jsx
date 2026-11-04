// 过程与结构：TreeView / Diagram。
// v3 视觉语言：图形放进「精密图版」——分层表面 + 发丝描边 + caption 标注；
// 节点形状按 label 宽度自适应（圆形 / 胶囊），彻底消除文字溢出圆形的问题；
// 播放状态用实底强调 + 浅语义底区分「当前 / 已访问 / 未访问」。
import React from 'react'
import { z } from 'zod'
import { defineComponent } from '@openuidev/lang-core'
import { displayText } from '../render-safety.jsx'
import {
  T,
  TINT,
  INK,
  FS,
  FW,
  LH,
  S,
  NUMS,
  TRACK,
  CAPTION_PX,
  radiusMd,
  radiusFull,
  alias
} from './theme.js'
import { PanelTitle, PlayControls, EmptyState, useExpanded } from './shared.jsx'

const clamp = (value, lo, hi) => {
  const n = Number(value)
  return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo))
}
/** 估算文本宽度（caption 字号下）：拉丁 0.6em / 全角 1em。 */
const glyphWidth = (ch) => (ch.codePointAt(0) < 0x2e80 ? 0.6 : 1)
const textWidth = (text, size) =>
  Array.from(String(text)).reduce((sum, ch) => sum + glyphWidth(ch) * size, 0)
/** 按可用宽度截断（超出补 …），保证节点标签永不越界。 */
const fitText = (text, size, maxWidth) => {
  const source = String(text)
  if (maxWidth == null || textWidth(source, size) <= maxWidth) return source
  const chars = Array.from(source)
  while (chars.length > 1 && textWidth(chars.join('') + '…', size) > maxWidth) chars.pop()
  return chars.join('') + '…'
}
/** 自适应节点形状：短标签用圆，长标签拉成胶囊。 */
const nodeShape = (label, radius, maxWidth) => {
  const height = Math.max(28, radius * 2)
  const pad = Math.min(20, Math.max(12, radius * 0.8))
  const inner = Math.max(12, (maxWidth ?? 200) - pad)
  const text = fitText(label, CAPTION_PX, inner)
  const width = textWidth(text, CAPTION_PX) + pad
  if (text === label && width <= radius * 2) {
    return { shape: 'circle', r: radius, h: radius * 2, text: label }
  }
  return {
    shape: 'pill',
    w: Math.min(width, maxWidth ?? 200),
    h: height,
    rx: Math.round(height / 2),
    text
  }
}
/** 图版外壳：分层表面 + 发丝描边；给定宽度时收缩为图版（figure），否则占满整行。 */
function Figure({ width, children }) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: radiusMd,
        background: T.surface,
        padding: S.md,
        minWidth: 0,
        boxSizing: 'border-box',
        width: width != null ? width + S.md * 2 : '100%',
        maxWidth: '100%',
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      {children}
    </div>
  )
}
/** 颜色图例：当前 / 已访问 / 未访问。 */
function Legend({ items }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: S.lg,
        flexWrap: 'wrap',
        marginTop: S.sm,
        fontSize: FS.caption,
        color: T.inkTertiary,
        letterSpacing: TRACK.caption
      }}
    >
      {items.map(([label, color, fill]) => (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: radiusFull,
              background: fill ?? 'transparent',
              border: fill ? 'none' : `1.5px solid ${color}`,
              boxSizing: 'border-box'
            }}
          />
          {label}
        </span>
      ))}
    </div>
  )
}

export const components = [
  defineComponent({
    name: 'TreeView',
    description:
      'Binary tree with animated traversal playback. Auto-layouts a binary tree from level-order values ' +
      '(null for empty). traversals picks which orders to offer: pre|in|post|level. ' +
      'Use it to explain tree traversals — nodes light up one by one with the visit order shown.',
    props: z.object({
      title: z.string().optional(),
      // 层序数组：数字/字符串/null 都接受（null 表示空位）
      values: z.array(z.union([z.number(), z.string(), z.null()])).default([]),
      // traversals 既接受单个字符串（"pre"）也接受数组
      traversals: z
        .union([
          z.enum(['pre', 'in', 'post', 'level']),
          z.array(z.enum(['pre', 'in', 'post', 'level']))
        ])
        .default(['pre', 'in', 'post']),
      height: z.number().default(220)
    }),
    component: ({ props }) => {
      // 层序数组 → 二叉树（null/'' 表示空位）
      const build = (vals) => {
        if (vals.length === 0) return null
        const mk = (i) => {
          if (i >= vals.length) return null
          const v = vals[i]
          if (v == null || v === '' || v === 'null') return null
          return { v: displayText(v), i, l: mk(2 * i + 1), r: mk(2 * i + 2) }
        }
        return mk(0)
      }
      const root = build(props.values)

      // 布局：中序遍历决定 x，深度决定 y
      const positions = {}
      let counter = 0
      let maxDepth = 0
      const layout = (n, d) => {
        if (!n) return
        maxDepth = Math.max(maxDepth, d)
        layout(n.l, d + 1)
        positions[n.i] = { x: counter++, y: d, node: n }
        layout(n.r, d + 1)
      }
      layout(root, 0)
      const total = counter || 1
      // 自然宽度随节点数增长：小树不被拉成巨图，大树也不会挤成一团。
      const W = clamp(120 + (total - 1) * 84, 600, 760)
      const H = clamp(Math.min(240, Number(props.height) || 220), 140, 240)
      const padX = 54
      const padTop = 42
      const padBottom = 36
      const dx = total > 1 ? (W - padX * 2) / (total - 1) : 0
      const dy = maxDepth > 0 ? (H - padTop - padBottom) / maxDepth : 0
      const px = (i) => (total === 1 ? W / 2 : padX + (positions[i]?.x ?? 0) * dx)
      const py = (i) => (maxDepth > 0 ? padTop + (positions[i]?.y ?? 0) * dy : H / 2)
      const maxLabel = clamp(total === 1 ? 200 : dx - 6, 38, 200)

      // 四种遍历序列
      const orders = {
        pre: [],
        in: [],
        post: [],
        level: []
      }
      const walk = (n) => {
        if (!n) return
        orders.pre.push(n.i)
        walk(n.l)
        orders.in.push(n.i)
        walk(n.r)
        orders.post.push(n.i)
      }
      walk(root)
      if (root) {
        const q = [root]
        while (q.length) {
          const n = q.shift()
          orders.level.push(n.i)
          if (n.l) q.push(n.l)
          if (n.r) q.push(n.r)
        }
      }

      const labels = { pre: '前序', in: '中序', post: '后序', level: '层序' }
      const traversals = [
        ...new Set(
          (Array.isArray(props.traversals) ? props.traversals : [props.traversals]).filter(
            (k) => labels[k] != null
          )
        )
      ]
      const list = traversals.length ? traversals : ['pre']
      const [kind, setKind] = React.useState(list[0] ?? 'pre')
      const seq = orders[kind] ?? []
      const [step, setStep] = React.useState(-1)
      const [playing, setPlaying] = React.useState(false)

      React.useEffect(() => {
        setStep(-1)
        setPlaying(false)
      }, [kind])
      React.useEffect(() => {
        if (!playing) return
        const t = setTimeout(() => {
          setStep((s) => {
            if (s + 1 >= seq.length) {
              setPlaying(false)
              return s
            }
            return s + 1
          })
        }, 800)
        return () => clearTimeout(t)
      }, [playing, step, seq.length])

      const visited = new Set(step >= 0 ? seq.slice(0, step + 1) : [])
      const current = step >= 0 ? seq[step] : undefined

      const summary =
        current != null
          ? `第 ${step + 1}/${seq.length} 步：访问 ${positions[current]?.node.v}　当前序列 ${seq
              .slice(0, step + 1)
              .map((i) => positions[i]?.node.v)
              .join(' → ')}`
          : `${labels[kind]}遍历 · 共 ${seq.length} 个节点，点击播放逐步演示`

      if (root == null) {
        return (
          <div style={{ minWidth: 0 }}>
            {props.title != null && <PanelTitle>{props.title}</PanelTitle>}
            <EmptyState>没有可展示的树节点</EmptyState>
          </div>
        )
      }

      return (
        <div style={{ minWidth: 0 }}>
          {props.title != null && <PanelTitle>{props.title}</PanelTitle>}
          {/* 遍历方式：分段控件风格胶囊 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: S.md,
              flexWrap: 'wrap',
              marginBottom: S.md
            }}
          >
            <div
              role="tablist"
              aria-label="遍历方式"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: 2,
                background: T.surfaceTint,
                borderRadius: radiusFull
              }}
            >
              {list.map((k) => {
                const active = kind === k
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setKind(k)}
                    style={{
                      border: `1px solid ${active ? T.border : 'transparent'}`,
                      background: active ? T.surface : 'transparent',
                      color: active ? T.ink : T.inkSecondary,
                      fontWeight: active ? FW.medium : FW.regular,
                      borderRadius: radiusFull,
                      padding: '3px 12px',
                      cursor: 'pointer',
                      fontSize: FS.caption,
                      lineHeight: 1.7,
                      letterSpacing: TRACK.caption
                    }}
                  >
                    {labels[k]}
                  </button>
                )
              })}
            </div>
          </div>

          <Figure width={W}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`${props.title ?? '二叉树'}；${labels[kind]}遍历`}
              style={{ width: '100%', height: 'auto', display: 'block', maxWidth: W }}
            >
              {Object.values(positions).map(({ node: n }) => (
                <g key={`e${n.i}`}>
                  {n.l && (
                    <line
                      x1={px(n.i)}
                      y1={py(n.i)}
                      x2={px(n.l.i)}
                      y2={py(n.l.i)}
                      stroke={T.border}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  )}
                  {n.r && (
                    <line
                      x1={px(n.i)}
                      y1={py(n.i)}
                      x2={px(n.r.i)}
                      y2={py(n.r.i)}
                      stroke={T.border}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  )}
                </g>
              ))}
              {Object.values(positions).map(({ node: n }) => {
                const isCur = n.i === current
                const isVis = visited.has(n.i)
                const order = seq.indexOf(n.i)
                const shape = nodeShape(n.v, 16, maxLabel)
                const fill = isCur ? T.accent : isVis ? TINT.success : T.surface
                const stroke = isCur ? T.accent : isVis ? T.success : T.borderStrong
                const ink = isCur ? T.inkInverted : isVis ? INK.success : T.ink
                return (
                  <g key={`n${n.i}`}>
                    {shape.shape === 'circle' ? (
                      <circle
                        cx={px(n.i)}
                        cy={py(n.i)}
                        r={shape.r}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isCur ? 2.5 : 1.5}
                        style={{ transition: 'fill .3s ease, stroke .3s ease' }}
                      />
                    ) : (
                      <rect
                        x={px(n.i) - shape.w / 2}
                        y={py(n.i) - shape.h / 2}
                        width={shape.w}
                        height={shape.h}
                        rx={shape.rx}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isCur ? 2.5 : 1.5}
                        style={{ transition: 'fill .3s ease, stroke .3s ease' }}
                      />
                    )}
                    <text
                      x={px(n.i)}
                      y={py(n.i)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={FS.caption}
                      fontWeight={FW.semibold}
                      fill={ink}
                      style={{ transition: 'fill .3s ease' }}
                    >
                      {shape.text}
                    </text>
                    {shape.text !== n.v && <title>{n.v}</title>}
                    {isVis && (
                      <text
                        x={px(n.i)}
                        y={py(n.i) - shape.h / 2 - 10}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={FS.caption}
                        fill={isCur ? INK.accent : T.inkTertiary}
                        fontWeight={FW.medium}
                        style={{ ...NUMS }}
                      >
                        #{order + 1}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </Figure>

          <Legend
            items={[
              ['当前', T.accent, T.accent],
              ['已访问', T.success, TINT.success],
              ['未访问', T.borderStrong, null]
            ]}
          />

          <div style={{ marginTop: S.md }}>
            <PlayControls
              playing={playing}
              step={step}
              total={seq.length}
              onPlay={() => setPlaying((p) => !p)}
              onPrev={() => setStep((v) => Math.max(-1, v - 1))}
              onNext={() => setStep((v) => Math.min(seq.length - 1, v + 1))}
              onReset={() => {
                setPlaying(false)
                setStep(-1)
              }}
            />
            <div
              style={{
                marginTop: S.sm,
                fontSize: FS.small,
                color: T.inkSecondary,
                lineHeight: LH.caption,
                minHeight: 18
              }}
            >
              {summary}
            </div>
          </div>
        </div>
      )
    }
  }),

  // ---------- 交互 ----------,
  defineComponent({
    name: 'Diagram',
    description:
      'Node-link diagram in SVG with step-by-step playback. Use for trees, graphs, flowcharts. ' +
      'nodes=[{id, label, x, y, variant?, sub?}], edges=[{from, to, label?, dashed?}], ' +
      'steps=[{label, highlight?: string[], visited?: string[], note?}] — clicking Play walks the steps, ' +
      'highlighting nodes so the reader can follow the algorithm. Coordinates are in a 0..width / 0..height box.',
    props: z.object({
      title: z.string().optional(),
      width: z.number().default(420),
      height: z.number().default(240),
      nodes: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            x: z.number(),
            y: z.number(),
            variant: z
              .enum([
                'default',
                'brand',
                'success',
                'warning',
                'error',
                'info',
                'neutral',
                'muted',
                'danger'
              ])
              .default('default'),
            sub: z.string().optional()
          })
        )
        .default([]),
      edges: z
        .array(
          z.object({
            from: z.string(),
            to: z.string(),
            label: z.string().optional(),
            dashed: z.boolean().default(false)
          })
        )
        .default([]),
      steps: z
        .array(
          z.object({
            label: z.string(),
            highlight: z.array(z.string()).default([]),
            visited: z.array(z.string()).default([]),
            note: z.string().optional()
          })
        )
        .default([]),
      nodeRadius: z.number().default(18)
    }),
    component: ({ props }) => {
      const [open, toggleExpand] = useExpanded()
      const [idx, setIdx] = React.useState(-1)
      const [playing, setPlaying] = React.useState(false)
      const hasSteps = props.steps.length > 0
      const cur = idx >= 0 ? props.steps[idx] : undefined

      React.useEffect(() => {
        if (!playing) return
        const t = setTimeout(() => {
          setIdx((i) => {
            if (i + 1 >= props.steps.length) {
              setPlaying(false)
              return i
            }
            return i + 1
          })
        }, 900)
        return () => clearTimeout(t)
      }, [playing, idx, props.steps.length])

      // 坐标归一：作者给的 0..width / 0..height 盒，按视口宽度等比缩放。
      const authorW = Math.max(1, Number(props.width) || 420)
      const authorH = Math.max(1, Number(props.height) || 240)
      const W = clamp(authorW, 240, 960)
      const H = clamp(authorH, 120, 720)
      const kx = W / authorW
      const ky = H / authorH
      const pos = Object.fromEntries(
        props.nodes.map((n) => {
          if (n == null || typeof n !== 'object') return [displayText(n), { x: 0, y: 0 }]
          return [
            displayText(n.id),
            {
              x: clamp(n.x, 0, authorW) * kx,
              y: clamp(n.y, 0, authorH) * ky
            }
          ]
        })
      )
      const baseR = clamp(clamp(props.nodeRadius, 10, 40) * Math.min(kx, ky), 9, 30)
      const hl = new Set(cur?.highlight ?? [])
      const vis = new Set(cur?.visited ?? [])
      const colorOf = (node) => {
        const id = displayText(node.id)
        if (hl.has(id)) return { fill: T.accent, stroke: T.accent, ink: T.inkInverted }
        if (vis.has(id)) return { fill: TINT.success, stroke: T.success, ink: INK.success }
        const v = alias('variant', node.variant)
        if (v === 'success') return { fill: TINT.success, stroke: T.success, ink: INK.success }
        if (v === 'warning') return { fill: TINT.warning, stroke: T.warning, ink: INK.warning }
        if (v === 'error') return { fill: TINT.danger, stroke: T.danger, ink: INK.danger }
        if (v === 'brand') return { fill: TINT.accent, stroke: T.accent, ink: INK.accent }
        return { fill: T.surface, stroke: T.borderStrong, ink: T.ink }
      }
      // 每个节点可用的最大标签宽度：同一水平层（视觉会碰撞）才互相约束，也不越出画布。
      const maxWidthFor = (node) => {
        const p = pos[displayText(node.id)]
        if (!p) return 120
        let limit = W * 0.5
        if (props.nodes.length <= 240) {
          for (const other of props.nodes) {
            if (other === node) continue
            const q = pos[displayText(other.id)]
            if (!q) continue
            // 垂直错开超过一个节点高度时不会撞到标签，不参与约束。
            if (Math.abs(q.y - p.y) > baseR * 2 + 16) continue
            const gap = Math.abs(q.x - p.x)
            if (gap > 0) limit = Math.min(limit, 2 * gap - 16)
          }
        }
        const canvasRoom = 2 * Math.min(p.x, Math.max(4, W - p.x)) - 12
        return clamp(Math.min(limit, canvasRoom), 34, 220)
      }
      // 节点形状 + 内容包围盒：裁掉作者坐标盒里的空白，图版不会出现大片空气。
      const shapes = new Map()
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (const node of props.nodes) {
        if (node == null || typeof node !== 'object') continue
        const id = displayText(node.id)
        const p = pos[id]
        if (!p) continue
        const shape = nodeShape(displayText(node.label), baseR, maxWidthFor(node))
        shapes.set(id, shape)
        const halfW = shape.shape === 'circle' ? shape.r : shape.w / 2
        minX = Math.min(minX, p.x - halfW)
        maxX = Math.max(maxX, p.x + halfW)
        minY = Math.min(minY, p.y - shape.h / 2)
        maxY = Math.max(maxY, p.y + shape.h / 2 + (node.sub != null ? 22 : 0))
      }
      // 边标签：在若干候选位置里挑第一个不压节点、不与其他标签重叠的位置。
      const nodeRects = []
      for (const [id, shape] of shapes) {
        const p = pos[id]
        if (!p) continue
        const halfW = shape.shape === 'circle' ? shape.r : shape.w / 2
        nodeRects.push({
          x1: p.x - halfW - 4,
          y1: p.y - shape.h / 2 - 4,
          x2: p.x + halfW + 4,
          y2: p.y + shape.h / 2 + 4
        })
      }
      const hits = (rect, list) =>
        list.some((q) => rect.x1 < q.x2 && rect.x2 > q.x1 && rect.y1 < q.y2 && rect.y2 > q.y1)
      const edgeLabels = new Map()
      const labelRects = []
      const dense = props.nodes.length > 120 || props.edges.length > 120
      props.edges.forEach((edge, i) => {
        if (edge == null || typeof edge !== 'object' || edge.label == null) return
        const a = pos[displayText(edge.from)]
        const b = pos[displayText(edge.to)]
        if (!a || !b) return
        const text = fitText(displayText(edge.label), CAPTION_PX, W * 0.32)
        if (!text) return
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const nx = -(b.y - a.y) / len
        const ny = (b.x - a.x) / len
        const halfW = textWidth(text, CAPTION_PX) / 2 + 3
        const halfH = 9
        const candidates = []
        for (const t of dense ? [0.5] : [0.5, 0.4, 0.6, 0.32, 0.68, 0.24, 0.76]) {
          for (const offset of dense ? [10] : [10, -10, 18, -18, 26, -26]) {
            candidates.push({
              x: a.x + (b.x - a.x) * t + nx * offset,
              y: a.y + (b.y - a.y) * t + ny * offset
            })
          }
        }
        let chosen = candidates[0]
        for (const c of candidates) {
          const rect = { x1: c.x - halfW, y1: c.y - halfH, x2: c.x + halfW, y2: c.y + halfH }
          if (!hits(rect, nodeRects) && !hits(rect, labelRects)) {
            chosen = c
            break
          }
        }
        edgeLabels.set(i, { text, x: chosen.x, y: chosen.y })
        const rect = {
          x1: chosen.x - halfW,
          y1: chosen.y - halfH,
          x2: chosen.x + halfW,
          y2: chosen.y + halfH
        }
        labelRects.push(rect)
        minX = Math.min(minX, rect.x1)
        maxX = Math.max(maxX, rect.x2)
        minY = Math.min(minY, rect.y1)
        maxY = Math.max(maxY, rect.y2)
      })
      const pad = 18
      const box = Number.isFinite(minX)
        ? {
            x: minX - pad,
            y: minY - pad,
            w: Math.max(96, maxX - minX + pad * 2),
            h: Math.max(72, maxY - minY + pad * 2)
          }
        : { x: 0, y: 0, w: W, h: H }

      if (props.nodes.length === 0) {
        return (
          <div style={{ minWidth: 0 }}>
            {props.title != null && <PanelTitle>{props.title}</PanelTitle>}
            <EmptyState>没有可展示的节点</EmptyState>
          </div>
        )
      }

      return (
        <div style={{ minWidth: 0 }}>
          {props.title != null && <PanelTitle>{props.title}</PanelTitle>}
          <Figure width={open ? null : Math.round(box.w)}>
            <svg
              viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
              role="img"
              aria-label={`${props.title ?? '示意图'}；${props.nodes.length} 个节点`}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                maxWidth: open ? '100%' : Math.round(box.w),
                transition: 'max-width .2s ease'
              }}
            >
              {props.edges.map((edge, i) => {
                if (edge == null || typeof edge !== 'object') return null
                const a = pos[displayText(edge.from)]
                const b = pos[displayText(edge.to)]
                if (!a || !b) return null
                const active = hl.has(displayText(edge.from)) || hl.has(displayText(edge.to))
                const placed = edgeLabels.get(i)
                return (
                  <g key={i}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={active ? T.accent : T.border}
                      strokeWidth={active ? 2 : 1.5}
                      strokeLinecap="round"
                      strokeDasharray={edge.dashed ? '5 5' : undefined}
                      style={{ transition: 'stroke .25s ease, stroke-width .25s ease' }}
                    />
                    {placed != null && (
                      <text
                        x={placed.x}
                        y={placed.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={FS.caption}
                        fill={active ? INK.accent : T.inkTertiary}
                        stroke={T.surface}
                        strokeWidth="3"
                        strokeLinejoin="round"
                        style={{ paintOrder: 'stroke' }}
                      >
                        {placed.text}
                      </text>
                    )}
                  </g>
                )
              })}
              {props.nodes.map((node) => {
                if (node == null || typeof node !== 'object') return null
                const id = displayText(node.id)
                const p = pos[id]
                if (!p) return null
                const c = colorOf(node)
                const shape = shapes.get(id) ?? nodeShape(displayText(node.label), baseR, 120)
                return (
                  <g key={id}>
                    {shape.shape === 'circle' ? (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={shape.r}
                        fill={c.fill}
                        stroke={c.stroke}
                        strokeWidth="1.5"
                        style={{ transition: 'fill .25s ease, stroke .25s ease' }}
                      />
                    ) : (
                      <rect
                        x={p.x - shape.w / 2}
                        y={p.y - shape.h / 2}
                        width={shape.w}
                        height={shape.h}
                        rx={shape.rx}
                        fill={c.fill}
                        stroke={c.stroke}
                        strokeWidth="1.5"
                        style={{ transition: 'fill .25s ease, stroke .25s ease' }}
                      />
                    )}
                    <text
                      x={p.x}
                      y={p.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={FS.caption}
                      fontWeight={FW.semibold}
                      fill={c.ink}
                      style={{ transition: 'fill .25s ease' }}
                    >
                      {shape.text}
                    </text>
                    {shape.text !== displayText(node.label) && (
                      <title>{displayText(node.label)}</title>
                    )}
                    {node.sub != null && (
                      <text
                        x={p.x}
                        y={p.y + shape.h / 2 + 12}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={FS.caption}
                        fill={T.inkTertiary}
                      >
                        {fitText(
                          displayText(node.sub),
                          CAPTION_PX,
                          Math.max(80, maxWidthFor(node))
                        )}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </Figure>

          {hasSteps && (
            <div style={{ marginTop: S.md }}>
              <PlayControls
                playing={playing}
                step={idx}
                total={props.steps.length}
                onPlay={() => setPlaying((p) => !p)}
                onPrev={() => setIdx((i) => Math.max(-1, i - 1))}
                onNext={() => setIdx((i) => Math.min(props.steps.length - 1, i + 1))}
                onReset={() => {
                  setPlaying(false)
                  setIdx(-1)
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: S.sm,
                  flexWrap: 'wrap',
                  marginTop: S.sm,
                  fontSize: FS.small,
                  lineHeight: LH.caption,
                  minHeight: 18
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} aria-hidden>
                  {props.steps.map((s, i) => {
                    const active = i === idx
                    return (
                      <span
                        key={i}
                        style={{
                          width: active ? 16 : 6,
                          height: 6,
                          borderRadius: radiusFull,
                          background: active ? T.accent : i < idx ? T.success : T.border,
                          transition: 'width .2s ease, background-color .2s ease'
                        }}
                      />
                    )
                  })}
                </span>
                {cur != null ? (
                  <span style={{ color: T.inkSecondary, minWidth: 0 }}>
                    <span style={{ ...NUMS }}>{`第 ${idx + 1}/${props.steps.length} 步`}</span>
                    <span style={{ color: T.ink, fontWeight: FW.medium }}>{` · ${cur.label}`}</span>
                  </span>
                ) : (
                  <span style={{ color: T.inkSecondary }}>
                    {`共 ${props.steps.length} 步，点击播放逐步演示`}
                  </span>
                )}
              </div>
              {cur?.note != null && (
                <div
                  style={{
                    fontSize: FS.caption,
                    color: T.inkTertiary,
                    lineHeight: LH.caption,
                    marginTop: S.xs
                  }}
                >
                  {cur.note}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: S.sm }}>
            <button
              type="button"
              onClick={toggleExpand}
              aria-expanded={open}
              className="dsh-iui-btn dsh-iui-btn-ghost dsh-iui-expand"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: FS.caption,
                color: T.inkTertiary,
                padding: '3px 10px',
                borderRadius: radiusFull,
                lineHeight: 1.6,
                ...NUMS
              }}
            >
              {open ? '收起' : `${props.nodes.length} 个节点 · 展开`}
            </button>
          </div>
        </div>
      )
    }
  })
]
