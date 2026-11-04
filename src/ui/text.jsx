// 文本与代码内容：Heading / TextContent / 列表 / KeyValue / Badge / CodeBlock。
// v3 视觉语言：墨色排版层级 + 发丝结构线 + 单一业务蓝高光；代码块按「精装开发者面板」处理：
// 顶部工具条（语言 chip / 标题 / 行数 / 复制）、内嵌代码面、粘性行号、整行柔和高亮。
import React from 'react'
import { z } from 'zod'
import { defineComponent } from '@openuidev/lang-core'
import { useCopyText } from '../render-safety.jsx'
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
  tint,
  alias,
  radiusMd,
  radiusXs,
  radiusFull
} from './theme.js'
import { useExpanded, tokenColor, rulesFor, tokenizeLine } from './shared.jsx'

/** 代码字体：跟随 DSH 代码字体设置（design.md §5）。 */
const CODE_FONT = 'var(--ds-font-family-code, ui-monospace, monospace)'
const SIZE = { sm: FS.small, md: FS.body, lg: FS.lead, xl: FS.heading }
const WEIGHT = { normal: FW.regular, medium: FW.medium, semibold: FW.semibold, bold: FW.bold }
/** 徽章配色（浅底 + 语义文字 + 可选圆点）：保持全站同一套语义映射。 */
const BADGE_TONE = {
  // 文字走 INK（语义色与墨色混合，保证浅底上的对比度）；圆点/填充用原始语义色。
  default: { bg: T.surfaceTint, fg: T.inkSecondary, dot: null },
  muted: { bg: T.surfaceTint, fg: T.inkTertiary, dot: null },
  brand: { bg: TINT.accent, fg: INK.accent, dot: T.accent },
  success: { bg: TINT.success, fg: INK.success, dot: T.success },
  warning: { bg: TINT.warning, fg: INK.warning, dot: T.warning },
  error: { bg: TINT.danger, fg: INK.danger, dot: T.danger }
}
const badgeTone = (variant) => BADGE_TONE[alias('variant', variant)] ?? BADGE_TONE.default

/** 徽章胶囊：统一高度 22 / 圆角 full / caption + medium；状态类带 6px 圆点。 */
function Pill({ text, tone }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 22,
        padding: '0 8px',
        borderRadius: radiusFull,
        background: tone.bg,
        color: tone.fg,
        fontSize: FS.caption,
        fontWeight: FW.medium,
        letterSpacing: TRACK.caption,
        lineHeight: 1,
        maxWidth: '100%',
        minWidth: 0
      }}
    >
      {tone.dot != null && (
        <span
          aria-hidden
          style={{
            width: 5,
            height: 5,
            borderRadius: radiusFull,
            background: tone.dot,
            flexShrink: 0
          }}
        />
      )}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0
        }}
      >
        {text}
      </span>
    </span>
  )
}

export const components = [
  defineComponent({
    name: 'TextContent',
    description: 'Text block. size=sm|md|lg, muted, weight, mono.',
    props: z.object({
      text: z.string(),
      size: z.enum(['sm', 'md', 'lg', 'xl', 'small', 'medium', 'large', 'xlarge']).default('md'),
      muted: z.boolean().default(false),
      weight: z.enum(['normal', 'medium', 'semibold', 'bold']).default('normal'),
      mono: z.boolean().default(false)
    }),
    component: ({ props }) => (
      <div
        style={{
          fontSize: SIZE[alias('size', props.size)] ?? FS.body,
          // 正文用 ink：灰字读起来像未完成；muted 只给次级注释
          color: props.muted ? T.inkTertiary : T.ink,
          fontWeight: WEIGHT[props.weight] ?? FW.regular,
          fontFamily: props.mono ? CODE_FONT : undefined,
          letterSpacing: props.mono ? TRACK.caption : TRACK.body,
          lineHeight: props.mono ? LH.title : LH.body,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          minWidth: 0
        }}
      >
        {props.text}
      </div>
    )
  }),
  defineComponent({
    name: 'Heading',
    description: 'Section heading. level=1|2|3.',
    props: z.object({ text: z.string(), level: z.number().default(2) }),
    component: ({ props }) => {
      // 与 DSH Markdown 标题同一呼吸：1→19 / 2→16 / 3→15，600 字重，不压过正文。
      const spec = {
        1: { size: FS.heading, line: LH.heading, weight: FW.semibold, track: TRACK.heading },
        2: { size: FS.title, line: LH.title, weight: FW.semibold, track: TRACK.title },
        3: { size: FS.lead, line: LH.title, weight: FW.semibold, track: TRACK.body }
      }[props.level] ?? { size: FS.title, line: LH.title, weight: FW.semibold, track: TRACK.title }
      return (
        <div
          style={{
            fontSize: spec.size,
            fontWeight: spec.weight,
            letterSpacing: spec.track,
            color: T.ink,
            lineHeight: spec.line,
            margin: 0,
            minWidth: 0,
            overflowWrap: 'anywhere'
          }}
        >
          {props.text}
        </div>
      )
    }
  }),
  defineComponent({
    name: 'BulletList',
    description: 'Bulleted list. items=string[]; ordered=true for numbers.',
    props: z.object({
      items: z.array(z.string()).default([]),
      ordered: z.boolean().default(false)
    }),
    component: ({ props }) => (
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: S.sm,
          minWidth: 0
        }}
      >
        {props.items.map((it, i) => (
          <li key={i} style={{ display: 'flex', gap: S.sm, alignItems: 'baseline', minWidth: 0 }}>
            {props.ordered ? (
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  minWidth: 16,
                  textAlign: 'right',
                  fontSize: FS.caption,
                  fontWeight: FW.medium,
                  color: T.inkTertiary,
                  lineHeight: LH.body,
                  ...NUMS
                }}
              >
                {i + 1}.
              </span>
            ) : (
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 4,
                  height: 4,
                  borderRadius: radiusFull,
                  background: T.accent,
                  alignSelf: 'flex-start',
                  marginTop: 9
                }}
              />
            )}
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: FS.body,
                color: T.ink,
                lineHeight: LH.body,
                overflowWrap: 'anywhere'
              }}
            >
              {it}
            </span>
          </li>
        ))}
      </ul>
    )
  }),
  defineComponent({
    name: 'KeyValue',
    description: 'Label/value rows. items=array of {label, value}.',
    props: z.object({
      items: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
      columns: z.number().default(1)
    }),
    component: ({ props }) => {
      const cols = Math.max(1, Math.min(4, Math.round(Number(props.columns) || 1)))
      // 多列用 flex 换行：窄屏（390）自动回落为单列，桌面按 columns 分栏，不挤压日期这类长值。
      const columnMax =
        cols > 1 ? `calc(${100 / cols}% - ${((S.xxl * (cols - 1)) / cols).toFixed(2)}px)` : '100%'
      return (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            columnGap: S.xxl,
            rowGap: S.md,
            minWidth: 0
          }}
        >
          {props.items.map((it, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: S.sm,
                alignItems: 'baseline',
                flex: `1 1 ${columnMax}`,
                maxWidth: columnMax,
                minWidth: cols >= 4 ? 'min(160px, 100%)' : 'min(200px, 100%)'
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  minWidth: 52,
                  fontSize: FS.caption,
                  fontWeight: FW.regular,
                  color: T.inkTertiary,
                  letterSpacing: TRACK.caption,
                  lineHeight: LH.body,
                  overflowWrap: 'anywhere'
                }}
              >
                {it.label}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: FS.body,
                  color: T.ink,
                  fontWeight: FW.medium,
                  lineHeight: LH.body,
                  overflowWrap: 'anywhere',
                  ...NUMS
                }}
              >
                {it.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
  }),
  defineComponent({
    name: 'Badge',
    description: 'Status pill. variant=default|success|warning|error|info.',
    props: z.object({
      text: z.string(),
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
    }),
    component: ({ props }) => <Pill text={props.text} tone={badgeTone(props.variant)} />
  }),
  defineComponent({
    name: 'BadgeGroup',
    description: 'Row of badges. items=string[], variant applies to all.',
    props: z.object({
      items: z.array(z.string()).default([]),
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
    }),
    component: ({ props }) => {
      const tone = badgeTone(props.variant)
      return (
        <div style={{ display: 'flex', gap: S.sm, flexWrap: 'wrap', minWidth: 0 }}>
          {props.items.map((t, i) => (
            <Pill key={i} text={t} tone={tone} />
          ))}
        </div>
      )
    }
  }),

  // ---------- 数据展示 ----------,
  defineComponent({
    name: 'CodeBlock',
    description:
      'Monospace code block with optional language/title, line numbers, highlighted lines and a copy button. ' +
      'showLineNumbers=true numbers lines; highlight=[n] tints specific 1-based lines. Use for code, config, terminal output.',
    props: z.object({
      code: z.string(),
      language: z.string().optional(),
      title: z.string().optional(),
      showLineNumbers: z.boolean().default(false),
      highlight: z.array(z.number()).default([])
    }),
    component: ({ props }) => {
      const [open, toggleOpen] = useExpanded()
      const [copyStatus, copy] = useCopyText(String(props.code ?? ''))
      const rules = React.useMemo(() => rulesFor(props.language), [props.language])
      const all = String(props.code ?? '').split('\n')
      const COLLAPSED = 18
      const lines = open ? all : all.slice(0, COLLAPSED)
      const hl = new Set(props.highlight ?? [])
      const trimmed = all.length > 1 && all[all.length - 1] === ''
      const totalLines = trimmed ? all.length - 1 : all.length
      const long = all.length > COLLAPSED
      const title = props.title != null ? String(props.title) : null
      const language = props.language != null ? String(props.language) : null
      const gutter = Math.max(24, 10 + String(all.length).length * 7)
      return (
        <div
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: radiusMd,
            background: T.codeBg,
            overflow: 'hidden',
            minWidth: 0
          }}
        >
          {/* 工具条：语言 chip / 标题 / 行数 / 复制 —— 让代码块像一块精装面板而不是裸 pre */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: S.sm,
              height: 34,
              padding: `0 ${S.sm}px 0 ${S.md}px`,
              background: T.codeBanner,
              borderBottom: `1px solid ${T.border}`,
              minWidth: 0
            }}
          >
            {language != null && (
              <span
                style={{
                  flexShrink: 0,
                  padding: '0 6px',
                  height: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: radiusXs,
                  background: TINT.neutral,
                  fontFamily: CODE_FONT,
                  fontSize: FS.caption,
                  color: T.inkSecondary,
                  letterSpacing: TRACK.caption,
                  lineHeight: 1
                }}
              >
                {language}
              </span>
            )}
            <span
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: CODE_FONT,
                fontSize: FS.caption,
                color: T.inkSecondary,
                letterSpacing: TRACK.caption
              }}
            >
              {title ?? (language == null ? '代码' : '')}
            </span>
            {long && (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: FS.caption,
                  color: T.inkCaption,
                  ...NUMS
                }}
              >
                {totalLines} 行
              </span>
            )}
            {long && (
              <button
                type="button"
                onClick={toggleOpen}
                aria-expanded={open}
                className="dsh-iui-btn dsh-iui-btn-ghost dsh-iui-expand"
                style={{
                  flexShrink: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: radiusXs,
                  fontSize: FS.caption,
                  color: T.inkSecondary,
                  lineHeight: 1.6,
                  letterSpacing: TRACK.caption
                }}
              >
                {open ? '收起' : '展开'}
              </button>
            )}
            <button
              type="button"
              onClick={copy}
              className="dsh-iui-btn dsh-iui-btn-ghost"
              style={{
                flexShrink: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: radiusXs,
                fontSize: FS.caption,
                color: copyStatus === '已复制' ? INK.success : T.inkSecondary,
                lineHeight: 1.6,
                letterSpacing: TRACK.caption,
                whiteSpace: 'nowrap'
              }}
            >
              {copyStatus}
            </button>
          </div>
          <pre
            data-scroll
            style={{
              margin: 0,
              padding: `${S.sm}px 0`,
              background: T.codeBg,
              overflowX: 'auto',
              overflowY: 'hidden',
              fontFamily: CODE_FONT,
              fontSize: FS.small,
              lineHeight: '22px',
              color: T.ink
            }}
          >
            {lines.map((line, i) => {
              const lit = hl.has(i + 1)
              // 高亮行整行铺一层极浅业务蓝；行号同时变成强调色，扫视时能立刻定位。
              const bg = lit ? tint(T.accent, 8) : undefined
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    width: 'max-content',
                    minWidth: '100%',
                    background: bg
                  }}
                >
                  {props.showLineNumbers && (
                    <span
                      aria-hidden
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        flexShrink: 0,
                        width: gutter,
                        paddingLeft: S.sm,
                        paddingRight: S.sm,
                        boxSizing: 'border-box',
                        textAlign: 'right',
                        userSelect: 'none',
                        background: bg ?? T.codeBg,
                        borderRight: `1px solid ${T.hairline}`,
                        fontSize: FS.caption,
                        lineHeight: '22px',
                        color: lit ? INK.accent : T.inkTertiary,
                        fontWeight: lit ? FW.medium : FW.regular,
                        ...NUMS
                      }}
                    >
                      {i + 1}
                    </span>
                  )}
                  <span
                    style={{
                      flexShrink: 0,
                      whiteSpace: 'pre',
                      paddingLeft: S.md,
                      paddingRight: S.lg,
                      minWidth: 0
                    }}
                  >
                    {(tokenizeLine(line, rules) ?? [{ text: line, kind: 'plain' }]).map(
                      (tok, j) => (
                        <span
                          key={j}
                          style={{
                            color: tokenColor(tok.kind),
                            fontStyle: tok.kind === 'comment' ? 'italic' : undefined
                          }}
                        >
                          {tok.text}
                        </span>
                      )
                    )}
                    {line === '' ? ' ' : null}
                  </span>
                </div>
              )
            })}
          </pre>
        </div>
      )
    }
  })
]
