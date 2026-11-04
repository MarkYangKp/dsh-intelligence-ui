// 布局与文本原语：自由组合的底层积木。
import React from 'react'
import { z } from 'zod'
import { defineComponent } from '@openuidev/lang-core'
import { displayText, FallbackNotice, useCopyText, RenderBoundary } from '../render-safety.jsx'
import {
  T,
  FS,
  S,
  radius,
  radiusSm,
  radiusXs,
  radiusFull,
  SHADOW,
  NUMS,
  TRACK,
  DIR,
  alias,
  ALIAS,
  CAPTION_PX,
  CHART_WIDTH,
  TICK_GAP,
  tickWidth,
  tickText,
  chartTickIndices,
  PALETTE_EXTRA,
  seriesColor
} from './theme.js'
import {
  PanelTitle,
  useExpanded,
  ExpandToggle,
  PlayControls,
  tokenColor,
  rulesFor,
  tokenizeLine,
  kids
} from './shared.jsx'

export const components = [
  defineComponent({
    name: 'Box',
    description:
      'Low-level styled container. The escape hatch for any layout the preset components cannot express. ' +
      'Combine with Row/Col/Text/Icon to build custom UI. All props optional.',
    props: z.object({
      children: z.array(z.unknown()).optional(),
      // 布局
      display: z.enum(['block', 'flex', 'inline-flex', 'grid']).default('block'),
      direction: z
        .enum(['row', 'column', 'col', 'vert', 'vertical', 'horiz', 'horizontal'])
        .optional(),
      gap: z.number().optional(),
      align: z.enum(['start', 'center', 'end', 'stretch', 'baseline']).optional(),
      justify: z.enum(['start', 'center', 'end', 'between', 'around']).optional(),
      wrap: z.boolean().optional(),
      // 尺寸
      width: z.string().optional(),
      height: z.string().optional(),
      minWidth: z.string().optional(),
      maxWidth: z.string().optional(),
      // 间距
      padding: z.string().optional(),
      margin: z.string().optional(),
      // 外观
      background: z.string().optional(),
      border: z.string().optional(),
      radius: z.string().optional(),
      shadow: z.enum(['none', 'sm', 'md']).optional(),
      // 定位
      position: z.enum(['relative', 'absolute']).optional(),
      top: z.string().optional(),
      right: z.string().optional(),
      bottom: z.string().optional(),
      left: z.string().optional(),
      overflow: z.enum(['visible', 'hidden', 'auto']).optional(),
      opacity: z.number().optional()
    }),
    component: ({ props, renderNode }) => {
      const style = {
        display: props.display,
        flexDirection:
          props.display === 'flex' || props.display === 'inline-flex'
            ? DIR(props.direction ?? 'column')
            : undefined,
        gap: props.gap,
        alignItems:
          props.align === 'start' ? 'flex-start' : props.align === 'end' ? 'flex-end' : props.align,
        justifyContent: {
          start: 'flex-start',
          center: 'center',
          end: 'flex-end',
          between: 'space-between',
          around: 'space-around'
        }[props.justify],
        flexWrap: props.wrap == null ? undefined : props.wrap ? 'wrap' : 'nowrap',
        width: props.width,
        height: props.height,
        minWidth: props.minWidth ?? 0,
        maxWidth: props.maxWidth,
        padding: props.padding,
        margin: props.margin,
        background: props.background,
        border: props.border,
        borderRadius: props.radius,
        boxShadow: SHADOW[props.shadow],
        position: props.position,
        top: props.top,
        right: props.right,
        bottom: props.bottom,
        left: props.left,
        overflow: props.overflow,
        opacity: props.opacity
      }
      return <div style={style}>{kids(props, renderNode)}</div>
    }
  }),
  defineComponent({
    name: 'Row',
    description: 'Horizontal flex shorthand: Row([children], gap?, align?, justify?, wrap?).',
    props: z.object({
      children: z.array(z.unknown()).optional(),
      gap: z.number().default(8),
      align: z.enum(['start', 'center', 'end', 'stretch', 'baseline']).default('stretch'),
      justify: z.enum(['start', 'center', 'end', 'between']).default('start'),
      wrap: z.boolean().default(true)
    }),
    component: ({ props, renderNode }) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: props.gap,
          alignItems:
            props.align === 'start'
              ? 'flex-start'
              : props.align === 'end'
                ? 'flex-end'
                : props.align,
          justifyContent: {
            start: 'flex-start',
            center: 'center',
            end: 'flex-end',
            between: 'space-between'
          }[props.justify],
          flexWrap: props.wrap ? 'wrap' : 'nowrap',
          minWidth: 0
        }}
      >
        {kids(props, renderNode)}
      </div>
    )
  }),
  defineComponent({
    name: 'Col',
    description: 'Vertical flex shorthand: Col([children], gap?, align?).',
    props: z.object({
      children: z.array(z.unknown()).optional(),
      gap: z.number().default(8),
      align: z.enum(['start', 'center', 'end', 'stretch']).default('stretch')
    }),
    component: ({ props, renderNode }) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: props.gap,
          alignItems:
            props.align === 'start'
              ? 'flex-start'
              : props.align === 'end'
                ? 'flex-end'
                : props.align,
          minWidth: 0
        }}
      >
        {kids(props, renderNode)}
      </div>
    )
  }),
  defineComponent({
    name: 'Text',
    description:
      'Low-level text with full style control. Use when TextContent presets do not fit. ' +
      'text is required; everything else optional. size is a px number or a token (sm|md|lg|xl).',
    props: z.object({
      text: z.string(),
      // 数字按 px；也接受 TextContent 同款尺寸 token（模型常写 Text("标题", "sm")）
      size: z
        .union([z.number(), z.enum(['sm', 'md', 'lg', 'xl', 'small', 'medium', 'large', 'xlarge'])])
        .optional(),
      weight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
      color: z
        .enum(['primary', 'secondary', 'tertiary', 'brand', 'success', 'warning', 'error'])
        .optional(),
      align: z.enum(['left', 'center', 'right']).optional(),
      mono: z.boolean().optional(),
      lineHeight: z.number().optional(),
      transform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
      letterSpacing: z.string().optional(),
      truncate: z.boolean().optional(),
      maxLines: z.number().optional()
    }),
    component: ({ props }) => {
      const color = {
        primary: T.textPrimary,
        secondary: T.textSecondary,
        tertiary: T.textTertiary,
        brand: T.brand,
        success: T.success,
        warning: T.warn,
        error: T.error
      }[props.color ?? 'primary']
      const size =
        typeof props.size === 'number'
          ? props.size
          : ({ sm: FS.small, md: FS.body, lg: FS.lead, xl: FS.h2 }[alias('size', props.size)] ??
            FS.body)
      const style = {
        fontSize: size,
        fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 }[
          props.weight ?? 'normal'
        ],
        color,
        textAlign: props.align,
        fontFamily: props.mono
          ? 'var(--ds-font-family-code, var(--dsh-font-family-code, ui-monospace, monospace))'
          : undefined,
        lineHeight: props.lineHeight,
        textTransform: props.transform,
        letterSpacing: props.letterSpacing,
        whiteSpace: props.maxLines != null ? 'normal' : 'pre-wrap',
        overflowWrap: 'anywhere'
      }
      if (props.truncate) {
        Object.assign(style, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
      }
      if (props.maxLines != null) {
        Object.assign(style, {
          display: '-webkit-box',
          WebkitLineClamp: props.maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        })
      }
      return <div style={style}>{props.text}</div>
    }
  }),
  defineComponent({
    name: 'Icon',
    description: 'Inline glyph or emoji, optionally colored. name is the character/emoji to show.',
    props: z.object({
      name: z.string(),
      size: z.number().default(14),
      color: z
        .enum(['primary', 'secondary', 'tertiary', 'brand', 'success', 'warning', 'error'])
        .optional()
    }),
    component: ({ props }) => {
      const color = {
        primary: T.textPrimary,
        secondary: T.textSecondary,
        tertiary: T.textTertiary,
        brand: T.brand,
        success: T.success,
        warning: T.warn,
        error: T.error
      }[props.color ?? 'primary']
      return (
        <span style={{ fontSize: props.size ?? FS.body, color, lineHeight: 1, flexShrink: 0 }}>
          {props.name}
        </span>
      )
    }
  }),
  defineComponent({
    name: 'Image',
    description: 'Image by URL with optional alt, width, height, radius.',
    props: z.object({
      src: z.string(),
      alt: z.string().optional(),
      width: z.string().optional(),
      height: z.string().optional(),
      radius: z.string().optional(),
      fit: z.enum(['cover', 'contain']).default('cover')
    }),
    component: ({ props }) => (
      <img
        src={props.src}
        alt={props.alt ?? ''}
        style={{
          width: props.width ?? '100%',
          height: props.height ?? 'auto',
          borderRadius: props.radius ?? radiusSm,
          objectFit: props.fit,
          display: 'block',
          maxWidth: '100%'
        }}
      />
    )
  }),
  defineComponent({
    name: 'Link',
    description: 'Clickable text link.',
    props: z.object({ text: z.string(), href: z.string(), external: z.boolean().default(true) }),
    component: ({ props }) => (
      <a
        href={props.href}
        target={props.external ? '_blank' : undefined}
        rel={props.external ? 'noreferrer' : undefined}
        style={{
          fontSize: FS.body,
          color: T.accentText,
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          textDecorationColor: 'color-mix(in srgb, ' + T.accentText + ' 45%, transparent)',
          cursor: 'pointer'
        }}
      >
        {props.text}
      </a>
    )
  }),

  // ---------- 布局 ----------,
  defineComponent({
    name: 'Stack',
    description: 'Flex container. direction=column|row, gap, align, padding, wrap.',
    props: z.object({
      children: z.array(z.unknown()).optional(),
      direction: z
        .enum(['column', 'row', 'col', 'vert', 'vertical', 'horiz', 'horizontal'])
        .default('column'),
      gap: z.number().default(8),
      align: z.enum(['start', 'center', 'end', 'stretch']).default('stretch'),
      justify: z.enum(['start', 'center', 'end', 'between']).default('start'),
      padding: z.number().default(0),
      wrap: z.boolean().default(false)
    }),
    component: ({ props, renderNode }) => (
      <div
        style={{
          display: 'flex',
          flexDirection: DIR(props.direction),
          gap: props.gap,
          alignItems: props.align,
          justifyContent: {
            start: 'flex-start',
            center: 'center',
            end: 'flex-end',
            between: 'space-between'
          }[props.justify],
          padding: props.padding,
          flexWrap: props.wrap ? 'wrap' : 'nowrap',
          minHeight: 4,
          minWidth: 0
        }}
      >
        {kids(props, renderNode)}
      </div>
    )
  }),
  defineComponent({
    name: 'Grid',
    description: 'CSS grid. columns=N equal columns (responsive), gap between cells.',
    props: z.object({
      children: z.array(z.unknown()).optional(),
      columns: z.number().default(2),
      gap: z.number().default(12),
      minWidth: z.number().default(140)
    }),
    component: ({ props, renderNode }) => (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${props.minWidth}px, 1fr))`,
          gap: props.gap,
          minWidth: 0
        }}
      >
        {kids(props, renderNode)}
      </div>
    )
  }),
  defineComponent({
    name: 'Divider',
    description: 'Horizontal rule with optional label.',
    props: z.object({ label: z.string().optional() }),
    component: ({ props }) =>
      props.label ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, margin: `${S.xs}px 0` }}>
          <div style={{ flex: 1, height: 1, background: T.hairline }} />
          <span style={{ fontSize: FS.caption, color: T.inkTertiary, lineHeight: 1.6 }}>
            {props.label}
          </span>
          <div style={{ flex: 1, height: 1, background: T.hairline }} />
        </div>
      ) : (
        <div style={{ height: 1, background: T.hairline, margin: `${S.xs}px 0` }} />
      )
  }),
  defineComponent({
    name: 'Spacer',
    description: 'Vertical or horizontal whitespace.',
    props: z.object({ size: z.number().default(8) }),
    component: ({ props }) => <div style={{ height: props.size, flexShrink: 0 }} />
  })
]
