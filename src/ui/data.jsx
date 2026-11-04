// 结构化数据：指标卡、表格、进度、时间线、步骤、清单。
// 视觉语言（v3 · Precision Editorial）：墨色层级 + 单一业务蓝 + 发丝线 + 分层表面；
// 数字一律 tabular-nums，绿/琥珀/红只出现在「状态」处。
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
  radius,
  radiusMd,
  radiusFull,
  alias
} from './theme.js'
import {
  PanelTitle,
  EmptyState,
  StatusDot,
  IconTile,
  Delta,
  useExpanded,
  ExpandToggle
} from './shared.jsx'

// ============================================================
// 内部 helper（不进组件 API；只服务视觉与格式化）
// ============================================================

/** accent 枚举 → 主题色；与 Card 的 2px 顶部色带同一套语言。 */
const ACCENT = {
  none: null,
  neutral: null,
  brand: T.accent,
  info: T.accent,
  success: T.success,
  warning: T.warning,
  error: T.danger
}

/** 数据色：brand/info/default 用业务蓝，只有语义 variant 才出现绿/琥珀/红。 */
const TONE = {
  brand: T.accent,
  info: T.accent,
  default: T.accent,
  neutral: T.inkTertiary,
  success: T.success,
  warning: T.warning,
  error: T.danger,
  danger: T.danger
}

/** 时间线节点色：未标记的节点用中性墨点，语义 variant 才着色。 */
const TIMELINE_TONE = {
  default: T.inkCaption,
  neutral: T.inkCaption,
  muted: T.inkCaption,
  brand: T.accent,
  info: T.accent,
  success: T.success,
  warning: T.warning,
  error: T.danger,
  danger: T.danger
}

/**
 * 状态单元：圆点/填充用原始语义色，文字/图标用 INK（与墨色混合后明暗都过对比度）。
 * 同一语义只有一处定义，避免各组件各写一份、也避免屏幕出现过多色相。
 */
const STATUS = {
  success: { dot: T.success, ink: INK.success },
  warning: { dot: T.warning, ink: INK.warning },
  danger: { dot: T.danger, ink: INK.danger },
  accent: { dot: T.accent, ink: INK.accent }
}

/** 单元格格式化：number/percent/currency/compact；无效数字回退原文。 */
function formatCell(value, spec) {
  if (value == null || value === '') return ''
  const format = alias('format', spec?.format ?? 'text')
  if (format === 'text') return displayText(value)
  const n = typeof value === 'number' ? value : Number(displayText(value).replace(/[^0-9.\-]/g, ''))
  if (Number.isNaN(n)) return displayText(value)
  if (format === 'percent') return `${n.toFixed(1)}%`
  if (format === 'currency') return `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
  if (format === 'compact') {
    if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
    if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万`
    return n.toLocaleString('zh-CN')
  }
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/** 汇总单元格：有非 text 格式时按列格式渲染；对象/异常值回退安全文本。 */
function formatSummary(value, spec) {
  if (spec == null || spec.format == null || alias('format', spec.format) === 'text')
    return displayText(value)
  return typeof value === 'object' && value !== null ? displayText(value) : formatCell(value, spec)
}

/** 状态词 → 语义状态（圆点用 dot、文字用 ink）。识别常见中英文状态。 */
function statusColor(value) {
  const s = displayText(value).toLowerCase()
  if (/^(ok|success|done|passed|healthy|active|online|正常|成功|已完成|通过|在线)$/.test(s))
    return STATUS.success
  if (/^(fail|failed|error|down|offline|失败|异常|离线|错误)$/.test(s)) return STATUS.danger
  if (/^(warn|warning|pending|degraded|slow|警告|待定|降级|慢)$/.test(s)) return STATUS.warning
  if (/^(run|running|loading|progress|运行中|进行中)$/.test(s)) return STATUS.accent
  return null
}

/** 数值列判定：声明了非 text 格式，或样本值本身是数字。 */
function isNumericColumn(spec, sample) {
  if (spec?.format != null && alias('format', spec.format) !== 'text') return true
  return typeof sample === 'number'
}

/** 列对齐：显式 align 优先，数值列默认右对齐。 */
function columnAlign(spec, sample) {
  if (spec?.align) return spec.align
  return isNumericColumn(spec, sample) ? 'right' : 'left'
}

/** 表格画框：发丝轮廓 + 圆角；横向滚动收在内部，390px 下页面不溢出。 */
function DataFrame({ children }) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: radiusMd,
        overflow: 'hidden',
        background: T.surface,
        minWidth: 0
      }}
    >
      <div style={{ overflowX: 'auto', minWidth: 0 }}>{children}</div>
    </div>
  )
}

/**
 * 表头单元格：caption 字号 + 表头底色（不是斑马纹）。
 * 可排序时保留点击/Enter/Space 与 aria-sort，指示符只在排序时出现。
 */
function HeadCell({ label, align, pad, sortable = false, active = false, dir = 'asc', onSort }) {
  const mark = sortable ? (
    <span
      aria-hidden
      style={{
        margin: align === 'right' ? `0 ${S.xs}px 0 0` : `0 0 0 ${S.xs}px`,
        fontSize: FS.caption,
        fontWeight: FW.regular,
        ...NUMS,
        color: active ? T.accent : T.inkCaption
      }}
    >
      {active ? (dir === 'asc' ? '↑' : '↓') : '⇅'}
    </span>
  ) : null
  return (
    <th
      onClick={sortable ? onSort : undefined}
      tabIndex={sortable ? 0 : undefined}
      aria-sort={
        sortable ? (active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined
      }
      onKeyDown={
        sortable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSort()
              }
            }
          : undefined
      }
      style={{
        textAlign: align,
        padding: pad,
        whiteSpace: 'nowrap',
        background: T.surfaceSunken,
        borderBottom: `1px solid ${T.border}`,
        color: active ? T.ink : T.inkSecondary,
        fontSize: FS.caption,
        fontWeight: FW.medium,
        letterSpacing: TRACK.caption,
        lineHeight: LH.caption,
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none'
      }}
    >
      {align === 'right' && mark}
      {label}
      {align !== 'right' && mark}
    </th>
  )
}

/** 数据单元格：数字右对齐 + NUMS；首列给 medium 字重，形成行标题。 */
function DataCell({ align, pad, numeric, first, tone, background, last, children }) {
  // 数字、状态、行标题都不折行：窄屏下宁可让表格内部横向滚动，
  // 也不要让 "128,400"/"healthy"/"svc-01" 这类标识被拆成两行。
  const keep = numeric || tone != null || first
  return (
    <td
      style={{
        padding: pad,
        textAlign: align,
        verticalAlign: 'middle',
        borderBottom: last ? 'none' : `1px solid ${T.hairline}`,
        background,
        color: tone ?? T.ink,
        fontWeight: tone != null || first ? FW.medium : FW.regular,
        whiteSpace: keep ? 'nowrap' : 'normal',
        overflowWrap: keep ? 'normal' : 'break-word',
        ...(numeric ? NUMS : null)
      }}
    >
      {children}
    </td>
  )
}

/** 搜索框：胶囊 + 内嵌放大镜；聚焦时描边转 accent（键盘焦点环仍由 PLUGIN_CSS 提供）。 */
function SearchField({ value, onChange, placeholder }) {
  const [focused, setFocused] = React.useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
    >
      <span
        aria-hidden
        style={{ position: 'absolute', left: S.md, display: 'inline-flex', pointerEvents: 'none' }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.inkTertiary}
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.6-3.6" />
        </svg>
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{
          width: 150,
          height: 30,
          boxSizing: 'border-box',
          padding: `0 ${S.md}px 0 ${S.xxxl}px`,
          borderRadius: radiusFull,
          border: `1px solid ${focused ? T.accent : T.border}`,
          background: focused ? T.surface : T.surfaceSunken,
          color: T.ink,
          fontSize: FS.small,
          fontFamily: 'inherit',
          transition: 'border-color .16s ease, background-color .16s ease'
        }}
      />
    </span>
  )
}

export const components = [
  defineComponent({
    name: 'StatCard',
    description:
      'Metric card: label, value, optional delta/trend/icon, note (small caption under value), ' +
      'accent (brand|success|warning|error) for a small colored dot before the label.',
    props: z.object({
      label: z.string(),
      value: z.string(),
      delta: z.string().optional(),
      trend: z.enum(['up', 'down', 'flat']).optional(),
      icon: z.string().optional(),
      note: z.string().optional(),
      accent: z
        .enum(['none', 'brand', 'success', 'warning', 'error', 'info', 'neutral'])
        .default('none')
    }),
    component: ({ props }) => {
      const accent = ACCENT[props.accent] ?? null
      // 数值过长时按长度降档，避免撑破卡片（26/19/16/15 四档）。
      const length = Array.from(props.value).length
      const valueSize =
        length <= 9 ? FS.display : length <= 12 ? FS.heading : length <= 17 ? FS.title : FS.lead
      const deltaBg =
        props.trend === 'up' ? TINT.success : props.trend === 'down' ? TINT.danger : TINT.neutral
      const hasFooter = props.delta != null || props.note != null
      return (
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            minWidth: 0,
            flex: '1 1 130px',
            display: 'flex',
            flexDirection: 'column',
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: radius,
            padding: S.lg
          }}
        >
          {accent != null && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: '0 0 auto 0',
                height: 2,
                background: accent
              }}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, minWidth: 0 }}>
            <div
              style={{
                fontSize: FS.caption,
                fontWeight: FW.medium,
                letterSpacing: TRACK.caption,
                lineHeight: LH.caption,
                color: T.inkTertiary,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {props.label}
            </div>
            {props.icon != null && (
              <span style={{ marginLeft: 'auto', display: 'inline-flex', flexShrink: 0 }}>
                <IconTile glyph={props.icon} tone="neutral" size={26} />
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: valueSize,
              fontWeight: FW.semibold,
              color: T.ink,
              letterSpacing: TRACK.display,
              lineHeight: LH.display,
              ...NUMS,
              marginTop: S.sm,
              minWidth: 0,
              overflowWrap: 'anywhere'
            }}
          >
            {props.value}
          </div>
          {hasFooter && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: S.sm,
                flexWrap: 'wrap',
                marginTop: 'auto',
                paddingTop: S.sm,
                minWidth: 0
              }}
            >
              {props.delta != null && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: radiusFull,
                    background: deltaBg,
                    padding: `${S.xxs}px ${S.sm}px`
                  }}
                >
                  <Delta value={props.delta} trend={props.trend ?? 'flat'} />
                </span>
              )}
              {props.note != null && (
                <span
                  style={{
                    fontSize: FS.caption,
                    color: T.inkTertiary,
                    lineHeight: LH.caption,
                    minWidth: 0,
                    overflowWrap: 'anywhere'
                  }}
                >
                  {props.note}
                </span>
              )}
            </div>
          )}
        </div>
      )
    }
  }),
  defineComponent({
    name: 'Table',
    description:
      'Data table with sorting. data=object[]; columns default to first-row keys. ' +
      'sortable makes headers clickable. columnSpecs=[{key, align?, format?, status?}] controls ' +
      'alignment, number formatting (number|percent|currency|compact) and status coloring ' +
      '(status:true colors cells like ok/failed/running/warning). highlightRow marks a row index.',
    props: z.object({
      title: z.string().optional(),
      columns: z.array(z.string()).optional(),
      data: z.array(z.record(z.string(), z.unknown())).default([]),
      compact: z.boolean().default(false),
      sortable: z.boolean().default(true),
      striped: z.boolean().default(false),
      columnSpecs: z
        .array(
          z.object({
            key: z.string(),
            align: z.enum(['left', 'right', 'center']).optional(),
            format: z.enum(['text', 'number', 'percent', 'currency', 'compact']).optional(),
            status: z.boolean().optional()
          })
        )
        .default([]),
      highlightRow: z.number().optional(),
      summary: z.record(z.string(), z.unknown()).optional()
    }),
    component: ({ props }) => {
      const columns = props.columns ?? (props.data[0] ? Object.keys(props.data[0]) : [])
      const specs = Object.fromEntries((props.columnSpecs ?? []).map((s) => [s.key, s]))
      const pad = props.compact ? '6px 10px' : '10px 12px'
      const aligns = Object.fromEntries(
        columns.map((c) => [c, columnAlign(specs[c], props.data[0]?.[c])])
      )
      const [sort, setSort] = React.useState({ key: null, dir: 'asc' })
      const [expanded, toggleExpanded] = useExpanded()

      // 排序：数字按数值、其余按中文序（与旧实现一致）
      const rows = React.useMemo(() => {
        if (!sort.key) return props.data.map((r, i) => ({ r, i }))
        const withIdx = props.data.map((r, i) => ({ r, i }))
        withIdx.sort((a, b) => {
          const av = a.r[sort.key],
            bv = b.r[sort.key]
          const an = Number(displayText(av)),
            bn = Number(displayText(bv))
          const numeric = !Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== ''
          let cmp
          if (numeric) cmp = an - bn
          else cmp = displayText(av).localeCompare(displayText(bv), 'zh-CN')
          return sort.dir === 'asc' ? cmp : -cmp
        })
        return withIdx
      }, [props.data, sort])

      const toggleSort = (key) => {
        if (!props.sortable) return
        setSort((s) =>
          s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
        )
      }

      // 超过 8 行默认折叠，展开看全部
      const visible = expanded ? rows : rows.slice(0, 8)

      return (
        <div style={{ minWidth: 0 }}>
          <PanelTitle>{props.title}</PanelTitle>
          <DataFrame>
            <table
              className="dsh-iui-table"
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                fontSize: props.compact ? FS.small : FS.body,
                lineHeight: LH.title,
                color: T.ink
              }}
            >
              <thead>
                <tr>
                  {columns.map((c) => {
                    const active = sort.key === c
                    return (
                      <HeadCell
                        key={c}
                        label={c}
                        align={aligns[c]}
                        pad={pad}
                        sortable={props.sortable}
                        active={active}
                        dir={sort.dir}
                        onSort={() => toggleSort(c)}
                      />
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td
                      colSpan={Math.max(1, columns.length)}
                      style={{ padding: S.lg, borderBottom: 'none' }}
                    >
                      <EmptyState>暂无数据</EmptyState>
                    </td>
                  </tr>
                )}
                {visible.map(({ r: row, i: origIdx }, rowIdx) => {
                  const highlighted = props.highlightRow === origIdx
                  const last = rowIdx === visible.length - 1 && props.summary == null
                  return (
                    <tr key={origIdx} style={{ background: highlighted ? TINT.accent : undefined }}>
                      {columns.map((c) => {
                        const spec = specs[c]
                        const raw = row[c]
                        const tone = spec?.status ? statusColor(raw) : null
                        return (
                          <DataCell
                            key={c}
                            align={aligns[c]}
                            pad={pad}
                            numeric={isNumericColumn(spec, raw)}
                            first={c === columns[0]}
                            tone={tone?.ink ?? null}
                            last={last}
                            background={
                              props.striped && !highlighted && origIdx % 2 === 1
                                ? T.surfaceSunken
                                : undefined
                            }
                          >
                            {tone != null ? (
                              <span
                                style={{ display: 'inline-flex', alignItems: 'center', gap: S.sm }}
                              >
                                <StatusDot color={tone.dot} />
                                {formatCell(raw, spec)}
                              </span>
                            ) : (
                              formatCell(raw, spec)
                            )}
                          </DataCell>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
              {props.summary != null && (
                <tfoot>
                  <tr>
                    {columns.map((c) => (
                      <td
                        key={c}
                        style={{
                          padding: pad,
                          textAlign: aligns[c],
                          borderTop: `2px solid ${T.borderStrong}`,
                          background: T.surfaceSunken,
                          fontSize: FS.small,
                          fontWeight: FW.semibold,
                          color: T.ink,
                          ...NUMS
                        }}
                      >
                        {formatSummary(props.summary[c], specs[c])}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </DataFrame>
          {rows.length > 8 && (
            <ExpandToggle open={expanded} onToggle={toggleExpanded} note={`共 ${rows.length} 行`} />
          )}
        </div>
      )
    }
  }),
  defineComponent({
    name: 'SearchTable',
    description:
      'Table with a live search box that filters rows across all columns. ' +
      'data=object[]; searchPlaceholder customizes the input. Combine with columnSpecs for formatting.',
    props: z.object({
      title: z.string().optional(),
      columns: z.array(z.string()).optional(),
      data: z.array(z.record(z.string(), z.unknown())).default([]),
      searchPlaceholder: z.string().default('搜索…'),
      emptyText: z.string().default('没有匹配的记录'),
      compact: z.boolean().default(true),
      columnSpecs: z
        .array(
          z.object({
            key: z.string(),
            align: z.enum(['left', 'right', 'center']).optional(),
            format: z.enum(['text', 'number', 'percent', 'currency', 'compact']).optional(),
            status: z.boolean().optional()
          })
        )
        .default([])
    }),
    component: ({ props }) => {
      const [q, setQ] = React.useState('')
      const columns = props.columns ?? (props.data[0] ? Object.keys(props.data[0]) : [])
      const specs = Object.fromEntries((props.columnSpecs ?? []).map((s) => [s.key, s]))
      const pad = props.compact ? '6px 10px' : '10px 12px'
      const aligns = Object.fromEntries(
        columns.map((c) => [c, columnAlign(specs[c], props.data[0]?.[c])])
      )

      // 实时过滤：所有列做大小写不敏感的子串匹配
      const filtered = React.useMemo(() => {
        const k = q.trim().toLowerCase()
        if (k === '') return props.data
        return props.data.filter((row) =>
          columns.some((c) => displayText(row[c]).toLowerCase().includes(k))
        )
      }, [q, props.data, columns])

      return (
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: S.sm,
              marginBottom: S.sm + S.xxs,
              minWidth: 0
            }}
          >
            {props.title != null && (
              <div
                style={{
                  fontSize: FS.small,
                  fontWeight: FW.medium,
                  color: T.inkSecondary,
                  lineHeight: LH.title,
                  letterSpacing: TRACK.title,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {props.title}
              </div>
            )}
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: S.sm,
                flexShrink: 0
              }}
            >
              <SearchField value={q} onChange={setQ} placeholder={props.searchPlaceholder} />
              <span
                aria-live="polite"
                style={{
                  fontSize: FS.caption,
                  color: T.inkTertiary,
                  ...NUMS,
                  whiteSpace: 'nowrap'
                }}
              >
                {filtered.length}/{props.data.length}
              </span>
            </div>
          </div>
          <DataFrame>
            <table
              className="dsh-iui-table"
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                fontSize: props.compact ? FS.small : FS.body,
                lineHeight: LH.title,
                color: T.ink
              }}
            >
              <thead>
                <tr>
                  {columns.map((c) => (
                    <HeadCell key={c} label={c} align={aligns[c]} pad={pad} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={Math.max(1, columns.length)}
                      style={{ padding: S.lg, borderBottom: 'none' }}
                    >
                      <EmptyState>{props.emptyText}</EmptyState>
                    </td>
                  </tr>
                )}
                {filtered.map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => {
                      const spec = specs[c]
                      const raw = row[c]
                      const tone = spec?.status ? statusColor(raw) : null
                      return (
                        <DataCell
                          key={c}
                          align={aligns[c]}
                          pad={pad}
                          numeric={isNumericColumn(spec, raw)}
                          first={c === columns[0]}
                          tone={tone?.ink ?? null}
                          last={i === filtered.length - 1}
                        >
                          {tone != null ? (
                            <span
                              style={{ display: 'inline-flex', alignItems: 'center', gap: S.sm }}
                            >
                              <StatusDot color={tone.dot} />
                              {formatCell(raw, spec)}
                            </span>
                          ) : (
                            formatCell(raw, spec)
                          )}
                        </DataCell>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </DataFrame>
        </div>
      )
    }
  }),
  defineComponent({
    name: 'ProgressBar',
    description: 'Horizontal progress. value 0..max, optional label and color variant.',
    props: z.object({
      label: z.string().optional(),
      value: z.number(),
      max: z.number().default(100),
      variant: z
        .enum(['brand', 'success', 'warning', 'error', 'info', 'default', 'neutral', 'danger'])
        .default('brand')
    }),
    component: ({ props }) => {
      const pct = Math.max(0, Math.min(100, (props.value / (props.max || 1)) * 100))
      const color = TONE[props.variant] ?? T.accent
      return (
        <div style={{ minWidth: 0 }}>
          {props.label != null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: S.sm,
                marginBottom: S.xs
              }}
            >
              <span
                style={{
                  fontSize: FS.small,
                  color: T.inkSecondary,
                  lineHeight: LH.caption,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {props.label}
              </span>
              <span style={{ fontSize: FS.caption, color: T.inkTertiary, ...NUMS, flexShrink: 0 }}>
                {Math.round(pct)}%
              </span>
            </div>
          )}
          <div
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
              height: 6,
              borderRadius: radiusFull,
              background: T.surfaceHover,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: color,
                borderRadius: radiusFull,
                transition: 'width .5s cubic-bezier(.2,.7,.2,1)'
              }}
            />
          </div>
        </div>
      )
    }
  }),
  defineComponent({
    name: 'ComparisonBar',
    description:
      'Ranked horizontal bars for comparing items. items=[{label, value, variant?}]. ' +
      'Good for showing distribution or ranking where a full chart is overkill.',
    props: z.object({
      title: z.string().optional(),
      items: z
        .array(
          z.object({
            label: z.string(),
            value: z.number(),
            variant: z
              .enum([
                'brand',
                'success',
                'warning',
                'error',
                'info',
                'default',
                'neutral',
                'danger'
              ])
              .default('brand')
          })
        )
        .default([]),
      showValue: z.boolean().default(true),
      unit: z.string().default('')
    }),
    component: ({ props }) => {
      const max = Math.max(1, ...props.items.map((i) => i.value))
      return (
        <div style={{ minWidth: 0 }}>
          <PanelTitle>{props.title}</PanelTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
            {props.items.map((it, i) => {
              const pct = Math.max(0, Math.min(100, (it.value / max) * 100))
              return (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: S.md, minWidth: 0 }}
                >
                  <span
                    style={{
                      width: 88,
                      flexShrink: 0,
                      fontSize: FS.small,
                      color: T.inkSecondary,
                      lineHeight: LH.caption,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {it.label}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 8,
                      background: T.surfaceHover,
                      borderRadius: radiusFull,
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: TONE[it.variant] ?? T.accent,
                        borderRadius: radiusFull,
                        transition: 'width .5s cubic-bezier(.2,.7,.2,1)'
                      }}
                    />
                  </div>
                  {props.showValue && (
                    <span
                      style={{
                        width: 64,
                        flexShrink: 0,
                        textAlign: 'right',
                        fontSize: FS.small,
                        color: T.ink,
                        lineHeight: LH.caption,
                        ...NUMS
                      }}
                    >
                      {it.value.toLocaleString('zh-CN')}
                      {props.unit}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }
  }),
  defineComponent({
    name: 'Timeline',
    description: 'Vertical timeline. items=array of {title, description?, time?, variant?}.',
    props: z.object({
      items: z
        .array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            time: z.string().optional(),
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
              .default('default')
          })
        )
        .default([])
    }),
    component: ({ props }) => (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {props.items.map((it, i) => {
          const last = i === props.items.length - 1
          const color = TIMELINE_TONE[alias('variant', it.variant ?? 'default')] ?? T.inkCaption
          // 标题里已经带时间戳时不再重复渲染 time（常见于模型把时间写进 title）
          const showTime = it.time != null && !it.title.includes(it.time)
          return (
            <div key={i} style={{ display: 'flex', gap: S.md, alignItems: 'stretch', minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                  width: 12
                }}
              >
                <span
                  aria-hidden
                  style={{
                    marginTop: S.xs,
                    width: 8,
                    height: 8,
                    boxSizing: 'content-box',
                    borderRadius: radiusFull,
                    background: color,
                    border: `2px solid ${T.surface}`
                  }}
                />
                {!last && (
                  <span
                    aria-hidden
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: S.md,
                      marginTop: S.xxs,
                      background: T.border,
                      borderRadius: radiusFull
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : S.md }}>
                {showTime && (
                  <div
                    style={{
                      fontSize: FS.caption,
                      color: T.inkTertiary,
                      lineHeight: LH.caption,
                      letterSpacing: TRACK.caption,
                      ...NUMS
                    }}
                  >
                    {it.time}
                  </div>
                )}
                <div
                  style={{
                    fontSize: FS.body,
                    fontWeight: FW.medium,
                    color: T.ink,
                    lineHeight: LH.title,
                    overflowWrap: 'anywhere'
                  }}
                >
                  {it.title}
                </div>
                {it.description != null && (
                  <div
                    style={{
                      fontSize: FS.small,
                      color: T.inkSecondary,
                      lineHeight: LH.body,
                      marginTop: S.xxs,
                      overflowWrap: 'anywhere'
                    }}
                  >
                    {it.description}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }),
  defineComponent({
    name: 'Steps',
    description:
      'Numbered step list with done/active states. items=string[], current=index (0-based).',
    props: z.object({ items: z.array(z.string()).default([]), current: z.number().default(0) }),
    component: ({ props }) => (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {props.items.map((item, i) => {
          const done = i < props.current
          const active = i === props.current
          const last = i === props.items.length - 1
          return (
            <div key={i} style={{ display: 'flex', gap: S.md, alignItems: 'stretch', minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                  width: 20
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    boxSizing: 'border-box',
                    borderRadius: radiusFull,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: FS.caption,
                    fontWeight: FW.semibold,
                    ...NUMS,
                    background: done ? TINT.success : active ? T.accent : T.surfaceTint,
                    color: done ? INK.success : active ? T.inkInverted : T.inkTertiary,
                    border: done || active ? 'none' : `1px solid ${T.border}`,
                    flexShrink: 0
                  }}
                >
                  {done ? '✓' : i + 1}
                </div>
                {!last && (
                  <span
                    aria-hidden
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: S.sm,
                      marginTop: S.xxs,
                      background: T.border,
                      borderRadius: radiusFull
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingBottom: last ? 0 : S.md,
                  lineHeight: '20px'
                }}
              >
                <span
                  style={{
                    fontSize: FS.body,
                    lineHeight: '20px',
                    color: active ? T.ink : T.inkSecondary,
                    fontWeight: active ? FW.medium : FW.regular,
                    overflowWrap: 'anywhere'
                  }}
                >
                  {item}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }),
  defineComponent({
    name: 'Checklist',
    description:
      'Task list with done/doing/todo states. items=[{text, status?}] or [{text, done?}]. ' +
      'status=done|doing|todo. Use for plans, todo lists, acceptance criteria.',
    props: z.object({
      title: z.string().optional(),
      items: z
        .array(
          z.object({
            text: z.string(),
            done: z.boolean().optional(),
            status: z.enum(['done', 'doing', 'todo']).optional()
          })
        )
        .default([])
    }),
    component: ({ props }) => {
      const stateOf = (it) => it.status ?? (it.done ? 'done' : 'todo')
      const color = { done: INK.success, doing: INK.accent, todo: T.inkTertiary }
      const glyph = { done: '✓', doing: '◐', todo: '○' }
      return (
        <div style={{ minWidth: 0 }}>
          <PanelTitle>{props.title}</PanelTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm + S.xxs }}>
            {props.items.map((it, i) => {
              const st = stateOf(it)
              return (
                <div
                  key={i}
                  style={{ display: 'flex', gap: S.sm, alignItems: 'flex-start', minWidth: 0 }}
                >
                  <span
                    aria-hidden
                    style={{
                      color: color[st],
                      fontSize: FS.small,
                      lineHeight: '20px',
                      width: 16,
                      flexShrink: 0,
                      textAlign: 'center'
                    }}
                  >
                    {glyph[st]}
                  </span>
                  <span
                    style={{
                      fontSize: FS.body,
                      lineHeight: '20px',
                      minWidth: 0,
                      color:
                        st === 'done' ? T.inkSecondary : st === 'doing' ? T.ink : T.inkSecondary,
                      fontWeight: st === 'doing' ? FW.medium : FW.regular,
                      textDecoration: st === 'done' ? 'line-through' : undefined,
                      textDecorationColor: T.inkCaption,
                      overflowWrap: 'anywhere'
                    }}
                  >
                    {it.text}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
  })
]
