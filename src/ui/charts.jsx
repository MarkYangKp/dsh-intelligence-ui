// 图表：Chart / PieChart / Sparkline / Heatmap。
// 视觉语言（v3）：业务蓝为主的数据色 + 3 条发丝网格 + 结构性零基线；
// 坐标轴统一 FS.caption / inkTertiary；折线节点实心 + 表面描边；面板标题统一 PanelTitle。
import React from 'react'
import { z } from 'zod'
import { defineComponent } from '@openuidev/lang-core'
import { displayText, FallbackNotice } from '../render-safety.jsx'
import {
  T,
  FS,
  FW,
  S,
  NUMS,
  TRACK,
  radiusMd,
  radiusXs,
  radiusFull,
  tint,
  soften,
  PALETTE,
  CHART_WIDTH,
  TICK_GAP,
  tickText,
  chartTickIndices,
  seriesColor,
  alias
} from './theme.js'
import { PanelTitle, useExpanded, ExpandToggle } from './shared.jsx'

/** 水平网格线 / Y 轴刻度的位置（3 档，与既有 SSR 回归口径一致）。 */
const Y_TICKS = [0, 0.5, 1]

/** 紧凑数字：中心合计、坐标轴之外的注释用（不做千分位时保持短）。 */
const compactNumber = (value) => {
  const abs = Math.abs(value)
  if (abs >= 1e8) return `${(value / 1e8).toFixed(1)}亿`
  if (abs >= 1e4) return `${(value / 1e4).toFixed(1)}万`
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? rounded.toLocaleString('zh-CN') : String(rounded)
}

export const components = [
  defineComponent({
    name: 'Chart',
    description:
      'SVG chart with axes, grid and legend. type=bar|line|area. Two data shapes: ' +
      'series=[{name, values:number[], color?}] for multi-series (recommended), or ' +
      'data=[{label, value}] for a single series. labels=[string] supplies x-axis labels. ' +
      'yFormat=number|compact|percent formats the axis.',
    props: z.object({
      title: z.string().optional(),
      type: z.enum(['bar', 'line', 'area', 'column', 'spline', 'curved', 'smooth']).default('bar'),
      // 容忍两种写法：多系列 [{name, values}] 与单系列点集 [{label, value}]
      series: z.array(z.record(z.string(), z.unknown())).default([]),
      data: z.array(z.object({ label: z.string(), value: z.number() })).default([]),
      labels: z.array(z.string()).default([]),
      height: z.number().default(220),
      yFormat: z.enum(['number', 'compact', 'percent']).default('compact'),
      showLegend: z.boolean().default(true),
      showGrid: z.boolean().default(true),
      stacked: z.boolean().default(false)
    }),
    component: ({ props }) => {
      const [open, toggle] = useExpanded()
      const plotRef = React.useRef(null)
      const [measuredWidth, setMeasuredWidth] = React.useState(0)
      React.useEffect(() => {
        const plot = plotRef.current
        if (!plot) return
        const measure = () => setMeasuredWidth(plot.getBoundingClientRect().width)
        measure()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(measure)
        observer.observe(plot)
        return () => observer.disconnect()
      }, [open, props])
      // 归一化：series 优先，退回单系列 data
      const chartType = alias('type', props.type)
      const rawSeries = (props.series ?? []).filter((s) => s && typeof s === 'object')
      // 单系列点集误放在 series 位置：{label, value} → 一个系列
      const isPointShape =
        rawSeries.length > 0 &&
        rawSeries.every(
          (s) => s && typeof s === 'object' && !Array.isArray(s.values) && 'value' in s
        )
      const series = (
        isPointShape
          ? [
              {
                name: props.title ?? '值',
                values: rawSeries.map((s) => Number(displayText(s.value)))
              }
            ]
          : rawSeries
      ).filter((s) => s && Array.isArray(s.values) && s.values.length > 0)
      if (series.length === 0)
        series.push({ name: props.title ?? '值', values: props.data.map((d) => d.value) })
      const labels =
        props.labels.length > 0
          ? props.labels
          : isPointShape
            ? rawSeries.map((s) => String(s.label ?? ''))
            : props.data.map((d) => d.label)
      const hasData = series.some((s) => s.values.some((v) => Number.isFinite(v)))
      const invalidData = series.some((s) =>
        s.values.some((v) => typeof v !== 'number' || !Number.isFinite(v))
      )
      const palette = PALETTE

      const baseHeight = Math.max(160, Math.min(480, props.height))
      const H = open ? Math.round(baseHeight * 1.6) : baseHeight
      const W = 480
      const PL = 48,
        PR = 16,
        PT = 16,
        PB = 32
      const iw = W - PL - PR
      // SVG 只画到零基线；X 轴刻度是独立一行 HTML，和绘图区之间只隔 6px（不再在坐标区里留大片空）。
      const plotH = H - PB
      const ih = plotH - PT
      const n = Math.max(labels.length, ...series.map((s) => s.values.length), 1)

      // 堆叠时按总和取上限
      const maxVal = props.stacked
        ? Math.max(
            1,
            ...Array.from({ length: n }, (_, i) =>
              series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)
            )
          )
        : Math.max(1, ...series.flatMap((s) => s.values))
      const minVal = Math.min(0, ...series.flatMap((s) => s.values))
      const span = maxVal - minVal || 1

      const yOf = (v) => PT + ih - ((v - minVal) / span) * ih
      const xOf = (i) => PL + (n === 1 ? iw / 2 : (i * iw) / (n - 1))
      const xBand = (i) => PL + (i + 0.5) * (iw / n)
      const width = measuredWidth || CHART_WIDTH[open ? 'expanded' : 'compact']
      const tickX = (i) => ((chartType === 'bar' ? xBand(i) : xOf(i)) * width) / W
      // 极窄容器也要容纳必留的首尾；截断只影响显示，title/aria 保留全文。
      const labelWidth =
        labels.length > 1 ? (tickX(labels.length - 1) - tickX(0) - TICK_GAP) / 2 : (width * iw) / W
      const texts = labels.map((label) => tickText(label, labelWidth))
      const visibleTicks = chartTickIndices(texts, (width * iw) / W, tickX)

      const fmtAxis = (v) => {
        const f = props.yFormat
        // 同一数字格式保留正负小数的前导零，避免 percent 的浮点尾数。
        const number = v.toLocaleString('zh-CN')
        if (f === 'percent') return `${number}%`
        if (f === 'compact') {
          if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1)}亿`
          if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(1)}万`
        }
        return number
      }

      if (!hasData || invalidData || !Number.isFinite(span)) {
        return (
          <div style={{ minWidth: 0 }}>
            <PanelTitle>{props.title}</PanelTitle>
            <FallbackNotice>
              {invalidData || !Number.isFinite(span)
                ? '数据格式或范围有误，暂时无法绘图'
                : '没有可绘制的数据'}
            </FallbackNotice>
          </div>
        )
      }
      // 零基线（= 无负值时的 X 轴）：唯一的结构线，压在图形之上让柱底收口干净。
      const zeroY = yOf(0)
      const slotW = iw / n
      const lanes = props.stacked ? 1 : series.length
      const groupW = Math.min(slotW * 0.72, 26 * lanes)
      const barW = Math.max(3, (groupW - 2 * (lanes - 1)) / lanes)
      // 点数过多时不再画节点，避免折线糊成一片（10 点级仍保留全部节点，SSR 回归守护）。
      const showDots = n <= 24

      return (
        <div style={{ minWidth: 0 }}>
          <PanelTitle>{props.title}</PanelTitle>
          <div ref={plotRef} style={{ minWidth: 0 }}>
            <div style={{ position: 'relative', containerType: 'inline-size' }}>
              <svg
                viewBox={`0 0 ${W} ${plotH}`}
                style={{
                  width: '100%',
                  height: `calc(100cqw * ${plotH / W})`,
                  display: 'block',
                  transition: 'height .2s ease'
                }}
                role="img"
                aria-label={`${props.title ?? '数据图表'}；${labels.join('、')}`}
              >
                <title>{props.title ?? '数据图表'}</title>
                {/* 面积填充先铺底，网格发丝线再压在上面（大面积色块里仍能看到刻度）。 */}
                {chartType === 'area' &&
                  series.map((s, si) => {
                    const color = seriesColor(s.color, palette[si % palette.length])
                    const pts = s.values.map((v, i) => ({ x: xOf(i), y: yOf(v) }))
                    if (pts.length === 0) return null
                    const line = pts
                      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                      .join(' ')
                    return (
                      <path
                        key={`fill-${si}`}
                        d={`${line} L${pts[pts.length - 1].x.toFixed(1)},${zeroY.toFixed(1)} L${pts[0].x.toFixed(1)},${zeroY.toFixed(1)} Z`}
                        fill={tint(color, 12)}
                      />
                    )
                  })}
                {/* 网格：3 条水平发丝线；零基线单独用结构线。 */}
                {props.showGrid &&
                  Y_TICKS.map((t) => {
                    const y = PT + ih * t
                    if (Math.abs(y - zeroY) < 1.5) return null
                    return (
                      <line
                        key={`grid-${t}`}
                        x1={PL}
                        x2={W - PR}
                        y1={y}
                        y2={y}
                        stroke={T.hairline}
                        strokeWidth="1"
                      />
                    )
                  })}
                {/* 数据 */}
                {chartType === 'bar'
                  ? Array.from({ length: n }, (_, i) => {
                      let acc = 0
                      return series.map((s, si) => {
                        const v = s.values[i] ?? 0
                        const color = seriesColor(s.color, palette[si % palette.length])
                        let y, h
                        if (props.stacked) {
                          const y0 = yOf(acc)
                          acc += v
                          const y1 = yOf(acc)
                          y = Math.min(y0, y1)
                          h = Math.abs(y0 - y1)
                        } else {
                          // 正值向上、负值向下，统一从零基线起算。
                          y = v >= 0 ? yOf(v) : zeroY
                          h = Math.abs(yOf(v) - zeroY)
                        }
                        const x = xBand(i) - groupW / 2 + (props.stacked ? 0 : si * (barW + 2))
                        return (
                          <rect
                            key={`${i}-${si}`}
                            x={x}
                            y={y}
                            width={barW}
                            height={Math.max(0, h)}
                            rx={props.stacked ? 0 : Math.min(4, barW / 2)}
                            fill={color}
                          />
                        )
                      })
                    })
                  : series.map((s, si) => {
                      const color = seriesColor(s.color, palette[si % palette.length])
                      const pts = s.values.map((v, i) => ({ x: xOf(i), y: yOf(v) }))
                      if (pts.length === 0) return null
                      const line = pts
                        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                        .join(' ')
                      return (
                        <g key={si}>
                          <path
                            d={line}
                            fill="none"
                            stroke={color}
                            strokeWidth="2"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                          {showDots &&
                            pts.map((p, i) => (
                              <circle
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                r={i === pts.length - 1 ? 3.4 : 2.8}
                                fill={color}
                                stroke={T.surface}
                                strokeWidth="1.5"
                              />
                            ))}
                        </g>
                      )
                    })}
                {/* 零基线 / X 轴：发丝结构线 */}
                <line x1={PL} x2={W - PR} y1={zeroY} y2={zeroY} stroke={T.border} strokeWidth="1" />
              </svg>
              {/* 坐标轴标签用 HTML 渲染，字号不随 SVG 缩放，始终等于 FS.caption。 */}
              {Y_TICKS.map((t) => (
                <span
                  key={`y${t}`}
                  data-chart-y-tick={t}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: `${((PT + ih * t) / plotH) * 100}%`,
                    width: `${(PL / W) * 100}%`,
                    paddingRight: 6,
                    boxSizing: 'border-box',
                    transform: 'translateY(-50%)',
                    textAlign: 'right',
                    fontSize: FS.caption,
                    color: T.inkTertiary,
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap',
                    ...NUMS
                  }}
                >
                  {fmtAxis(maxVal - span * t)}
                </span>
              ))}
            </div>
            <div
              style={{
                position: 'relative',
                height: 18,
                marginTop: S.xs + 2,
                fontSize: FS.caption,
                color: T.inkTertiary
              }}
            >
              {visibleTicks.map((i) => {
                // 柱状图的刻度落在柱中心，直接居中对齐；折线首尾向内对齐避免出画框。
                const centered = chartType === 'bar' || labels.length === 1
                return (
                  <span
                    key={`x${i}`}
                    data-chart-x-tick={i}
                    title={labels[i]}
                    style={{
                      position: 'absolute',
                      left: `${((chartType === 'bar' ? xBand(i) : xOf(i)) / W) * 100}%`,
                      top: 0,
                      transform: centered
                        ? 'translateX(-50%)'
                        : i === 0
                          ? undefined
                          : i === labels.length - 1
                            ? 'translateX(-100%)'
                            : 'translateX(-50%)',
                      fontSize: FS.caption,
                      color: T.inkTertiary,
                      lineHeight: 1.6,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {texts[i]}
                  </span>
                )
              })}
            </div>

            {/* 图例：8px 圆点 + caption/inkSecondary（仅多系列时出现，单系列不重复标题）。 */}
            {props.showLegend && series.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: `${S.xs}px ${S.lg}px`,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginTop: S.sm
                }}
              >
                {series.map((s, si) => {
                  const name = displayText(s.name)
                  return (
                    <div
                      key={si}
                      title={name}
                      style={{
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                        minWidth: 0,
                        maxWidth: '100%',
                        fontSize: FS.caption,
                        color: T.inkSecondary
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: radiusFull,
                          flexShrink: 0,
                          background: seriesColor(s.color, palette[si % palette.length])
                        }}
                      />
                      <span
                        style={{
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {name}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            <ExpandToggle open={open} onToggle={toggle} note={open ? null : `${n} 个数据点`} />
          </div>
        </div>
      )
    }
  }),
  defineComponent({
    name: 'PieChart',
    description: 'Donut/pie chart. data=[{label, value}]; donut=true for ring.',
    props: z.object({
      title: z.string().optional(),
      data: z.array(z.object({ label: z.string(), value: z.number() })).default([]),
      donut: z.boolean().default(true),
      size: z.number().default(160)
    }),
    component: ({ props }) => {
      const [open, toggle] = useExpanded()
      const sz = open ? Math.min(320, Math.max(240, props.size)) : Math.min(150, props.size)
      const total = props.data.reduce((s, d) => s + d.value, 0)
      if (!Number.isFinite(total) || total <= 0 || props.data.some((d) => d.value < 0)) {
        return (
          <div style={{ minWidth: 0 }}>
            <PanelTitle>{props.title}</PanelTitle>
            <FallbackNotice>没有可绘制的数据</FallbackNotice>
          </div>
        )
      }
      // 以像素为 SVG 用户单位（viewBox = 实际尺寸），环宽 / 间隙 / 中心字号都能精确落在像素上。
      const CX = sz / 2,
        CY = sz / 2
      const RING = 18
      const R = props.donut ? Math.max(8, CX - RING / 2 - 1) : Math.max(4, CX - 1)
      const SW = props.donut ? RING : Math.max(4, sz - 2)
      const circ = 2 * Math.PI * R
      const palette = PALETTE
      const gapPx = 2
      let acc = 0
      const totalText = compactNumber(total)
      const aria = `${props.title ?? '占比图'}；${props.data
        .map((d) => {
          const p = Math.round((d.value / total) * 1000) / 10
          return `${displayText(d.label)} ${p}%`
        })
        .join('、')}`
      return (
        <div style={{ minWidth: 0 }}>
          <PanelTitle>{props.title}</PanelTitle>
          <div
            style={{
              display: 'flex',
              gap: S.sm,
              alignItems: 'center',
              flexWrap: 'wrap',
              minWidth: 0
            }}
          >
            <svg
              width={sz}
              height={sz}
              viewBox={`0 0 ${sz} ${sz}`}
              role="img"
              aria-label={aria}
              style={{ flexShrink: 0, display: 'block', maxWidth: '100%', overflow: 'visible' }}
            >
              <title>{aria}</title>
              {props.data.map((d, i) => {
                const frac = d.value / total
                const seg = frac * circ
                const dash = Math.max(0.5, seg - Math.min(gapPx, seg * 0.35))
                const el = (
                  <circle
                    key={i}
                    cx={CX}
                    cy={CY}
                    r={R}
                    fill="none"
                    stroke={palette[i % palette.length]}
                    strokeWidth={SW}
                    strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
                    strokeDashoffset={(-acc * circ).toFixed(2)}
                    transform={`rotate(-90 ${CX} ${CY})`}
                  />
                )
                acc += frac
                return el
              })}
              {props.donut && (
                <>
                  <text
                    x={CX}
                    y={CY + 7}
                    textAnchor="middle"
                    fontSize={FS.display}
                    fontWeight={FW.semibold}
                    fill={T.ink}
                    style={{ letterSpacing: TRACK.display, ...NUMS }}
                  >
                    {totalText}
                  </text>
                  <text
                    x={CX}
                    y={CY + 26}
                    textAnchor="middle"
                    fontSize={FS.caption}
                    fill={T.inkTertiary}
                  >
                    合计
                  </text>
                </>
              )}
            </svg>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: S.xs + 2,
                flex: '1 1 88px',
                minWidth: 0
              }}
            >
              {props.data.map((d, i) => {
                const pct = (d.value / total) * 100
                const pctText =
                  pct >= 9.95 ? `${Math.round(pct)}%` : `${Math.round(pct * 10) / 10}%`
                const label = displayText(d.label)
                return (
                  <div
                    key={i}
                    title={`${label} ${pctText}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      minWidth: 0,
                      fontSize: FS.caption
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: radiusFull,
                        flexShrink: 0,
                        background: palette[i % palette.length]
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        color: T.inkSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {label}
                    </span>
                    <span style={{ color: T.inkTertiary, flexShrink: 0, ...NUMS }}>{pctText}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <ExpandToggle
            open={open}
            onToggle={toggle}
            note={open ? null : `${props.data.length} 个分类`}
          />
        </div>
      )
    }
  }),
  defineComponent({
    name: 'Sparkline',
    description: 'Tiny inline trend line. values=number[].',
    props: z.object({
      values: z.array(z.number()).default([]),
      width: z.number().default(100),
      height: z.number().default(28)
    }),
    component: ({ props }) => {
      const values = props.values
      const max = Math.max(...values)
      const min = Math.min(...values)
      const span = max - min || 1
      if (
        !Number.isFinite(span) ||
        values.length === 0 ||
        values.some((v) => !Number.isFinite(v))
      ) {
        return <FallbackNotice>没有可绘制的数据</FallbackNotice>
      }
      const W = Math.max(24, Math.min(320, props.width))
      const H = Math.max(12, Math.min(80, props.height))
      const pad = 1.5
      const midY = H / 2
      const pts = values.map((v, i) => ({
        x: values.length === 1 ? W / 2 : (i / (values.length - 1)) * W,
        y: max === min ? midY : H - pad - ((v - min) / span) * (H - pad * 2)
      }))
      const path = pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' ')
      const last = pts[pts.length - 1]
      const aria = `趋势：${compactNumber(values[0])} → ${compactNumber(values[values.length - 1])}，共 ${values.length} 个点`
      return (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={aria}
          style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        >
          <title>{aria}</title>
          <path d={`${path} L${W},${H} L0,${H} Z`} fill={tint(T.accent, 8)} />
          <path
            d={path}
            fill="none"
            stroke={T.accent}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={last.x} cy={last.y} r="2.5" fill={T.accent} />
        </svg>
      )
    }
  }),

  // ---------- 高级交互 ----------,
  defineComponent({
    name: 'Heatmap',
    description:
      'Contribution-style heat grid. data=[{label?, value}] laid out row-major; columns defaults to 12. ' +
      'Cell tint scales with value. Use for activity, error density, hourly/daily patterns.',
    props: z.object({
      title: z.string().optional(),
      data: z.array(z.object({ label: z.string().optional(), value: z.number() })).default([]),
      columns: z.number().default(12),
      cell: z.number().default(14)
    }),
    component: ({ props }) => {
      const [open, toggle] = useExpanded()
      const wrapRef = React.useRef(null)
      const [measuredWidth, setMeasuredWidth] = React.useState(0)
      React.useEffect(() => {
        const el = wrapRef.current
        if (!el) return
        const measure = () => setMeasuredWidth(el.getBoundingClientRect().width)
        measure()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(measure)
        observer.observe(el)
        return () => observer.disconnect()
      }, [open, props])
      const cols = Math.max(1, Math.floor(props.columns))
      const base = open
        ? Math.max(18, Math.min(28, props.cell))
        : Math.min(12, Math.max(6, props.cell))
      const gap = 3
      // 列多时按可用宽度收格子（最小 6px），避免 390px 下横向溢出。
      const available = measuredWidth || CHART_WIDTH.compact
      const cell = Math.max(
        3,
        Math.min(base, Math.floor((available - 26 - (cols - 1) * gap) / cols))
      )
      const vals = props.data.map((d) => d.value ?? 0)
      const max = Math.max(1, ...vals)
      if (props.data.length === 0) {
        return (
          <div style={{ minWidth: 0 }}>
            <PanelTitle>{props.title}</PanelTitle>
            <FallbackNotice>没有可绘制的数据</FallbackNotice>
          </div>
        )
      }
      return (
        <div ref={wrapRef} style={{ minWidth: 0 }}>
          <PanelTitle>{props.title}</PanelTitle>
          <div
            role="img"
            aria-label={`${props.title ?? '热力图'}；${props.data.length} 个数据，峰值 ${max}`}
            style={{
              display: 'inline-block',
              maxWidth: '100%',
              overflowX: 'auto',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: radiusMd,
              padding: S.md
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
                gap,
                width: 'fit-content'
              }}
            >
              {props.data.map((d, i) => {
                const t = Math.max(0, Math.min(1, (d.value ?? 0) / max))
                return (
                  <div
                    key={i}
                    title={`${d.label ?? i + 1}: ${d.value}`}
                    style={{
                      width: cell,
                      height: cell,
                      borderRadius: radiusXs,
                      background: soften(T.accent, Math.round(8 + t * 80), T.surfaceTint)
                    }}
                  />
                )
              })}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                marginTop: S.sm,
                fontSize: FS.caption,
                color: T.inkTertiary,
                lineHeight: 1
              }}
            >
              <span>少</span>
              {[8, 28, 48, 68, 88].map((p) => (
                <span
                  key={p}
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radiusXs,
                    background: soften(T.accent, p, T.surfaceTint)
                  }}
                />
              ))}
              <span style={{ marginLeft: 2 }}>多</span>
            </div>
          </div>
          <ExpandToggle
            open={open}
            onToggle={toggle}
            note={open ? null : `${props.data.length} 格`}
          />
        </div>
      )
    }
  })
]
