// 设计系统 token（v3 · Precision Editorial）。
//
// 原则：所有颜色/字体/圆角/阴影一律来自 DSH 主题（--dsw-* / --dsh-*），
// 明暗主题自动跟随；组件代码里不出现硬编码色值（theme-test 守护）。
//
// 视觉语言：DSH 的墨色排版 + 单一点缀色（业务蓝）+ 精确发丝线 + 分层表面。
// 数据视觉以「蓝为主、绿/琥珀/红为语义强调」；品牌黑白只用于主按钮与正文墨色。

// ---------- 主题 token ----------
export const T = {
  // 画布与表面。亮色主题下 layer-1/2/3 都是白，层次靠发丝线与内嵌底色表达；
  // 暗色主题有真实表面阶梯（#232324 → #2c2c2e → #353638）。
  canvas: 'var(--dsw-alias-bg-base)',
  surface: 'var(--dsw-alias-bg-layer-1)',
  surfaceRaised: 'var(--dsw-alias-bg-layer-2)',
  surfaceSunken: 'var(--dsw-alias-markdown-code-block)', // 亮 #f9fafb / 暗 #1b1b1c
  surfaceTint: 'var(--dsw-alias-bg-module-platform)', // 亮 #f5f6f7 / 暗 #2c2c2e
  surfaceOverlay: 'var(--dsw-alias-bg-overlay)', // 亮 #e9ecf2 / 暗 #61666b
  surfaceHover: 'var(--dsw-alias-interactive-bg-hover-solid)', // 亮 #f1f3f5 / 暗 #353638

  // 描边：l1 极淡（表内分隔）、l2 结构线、l3 卡片轮廓、l4 强调轮廓
  hairline: 'var(--dsw-alias-border-l1)',
  border: 'var(--dsw-alias-border-l2)',
  borderStrong: 'var(--dsw-alias-border-l3)',
  borderHeavy: 'var(--dsw-alias-border-l4)',

  // 墨色层级
  ink: 'var(--dsw-alias-label-primary)',
  inkSecondary: 'var(--dsw-alias-label-secondary)',
  inkTertiary: 'var(--dsw-alias-label-tertiary)',
  inkCaption: 'var(--dsw-alias-label-caption)',
  inkInverted: 'var(--dsw-alias-label-primary-inverted)',

  // 强调色：DSH 业务蓝（亮 #4176e6 / 暗 #7aaaff）。品牌黑/白不用于数据着色。
  accent: 'var(--dsw-alias-state-business-primary)',
  accentText: 'var(--dsw-alias-link)',

  // 语义状态
  success: 'var(--dsw-alias-state-success-primary)',
  warning: 'var(--dsw-alias-state-warn-primary)',
  danger: 'var(--dsw-alias-state-error-primary)',
  warningText: 'var(--dsw-alias-state-warn-label)',

  // 交互
  hover: 'var(--dsw-alias-interactive-bg-hover)',
  hoverSolid: 'var(--dsw-alias-interactive-bg-hover-solid)',
  activeBg: 'var(--dsw-alias-interactive-bg-active)',
  focus: 'var(--dsw-alias-state-business-primary)',

  // 代码
  codeBg: 'var(--dsw-alias-markdown-code-block)',
  codeBanner: 'var(--dsw-alias-markdown-code-block-banner)',

  // 按钮（DSH 反差按钮：亮色黑底白字 / 暗色白底黑字）
  buttonFill: 'var(--dsw-alias-button-primary-fill)',
  buttonFillHover: 'var(--dsw-alias-button-primary-hover)'
}

/** 透明混合：tint(T.accent, 10) → color-mix(… 10%, transparent)。 */
export const tint = (color, percent) => `color-mix(in srgb, ${color} ${percent}%, transparent)`
/** 与表面混合：让色块在任何主题下都柔和。 */
export const soften = (color, percent, surface = T.surface) =>
  `color-mix(in srgb, ${color} ${percent}%, ${surface})`

/**
 * 语义墨色：语义色直接当文字色在浅色底上对比度不足（绿底绿字 ≈2.3:1）。
 * 与正文墨色混合后：亮色主题变深、暗色主题变亮，明暗都能过 4.5:1 附近。
 * 规则：**文字/图标用 INK，圆点/填充/描边用原色 T.success 等**。
 */
export const INK = {
  accent: `color-mix(in srgb, ${T.accent} 52%, ${T.ink})`,
  success: `color-mix(in srgb, ${T.success} 55%, ${T.ink})`,
  warning: `color-mix(in srgb, ${T.warning} 62%, ${T.ink})`,
  danger: `color-mix(in srgb, ${T.danger} 58%, ${T.ink})`
}

// 语义浅底（Callout/Badge/状态单元）
export const TINT = {
  accent: tint(T.accent, 10),
  accentLine: tint(T.accent, 24),
  success: tint(T.success, 12),
  warning: tint(T.warning, 14),
  danger: tint(T.danger, 10),
  neutral: tint(T.ink, 6)
}

/** 数据可视化调色板：业务蓝领先，语义色随后，其余由色彩混合派生，明暗都可用。 */
export const PALETTE = [
  T.accent,
  T.success,
  T.warning,
  T.danger,
  `color-mix(in srgb, ${T.accent} 58%, ${T.success})`,
  `color-mix(in srgb, ${T.accent} 55%, ${T.danger})`,
  `color-mix(in srgb, ${T.warning} 68%, ${T.danger})`
]
/** 旧名：扩展系列。 */
export const PALETTE_EXTRA = PALETTE.slice(4)

/** 系列色：只接受主题 token 形式的自定义颜色（禁止硬编码）。 */
export const seriesColor = (color, fallback) =>
  typeof color === 'string' && /^var\(--dsw-[\w-]+\)$/.test(color) ? color : fallback

// ---------- 排版 ----------
// 七档：11 / 13 / 14 / 15 / 16 / 19 / 26（默认正文字号 14px 时），
// 随 DSH「正文字号」设置缩放，与 Markdown 正文保持同一呼吸。
const BODY = 14
export const FS = {
  caption: '11px',
  small: 'var(--dsh-content-font-size-secondary, 13px)',
  body: 'var(--dsh-content-font-size, 14px)',
  lead: `calc(var(--dsh-content-font-size, ${BODY}px) + 1px)`,
  title: `calc(var(--dsh-content-font-size, ${BODY}px) + 2px)`,
  heading: `calc(var(--dsh-content-font-size, ${BODY}px) + 5px)`,
  display: `calc(var(--dsh-content-font-size, ${BODY}px) + 12px)`
}
/** 旧名（迁移期） */
FS.h2 = FS.heading
FS.h3 = FS.title
export const FW = { regular: 400, medium: 500, semibold: 600, bold: 700 }
/** 字距：字号越大收得越多；数字统一 tabular。 */
export const TRACK = {
  display: '-0.03em',
  heading: '-0.02em',
  title: '-0.01em',
  body: '0',
  caption: '0.01em',
  h2: '-0.02em',
  h3: '-0.01em'
}
export const LH = { caption: 1.45, body: 1.62, title: 1.4, heading: 1.35, display: 1.05 }
export const NUMS = { fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }

// ---------- 度量 ----------
/** 4px 节奏，但主节奏是 8px：间距只用 2/4/8/12/16/20/24/32。 */
export const S = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 }
export const radius = 'var(--dsw-radius-lg, 16px)'
export const radiusMd = 'var(--dsw-radius-md, 12px)'
export const radiusSm = 'var(--dsw-radius-sm, 8px)'
export const radiusXs = 'var(--dsw-radius-xs, 4px)'
export const radiusFull = '999px'
/** 旧名 */
export { radius as radiusLg }

/** 高程：只用于「浮起」语义（elevated Card / 浮层），静止内容不用阴影。 */
export const ELEVATION = {
  none: 'none',
  soft: 'var(--dsw-elevation-soft)',
  panel: 'var(--dsw-elevation-panel)',
  prominent: 'var(--dsw-elevation-prominent)'
}
/** 旧名：默认无阴影。 */
export const SHADOW = { none: 'none', sm: 'none', md: 'none' }

// ---------- 方向与枚举别名归一 ----------
/** 方向别名归一：模型常写 col/vert/horiz。 */
export const DIR = (d) =>
  ({
    col: 'column',
    vert: 'column',
    vertical: 'column',
    horiz: 'row',
    horizontal: 'row'
  })[d] ?? d

/**
 * 枚举别名：模型常把 info/column/small 等常见词混用，统一映射到合法值。
 * 渲染前用 `alias(kind, v)`；参数绑定阶段用它做值域归位（sm→size、bold→weight）。
 */
export const ALIAS = {
  variant: {
    info: 'brand',
    neutral: 'default',
    muted: 'default',
    danger: 'error',
    note: 'info',
    tip: 'info'
  },
  type: { column: 'bar', spline: 'line', curved: 'line', smooth: 'line' },
  size: { small: 'sm', medium: 'md', large: 'lg', xlarge: 'xl', xl: 'xl' },
  format: { percentage: 'percent', money: 'currency', numeric: 'number', int: 'number' },
  weight: {
    thin: 'normal',
    light: 'normal',
    regular: 'normal',
    normal: 'normal',
    medium: 'medium',
    semi: 'semibold',
    'semi-bold': 'semibold',
    semibold: 'semibold',
    heavy: 'bold',
    black: 'bold',
    bolder: 'bold',
    strong: 'bold',
    bold: 'bold'
  },
  direction: {
    flex: 'column',
    'flex-col': 'column',
    'flex-column': 'column',
    'flex-row': 'row',
    hstack: 'row',
    vstack: 'column',
    block: 'column',
    inline: 'row'
  },
  align: {
    middle: 'center',
    'flex-start': 'start',
    'flex-end': 'end',
    'space-between': 'between',
    'space-around': 'around'
  },
  justify: {
    middle: 'center',
    'flex-start': 'start',
    'flex-end': 'end',
    'space-between': 'between',
    'space-around': 'around',
    'space-evenly': 'around'
  },
  color: {
    grey: 'secondary',
    gray: 'secondary',
    muted: 'tertiary',
    danger: 'error',
    red: 'error',
    green: 'success',
    orange: 'warning',
    yellow: 'warning',
    blue: 'brand'
  },
  transform: { upper: 'uppercase', lower: 'lowercase' },
  shadow: { small: 'sm', medium: 'md', large: 'md' }
}
export const alias = (kind, v) => ALIAS[kind]?.[v] ?? v

// 注释/坐标轴标签的固定字号（与 DSH 代码块小号一致）。
export const CAPTION_PX = 11

// SSR/首次布局的名义宽度；挂载后以实际容器宽度为准，展开/收起不改变测量口径。
export const CHART_WIDTH = { compact: 240, expanded: 480 }
export const TICK_GAP = 12
export const tickWidth = (text) =>
  Array.from(text).reduce((sum, c) => sum + (c.codePointAt(0) < 128 ? 0.6 : 1) * CAPTION_PX, 0)
export const tickText = (label, maxWidth) => {
  const chars = Array.from(label)
  if (chars.length <= 6 && tickWidth(label) <= maxWidth) return label
  chars.length = Math.min(chars.length, 5)
  while (chars.length && tickWidth(chars.join('') + '…') > maxWidth) chars.pop()
  return chars.join('') + '…'
}
export function chartTickIndices(texts, width, xAt) {
  const widths = texts.map(tickWidth)
  const slot = Math.max(0, ...widths) + TICK_GAP
  const maxTicks = Math.max(2, Math.floor(width / slot))
  const step = Math.ceil(texts.length / maxTicks) || 1
  const indices = texts.map((_, i) => i).filter((i) => i % step === 0)
  // 替换最后的步长位，避免在相邻刻度后硬塞末标签；数量始终 <= maxTicks。
  if (indices.length > 1) indices[indices.length - 1] = texts.length - 1
  const last = texts.length - 1
  let right = -Infinity
  return indices.filter((i) => {
    const left = xAt(i) - (i === 0 ? 0 : i === last ? widths[i] : widths[i] / 2)
    // 首尾采用向内对齐，需额外检查与居中刻度的实际占位。
    if (
      i !== 0 &&
      i !== last &&
      (left < right + TICK_GAP || left + widths[i] + TICK_GAP > xAt(last) - widths[last])
    )
      return false
    right = left + widths[i]
    return true
  })
}

// ---------- 兼容旧 token 名（迁移期，组件全部升级后移除） ----------
Object.assign(T, {
  textPrimary: T.ink,
  textSecondary: T.inkSecondary,
  textTertiary: T.inkTertiary,
  textInverted: T.inkInverted,
  brand: T.accent,
  brandFill: T.buttonFill,
  warn: T.warning,
  error: T.danger,
  stripe: T.surfaceTint,
  code: T.codeBg,
  tintBrand: TINT.accent,
  tintSuccess: TINT.success,
  tintWarn: TINT.warning,
  tintError: TINT.danger
})
