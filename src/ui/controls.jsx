// 交互控件：Button / Tabs / Accordion / SegmentedControl。
// 语言：DSH 反差主按钮 + 发丝分隔 + 分段胶囊；交互反馈克制。
import React from 'react'
import { z } from 'zod'
import { defineComponent } from '@openuidev/lang-core'
import {
  T,
  TINT,
  FS,
  FW,
  LH,
  S,
  NUMS,
  TRACK,
  radius,
  radiusMd,
  radiusSm,
  radiusFull
} from './theme.js'
import { kids } from './shared.jsx'

export const components = [
  defineComponent({
    name: 'Button',
    description: 'Action button. variant=primary|default|ghost; click gives local feedback.',
    props: z.object({
      label: z.string(),
      action: z.string().optional(),
      variant: z.enum(['primary', 'default', 'ghost']).default('primary')
    }),
    component: ({ props }) => {
      const [fired, bump] = React.useReducer((n) => n + 1, 0)
      const flash = fired > 0
      const primary = props.variant === 'primary'
      const ghost = props.variant === 'ghost'
      return (
        <button
          type="button"
          onClick={() => {
            bump()
          }}
          className={
            ghost
              ? 'dsh-iui-btn dsh-iui-btn-ghost'
              : primary
                ? 'dsh-iui-btn dsh-iui-btn-primary'
                : 'dsh-iui-btn'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: ghost ? '4px 8px' : '5px 14px',
            borderRadius: radiusSm,
            fontSize: FS.small,
            fontWeight: FW.medium,
            lineHeight: 1.6,
            cursor: 'pointer',
            width: 'fit-content',
            border: `1px solid ${primary || ghost ? 'transparent' : T.border}`,
            background: flash
              ? TINT.success
              : primary
                ? T.buttonFill
                : ghost
                  ? 'transparent'
                  : T.surface,
            color: primary && !flash ? T.inkInverted : ghost ? T.inkSecondary : T.ink,
            transition: 'background-color .15s ease, transform .1s ease'
          }}
        >
          {props.label}
          {flash ? ' ✓' : ''}
        </button>
      )
    }
  }),
  defineComponent({
    name: 'Tabs',
    description:
      'Tabbed panels. items=array of {label, content} where content is a component reference.',
    props: z.object({
      items: z.array(z.object({ label: z.string(), content: z.unknown() })).default([]),
      active: z.number().default(0)
    }),
    component: ({ props, renderNode }) => {
      const [idx, setIdx] = React.useState(props.active)
      const cur = props.items[idx] ?? props.items[0]
      return (
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              gap: S.xs,
              overflowX: 'auto',
              borderBottom: `1px solid ${T.hairline}`,
              marginBottom: S.md
            }}
          >
            {props.items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                style={{
                  padding: '6px 10px 8px',
                  fontSize: FS.small,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                  whiteSpace: 'nowrap',
                  borderBottom: `2px solid ${i === idx ? T.accent : 'transparent'}`,
                  color: i === idx ? T.ink : T.inkSecondary,
                  fontWeight: i === idx ? FW.semibold : FW.regular,
                  marginBottom: -1,
                  transition: 'color .12s ease, border-color .12s ease'
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
          <div style={{ minWidth: 0 }}>{cur ? renderNode(cur.content) : null}</div>
        </div>
      )
    }
  }),
  defineComponent({
    name: 'Accordion',
    description: 'Collapsible sections. items=array of {title, content}.',
    props: z.object({
      items: z.array(z.object({ title: z.string(), content: z.unknown() })).default([])
    }),
    component: ({ props, renderNode }) => {
      const [open, setOpen] = React.useState(() => new Set([0]))
      const toggle = (i) =>
        setOpen((prev) => {
          const next = new Set(prev)
          next.has(i) ? next.delete(i) : next.add(i)
          return next
        })
      return (
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {props.items.map((it, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${T.hairline}` }}>
              <button
                type="button"
                aria-expanded={open.has(i)}
                onClick={() => toggle(i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: S.md,
                  padding: `${S.sm + 2}px 2px`,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: FS.body,
                  color: T.ink,
                  fontWeight: open.has(i) ? FW.medium : FW.regular,
                  textAlign: 'left',
                  lineHeight: LH.title
                }}
              >
                <span style={{ minWidth: 0 }}>{it.title}</span>
                <span
                  aria-hidden
                  style={{
                    color: T.inkTertiary,
                    fontSize: FS.caption,
                    lineHeight: 1,
                    transition: 'transform .18s ease',
                    transform: open.has(i) ? 'rotate(90deg)' : 'none'
                  }}
                >
                  ▸
                </span>
              </button>
              <div
                className="dsh-iui-collapse"
                data-open={open.has(i) || undefined}
                inert={!open.has(i) ? '' : undefined}
                style={{
                  display: 'grid',
                  gridTemplateRows: open.has(i) ? '1fr' : '0fr',
                  visibility: open.has(i) ? 'visible' : 'hidden'
                }}
              >
                <div style={{ minHeight: 0, overflow: 'hidden' }}>
                  <div style={{ padding: `0 2px ${S.md}px 14px`, minWidth: 0 }}>
                    {renderNode(it.content)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    }
  }),
  defineComponent({
    name: 'SegmentedControl',
    description:
      'Segmented tabs that switch between panels. items=[{label, content}]. ' +
      'Lighter than Tabs — use for 2-4 short options like time ranges or view modes.',
    props: z.object({
      items: z.array(z.object({ label: z.string(), content: z.unknown() })).default([]),
      active: z.number().default(0)
    }),
    component: ({ props, renderNode }) => {
      const [idx, setIdx] = React.useState(props.active)
      const cur = props.items[idx] ?? props.items[0]
      return (
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 3,
              gap: 2,
              maxWidth: '100%',
              overflowX: 'auto',
              background: T.surfaceTint,
              borderRadius: radiusFull,
              border: `1px solid ${T.hairline}`
            }}
          >
            {props.items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                style={{
                  padding: '3px 12px',
                  fontSize: FS.small,
                  cursor: 'pointer',
                  border: `1px solid ${i === idx ? T.border : 'transparent'}`,
                  borderRadius: radiusFull,
                  whiteSpace: 'nowrap',
                  background: i === idx ? T.surface : 'transparent',
                  color: i === idx ? T.ink : T.inkSecondary,
                  fontWeight: i === idx ? FW.medium : FW.regular,
                  lineHeight: 1.7,
                  transition: 'background-color .15s ease, color .15s ease'
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: S.md, minWidth: 0 }}>{cur ? renderNode(cur.content) : null}</div>
        </div>
      )
    }
  })
]
