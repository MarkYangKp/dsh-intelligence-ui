// 共享视觉原子与内部 helper（不暴露给模型，只服务组件实现）。
// 只消费 theme.js 的 token；不写死颜色。
import React from 'react'
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
  radiusXs,
  radiusFull
} from './theme.js'

/** 渲染 children 数组的通用 helper。 */
export const kids = (props, renderNode) =>
  (props.children ?? []).map((c, i) => <React.Fragment key={i}>{renderNode(c)}</React.Fragment>)

/**
 * 面板标题：所有数据组件统一一套（图表 / 地图 / 热力 / 表格）。
 * 小号、次级墨色、与内容 10px 呼吸；右侧可挂说明。
 */
export function PanelTitle({ children, right }) {
  if (children == null) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: S.sm,
        marginBottom: S.sm + 2,
        minWidth: 0
      }}
    >
      <div
        style={{
          fontSize: FS.small,
          fontWeight: FW.medium,
          color: T.inkSecondary,
          lineHeight: LH.title,
          minWidth: 0
        }}
      >
        {children}
      </div>
      {right != null && (
        <div
          style={{
            marginLeft: 'auto',
            fontSize: FS.caption,
            color: T.inkCaption,
            ...NUMS
          }}
        >
          {right}
        </div>
      )}
    </div>
  )
}

/** 展开控件 hook：默认紧凑，点击展开大视图（原地增高，不弹层）。 */
export function useExpanded() {
  const [open, setOpen] = React.useState(false)
  return [open, () => setOpen((o) => !o)]
}

/** 展开/收起按钮：低视觉权重的胶囊，悬停才显形。 */
export function ExpandToggle({ open, onToggle, note }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: S.sm }}>
      <button
        type="button"
        onClick={onToggle}
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
        {note != null ? note + ' · ' : ''}
        {open ? '收起' : '展开'}
      </button>
    </div>
  )
}

/**
 * 播放控件（内部 helper，不暴露给模型）。
 * Button 组件的点击只做本地反馈，无法驱动状态，所以动画类组件用自己的按钮。
 */
export function PlayControls({ playing, step, total, onPlay, onPrev, onNext, onReset }) {
  const btn = (label, fn, primary) => (
    <button
      type="button"
      key={label}
      onClick={fn}
      style={{
        padding: primary ? '6px 14px' : '4px 10px',
        borderRadius: radiusFull,
        fontSize: FS.caption,
        letterSpacing: '0.01em',
        cursor: 'pointer',
        width: 'fit-content',
        lineHeight: 1.7,
        border: `1px solid ${primary ? 'transparent' : T.border}`,
        background: primary ? T.buttonFill : T.surface,
        color: primary ? T.inkInverted : T.inkSecondary,
        fontWeight: primary ? FW.medium : FW.regular,
        transition: 'background-color .15s ease'
      }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {btn(playing ? '暂停' : '播放', onPlay, true)}
      {btn('上一步', onPrev)}
      {btn('下一步', onNext)}
      {btn('重置', onReset)}
      <span
        style={{
          fontSize: FS.caption,
          color: T.inkTertiary,
          marginLeft: S.xs,
          ...NUMS
        }}
      >
        {step >= 0 ? `${step + 1} / ${total}` : `0 / ${total}`}
      </span>
    </div>
  )
}

// ============================================================
// 视觉原子：让 44 个组件共享同一套表面、描边、指标与状态语言。
// ============================================================

const SURFACE_TONE = {
  plain: T.surface,
  raised: T.surfaceRaised,
  sunken: T.surfaceSunken,
  tint: T.surfaceTint,
  transparent: 'transparent'
}

/** 统一表面容器：底色 + 结构描边 + 圆角；elevated 才使用 DSH 高程。 */
export function Surface({
  tone = 'plain',
  padding = S.lg,
  border = true,
  radius: r = radius,
  elevated = false,
  children,
  style
}) {
  return (
    <div
      style={{
        background: SURFACE_TONE[tone] ?? T.surface,
        border: border ? `1px solid ${T.border}` : 'none',
        borderRadius: r,
        padding,
        minWidth: 0,
        boxShadow: elevated ? 'var(--dsw-elevation-soft)' : 'none',
        ...style
      }}
    >
      {children}
    </div>
  )
}

/** 眉题：指标/区块上方的小号说明文字（不用大写，保持中文阅读自然）。 */
export function Eyebrow({ children, color = T.inkTertiary }) {
  return (
    <div
      style={{
        fontSize: FS.caption,
        lineHeight: LH.caption,
        fontWeight: FW.medium,
        letterSpacing: TRACK.caption,
        color
      }}
    >
      {children}
    </div>
  )
}

/** 状态点：胶囊/表格状态列的圆点标记。 */
export function StatusDot({ color, size = 6 }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: radiusFull,
        background: color,
        flexShrink: 0
      }}
    />
  )
}

/** 变化量：↑ +12.6% 的胶囊，语义着色 + 极浅底。 */
export function Delta({ value, trend = 'flat' }) {
  // 文字用语义墨色（对比度足够），圆点/填充仍用原始语义色。
  const tone = trend === 'up' ? INK.success : trend === 'down' ? INK.danger : T.inkTertiary
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        fontSize: FS.caption,
        fontWeight: FW.medium,
        color: tone,
        ...NUMS,
        whiteSpace: 'nowrap'
      }}
    >
      {arrow} {value}
    </span>
  )
}

/** 图标位：emoji/字符放进极浅圆角方块，避免裸 emoji 的廉价感。 */
export function IconTile({ glyph, tone = 'accent', size = 28 }) {
  const bg =
    tone === 'neutral'
      ? TINT.neutral
      : tone === 'success'
        ? TINT.success
        : tone === 'warning'
          ? TINT.warning
          : tone === 'danger'
            ? TINT.danger
            : TINT.accent
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: radiusSm,
        background: bg,
        fontSize: Math.round(size * 0.5),
        lineHeight: 1,
        flexShrink: 0
      }}
    >
      {glyph}
    </span>
  )
}

/** 发丝分隔线：水平或垂直。 */
export function Rule({ vertical = false, tone = T.hairline, style }) {
  return (
    <div
      aria-hidden
      style={{
        background: tone,
        flexShrink: 0,
        ...(vertical ? { width: 1, alignSelf: 'stretch' } : { height: 1, width: '100%' }),
        ...style
      }}
    />
  )
}

/** 空态：低调的居中提示，避免大片空白。 */
export function EmptyState({ children }) {
  return (
    <div
      style={{
        fontSize: FS.small,
        color: T.inkTertiary,
        padding: `${S.md}px 0`,
        textAlign: 'center',
        lineHeight: LH.body
      }}
    >
      {children}
    </div>
  )
}

/** 段落说明：图表下方的口径注释等。 */
export function Note({ children }) {
  return (
    <div
      style={{
        fontSize: FS.caption,
        color: T.inkTertiary,
        lineHeight: LH.caption,
        marginTop: S.sm,
        ...TRACK.body
      }}
    >
      {children}
    </div>
  )
}

// ---------- 轻量语法高亮（零依赖，颜色全走主题 token） ----------
export const LANG_ALIAS = {
  js: 'js',
  javascript: 'js',
  jsx: 'js',
  mjs: 'js',
  cjs: 'js',
  ts: 'js',
  typescript: 'js',
  tsx: 'js',
  py: 'python',
  python: 'python',
  sh: 'bash',
  shell: 'bash',
  bash: 'bash',
  zsh: 'bash',
  console: 'bash',
  json: 'json',
  jsonc: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  http: 'http',
  sql: 'sql',
  css: 'css',
  scss: 'css',
  less: 'css',
  html: 'html',
  xml: 'html',
  vue: 'html',
  svg: 'html'
}
/** 词法规则：按顺序尝试，命中即消费。 */
export const RULES = {
  js: [
    ['//.*', 'comment'],
    ['/\\*.*?\\*/', 'comment'],
    ['"(?:\\\\.|[^"\\\\])*"', 'string'],
    ["'(?:\\\\.|[^'\\\\])*'", 'string'],
    ['`(?:\\\\.|[^`\\\\])*`', 'string'],
    [
      '\\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|from|export|default|async|await|try|catch|finally|throw|typeof|instanceof|of|in|this|super|yield|delete|void)\\b',
      'keyword'
    ],
    ['\\b(?:true|false|null|undefined|NaN)\\b', 'literal'],
    ['\\b\\d+(?:\\.\\d+)?\\b', 'number'],
    ['[A-Za-z_$][\\w$]*(?=\\s*\\()', 'func'],
    ['[{}()\\[\\].,;:?]+', 'punct'],
    ['[+\\-*/%=<>!&|~^]+', 'operator']
  ],
  python: [
    ['#.*', 'comment'],
    ['"{3}[\\s\\S]*?"{3}', 'string'],
    ["'{3}[\\s\\S]*?'{3}", 'string'],
    ['"(?:\\\\.|[^"\\\\])*"', 'string'],
    ["'(?:\\\\.|[^'\\\\])*'", 'string'],
    ['@[\\w.]+', 'prop'],
    [
      '\\b(?:def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|lambda|yield|pass|break|continue|raise|assert|global|nonlocal|del|in|is|not|and|or)\\b',
      'keyword'
    ],
    ['\\b(?:None|True|False)\\b', 'literal'],
    ['\\b\\d+(?:\\.\\d+)?\\b', 'number'],
    ['[A-Za-z_][\\w]*(?=\\s*\\()', 'func'],
    ['[{}()\\[\\].,:]+', 'punct'],
    ['[+\\-*/%=<>!&|~^]+', 'operator']
  ],
  json: [
    ['"(?:\\\\.|[^"\\\\])*"(?=\\s*:)', 'prop'],
    ['"(?:\\\\.|[^"\\\\])*"', 'string'],
    ['\\b(?:true|false|null)\\b', 'literal'],
    ['-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b', 'number'],
    ['[{}()\\[\\],:]', 'punct']
  ],
  bash: [
    ['#.*', 'comment'],
    ['"(?:\\\\.|[^"\\\\])*"', 'string'],
    ["'(?:\\\\.|[^'\\\\])*'", 'string'],
    ['\\$\\{[^}]*\\}|\\$[\\w@#?$!-]+', 'literal'],
    [
      '\\b(?:if|then|else|elif|fi|for|do|done|while|case|esac|function|return|export|local|echo|cd|exit|source|set)\\b',
      'keyword'
    ],
    ['--?[\\w-]+', 'prop'],
    ['\\b\\d+\\b', 'number'],
    ['[|&;<>(){}]+', 'punct']
  ],
  http: [
    ['^(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\\b', 'keyword'],
    ['^HTTP/[\\d.]+', 'literal'],
    [
      '\\b(?:Authorization|Content-Type|Accept|Host|Cookie|User-Agent|Cache-Control|Content-Length)\\b',
      'prop'
    ],
    ['\\b\\d{3}\\b', 'number'],
    ['"(?:\\\\.|[^"\\\\])*"', 'string'],
    ['[{}()\\[\\],:]', 'punct']
  ],
  sql: [
    ['--.*', 'comment'],
    ['/\\*.*?\\*/', 'comment'],
    ["'(?:''|[^'])*'", 'string'],
    [
      '\\b(?:SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|ALTER|DROP|AS|AND|OR|NOT|NULL|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END)\\b',
      'keyword'
    ],
    ['\\b\\d+(?:\\.\\d+)?\\b', 'number'],
    ['[(),.;*=<>]+', 'punct']
  ],
  css: [
    ['/\\*.*?\\*/', 'comment'],
    ['"(?:\\\\.|[^"\\\\])*"', 'string'],
    ["'(?:\\\\.|[^'\\\\])*'", 'string'],
    ['@[\\w-]+', 'keyword'],
    ['[.#][\\w-]+', 'prop'],
    ['[a-z-]+(?=\\s*:)', 'prop'],
    ['\\b\\d+(?:\\.\\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\\b', 'number'],
    ['[{}();:,]+', 'punct']
  ],
  html: [
    ['<!--.*?-->', 'comment'],
    ['</?[A-Za-z][\\w-]*', 'keyword'],
    ['[A-Za-z-]+(?==)', 'prop'],
    ['"(?:\\\\.|[^"\\\\])*"', 'string'],
    ["'(?:\\\\.|[^'\\\\])*'", 'string'],
    ['>', 'punct']
  ],
  yaml: [
    ['^\\s*#.*', 'comment'],
    ['^\\s*[\\w./-]+(?=\\s*:)', 'prop'],
    ['"(?:\\\\.|[^"\\\\])*"', 'string'],
    ["'(?:\\\\.|[^'\\\\])*'", 'string'],
    ['\\b(?:true|false|null|yes|no)\\b', 'literal'],
    ['-?\\b\\d+(?:\\.\\d+)?\\b', 'number'],
    ['^\\s*-\\s', 'punct']
  ]
}
export const RULE_CACHE = new Map()
export function rulesFor(lang) {
  const key = LANG_ALIAS[String(lang ?? '').toLowerCase()] ?? null
  if (!key || !RULES[key]) return null
  if (!RULE_CACHE.has(key)) {
    RULE_CACHE.set(
      key,
      RULES[key].map(([src, kind]) => ({ kind, re: new RegExp(src, 'y') }))
    )
  }
  return RULE_CACHE.get(key)
}

/** 把一行代码切成 token（未知语言返回 null，按纯文本渲染）。 */
export function tokenizeLine(line, rules) {
  if (!rules || line.length > 2000) return null
  const out = []
  let i = 0
  while (i < line.length) {
    let hit = null
    for (const r of rules) {
      r.re.lastIndex = i
      const m = r.re.exec(line)
      if (m && m[0] !== '') {
        hit = { text: m[0], kind: r.kind }
        break
      }
    }
    if (hit) {
      out.push(hit)
      i += hit.text.length
    } else {
      const prev = out[out.length - 1]
      if (prev && prev.kind === 'plain') prev.text += line[i]
      else out.push({ text: line[i], kind: 'plain' })
      i++
    }
  }
  return out
}

/** token 颜色：全部走主题 token；语义 token 用 INK 混墨色保证浅底对比度。 */
export function tokenColor(kind) {
  return (
    {
      keyword: INK.accent,
      string: INK.success,
      number: INK.warning,
      comment: T.inkSecondary,
      func: T.ink,
      prop: T.inkSecondary,
      literal: INK.accent,
      punct: T.inkSecondary,
      operator: T.inkSecondary,
      plain: T.ink
    }[kind] ?? T.ink
  )
}
