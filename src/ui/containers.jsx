// 容器：Card / CardHeader / Section / Callout / Quote。
// 视觉语言：分层表面 + 发丝描边；accent 用 2px 顶部色带表达，不用粗边框抢注意力。
import React from 'react'
import { z } from 'zod'
import { defineComponent } from '@openuidev/lang-core'
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
  radiusSm,
  radiusFull,
  ELEVATION,
  alias
} from './theme.js'
import { Eyebrow, IconTile, kids, Rule } from './shared.jsx'

/** accent 枚举 → 主题色。 */
const ACCENT = {
  none: null,
  brand: T.accent,
  info: T.accent,
  success: T.success,
  warning: T.warning,
  error: T.danger,
  neutral: null
}
/** 语义色 + 浅底（Callout/Badge 共用同一套映射，避免各组件各写一份）。 */
const TONE = {
  info: [T.accent, INK.accent, TINT.accent, TINT.accentLine],
  brand: [T.accent, INK.accent, TINT.accent, TINT.accentLine],
  default: [T.accent, INK.accent, TINT.accent, TINT.accentLine],
  neutral: [T.accent, INK.accent, TINT.accent, TINT.accentLine],
  note: [T.accent, INK.accent, TINT.accent, TINT.accentLine],
  tip: [T.accent, INK.accent, TINT.accent, TINT.accentLine],
  success: [T.success, INK.success, TINT.success, T.success],
  warning: [T.warning, INK.warning, TINT.warning, T.warning],
  error: [T.danger, INK.danger, TINT.danger, T.danger],
  danger: [T.danger, INK.danger, TINT.danger, T.danger]
}

export const components = [
  defineComponent({
    name: 'Card',
    description:
      'Surface for grouping content. accent adds a colored top edge (brand|success|warning|error) ' +
      'to draw the eye; elevated adds a shadow. children.',
    props: z.object({
      children: z.array(z.unknown()).optional(),
      padding: z.number().default(16),
      accent: z
        .enum(['none', 'brand', 'success', 'warning', 'error', 'info', 'neutral'])
        .default('none'),
      elevated: z.boolean().default(false)
    }),
    component: ({ props, renderNode }) => {
      const accent = ACCENT[props.accent] ?? ACCENT[alias('variant', props.accent)]
      return (
        <div
          style={{
            position: 'relative',
            background: props.elevated ? T.surfaceRaised : T.surface,
            // elevated 用 DSH 高程替代描边，避免"双层轮廓"；
            border: props.elevated ? 'none' : `1px solid ${T.border}`,
            borderRadius: radius,
            boxShadow: props.elevated ? ELEVATION.soft : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: S.md,
            padding: props.padding,
            minWidth: 0,
            overflow: 'hidden'
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
          {kids(props, renderNode)}
        </div>
      )
    }
  }),
  defineComponent({
    name: 'CardHeader',
    description: 'Card title with optional subtitle and icon.',
    props: z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      icon: z.string().optional()
    }),
    component: ({ props }) => (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: S.md, minWidth: 0 }}>
        {props.icon != null && <IconTile glyph={props.icon} size={30} />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: FS.title,
              fontWeight: FW.semibold,
              color: T.ink,
              letterSpacing: TRACK.title,
              lineHeight: LH.title
            }}
          >
            {props.title}
          </div>
          {props.subtitle != null && (
            <div
              style={{
                fontSize: FS.small,
                color: T.inkSecondary,
                marginTop: 3,
                lineHeight: LH.caption
              }}
            >
              {props.subtitle}
            </div>
          )}
        </div>
      </div>
    )
  }),
  defineComponent({
    name: 'Section',
    description: 'Titled section: heading line + children.',
    props: z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      children: z.array(z.unknown()).optional()
    }),
    component: ({ props, renderNode }) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              width: 3,
              height: 15,
              borderRadius: radiusFull,
              background: T.accent,
              flexShrink: 0
            }}
          />
          <div
            style={{
              fontSize: FS.title,
              fontWeight: FW.semibold,
              color: T.ink,
              letterSpacing: TRACK.title,
              lineHeight: LH.title,
              minWidth: 0
            }}
          >
            {props.title}
          </div>
          <div style={{ flex: 1, height: 1, background: T.hairline, marginLeft: S.xs }} />
        </div>
        {props.subtitle != null && (
          <div
            style={{
              fontSize: FS.small,
              color: T.inkSecondary,
              marginTop: S.sm,
              lineHeight: LH.caption,
              paddingLeft: 3 + S.sm
            }}
          >
            {props.subtitle}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: S.md,
            marginTop: props.subtitle != null ? S.md : S.md
          }}
        >
          {kids(props, renderNode)}
        </div>
      </div>
    )
  }),
  defineComponent({
    name: 'Callout',
    description: 'Colored notice box: info|success|warning|error with title and text.',
    props: z.object({
      title: z.string().optional(),
      text: z.string(),
      variant: z
        .enum([
          'info',
          'brand',
          'default',
          'neutral',
          'note',
          'tip',
          'success',
          'warning',
          'error',
          'danger'
        ])
        .default('info')
    }),
    component: ({ props }) => {
      const [color, ink, bg, line] = TONE[alias('variant', props.variant)] ?? TONE.info
      return (
        <div
          style={{
            display: 'flex',
            gap: S.md,
            alignItems: 'flex-start',
            padding: `${S.md}px ${S.lg}px`,
            borderRadius: radiusMd,
            background: bg,
            border: `1px solid ${line}`,
            borderLeft: `3px solid ${color}`,
            minWidth: 0
          }}
        >
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: radiusFull,
              background: color,
              marginTop: 7,
              flexShrink: 0
            }}
          />
          <div style={{ minWidth: 0 }}>
            {props.title != null && (
              <div
                style={{
                  fontSize: FS.small,
                  fontWeight: FW.semibold,
                  color: ink,
                  lineHeight: LH.title,
                  marginBottom: S.xs
                }}
              >
                {props.title}
              </div>
            )}
            <div
              style={{
                fontSize: FS.small,
                color: T.ink,
                lineHeight: LH.body,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere'
              }}
            >
              {props.text}
            </div>
          </div>
        </div>
      )
    }
  }),
  defineComponent({
    name: 'Quote',
    description: 'Blockquote with optional source.',
    props: z.object({ text: z.string(), source: z.string().optional() }),
    component: ({ props }) => (
      <div style={{ display: 'flex', gap: S.md, minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            width: 2,
            borderRadius: radiusFull,
            background: T.borderHeavy,
            flexShrink: 0,
            alignSelf: 'stretch'
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: FS.body,
              color: T.inkSecondary,
              lineHeight: LH.body,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere'
            }}
          >
            {props.text}
          </div>
          {props.source != null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: S.xs,
                fontSize: FS.caption,
                color: T.inkTertiary,
                marginTop: S.sm
              }}
            >
              <span style={{ width: 10, height: 1, background: T.borderHeavy }} />
              {props.source}
            </div>
          )}
        </div>
      </div>
    )
  })
]
