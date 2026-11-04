// OpenUI 运行时：组件库装配 + 解析/求值/渲染管线。
// 只依赖 @openuidev/lang-core（无 react-lang，因 DSH Web 壳的 React 是 18）。
// 组件实现拆分在 ./ui/*：每个模块负责一类组件的视觉与语义，互不依赖。
//
// 主题：所有颜色走 DSH 主题 token（--dsw-*），深色主题由
// body[data-ds-dark-theme] 覆盖同名 token 自动跟随。
import React, { useMemo } from 'react'
import { createLibrary, createParser, evaluateRoot, evaluate } from '@openuidev/lang-core'
import {
  RenderBoundary,
  FallbackNotice,
  displayText,
  useCopyText,
  assertSourceBudget,
  assertDataBudget
} from './render-safety.jsx'
import { T, FS, S, ALIAS } from './ui/theme.js'
import { components as primitives } from './ui/primitives.jsx'
import { components as containers } from './ui/containers.jsx'
import { components as text } from './ui/text.jsx'
import { components as files } from './ui/files.jsx'
import { components as data } from './ui/data.jsx'
import { components as charts } from './ui/charts.jsx'
import { components as map } from './ui/map.jsx'
import { components as process } from './ui/process.jsx'
import { components as controls } from './ui/controls.jsx'

// 组件顺序 = 基线快照的顺序（budget-test 用 library.toJSONSchema() 指纹守护 API 稳定性）。
const ORDER = [
  'Box',
  'Row',
  'Col',
  'Text',
  'Icon',
  'Image',
  'Link',
  'Stack',
  'Grid',
  'Divider',
  'Spacer',
  'Card',
  'CardHeader',
  'Section',
  'Callout',
  'Quote',
  'TextContent',
  'Heading',
  'BulletList',
  'KeyValue',
  'CodeBlock',
  'Diff',
  'FileTree',
  'Badge',
  'BadgeGroup',
  'StatCard',
  'Table',
  'ProgressBar',
  'Timeline',
  'Steps',
  'Checklist',
  'Chart',
  'Map',
  'Heatmap',
  'PieChart',
  'Sparkline',
  'SearchTable',
  'SegmentedControl',
  'ComparisonBar',
  'Diagram',
  'TreeView',
  'Button',
  'Tabs',
  'Accordion'
]
const ALL = [
  ...primitives,
  ...containers,
  ...text,
  ...files,
  ...data,
  ...charts,
  ...map,
  ...process,
  ...controls
]
const byName = Object.fromEntries(ALL.map((c) => [c.name, c]))
const ordered = ORDER.map((name) => {
  const def = byName[name]
  if (!def) throw new Error('[dsh-intelligence-ui] 组件缺失: ' + name)
  return def
})
if (ALL.length !== ORDER.length)
  throw new Error('[dsh-intelligence-ui] 组件数量不一致: ' + ALL.length + ' != ' + ORDER.length)

export const library = createLibrary({ root: 'Stack', components: ordered })

const schema = library.toJSONSchema()
const functions = Object.fromEntries(
  Object.entries(schema.functions ?? {}).flatMap(([name, s]) => {
    const fn = library.functions?.[name]?.fn
    return fn ? [[name, { ...s, fn }]] : []
  })
)
const parser = createParser(schema, library.root ?? 'Stack')

/**
 * 解析 + 静态求值一段 OpenUI Lang 程序（Query 用其 defaults）。
 * @param {string} code 程序文本
 * @returns {{ root: object | null, errors: Array<{message:string}> }}
 */

/** 把 Python/JS 风格字面量归一为 OpenUI 的 null/true/false（跳过字符串内容）。 */
export function normalizeLiterals(code) {
  const MAP = { None: 'null', True: 'true', False: 'false', undefined: 'null', nil: 'null' }
  let out = ''
  let i = 0
  let quote = null
  while (i < code.length) {
    const ch = code[i]
    if (quote) {
      out += ch
      if (ch === '\\') {
        out += code[i + 1] ?? ''
        i += 2
        continue
      }
      if (ch === quote) quote = null
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      out += ch
      i++
      continue
    }
    const m = /^([A-Za-z_$][\w$]*)/.exec(code.slice(i))
    if (m) {
      const word = m[1]
      out += Object.hasOwn(MAP, word) ? MAP[word] : word
      i += word.length
      continue
    }
    out += ch
    i++
  }
  return out
}

/** 推断 prop / 参数的类型种类（用于按形状智能绑定位置参数）。 */
function kindOf(z) {
  return kindAndOptional(z).kind
}

/** 同 kindOf,但额外标记槽位是否可省略(optional/default 包装,或 nullable 联合——可传 null 占位)。 */
function kindAndOptional(z, optional = false) {
  let d = z?._def ?? z
  if (!d) return { kind: 'any', optional }
  let t = d.type
  if (t === 'optional' || t === 'default' || t === 'readonly' || t === 'prefault') {
    return kindAndOptional(d.innerType ?? d.schema, true)
  }
  if (t === 'nullable') {
    return kindAndOptional(d.innerType ?? d.schema, true)
  }
  if (t === 'array') {
    return { kind: 'array:' + kindAndOptional(d.element).kind, optional }
  }
  if (t === 'record' || t === 'object' || t === 'map') return { kind: 'object', optional }
  if (t === 'enum' || t === 'literal') return { kind: 'string', optional }
  if (t === 'union') {
    const opts = d.options ?? []
    const metas = opts.map((o) => kindAndOptional(o))
    const nullable = metas.some((x) => x.kind === 'null')
    // 联合值域可能既收字符串又收数组（如 TreeView.traversals）：记下全部类型，
    // 绑定阶段只要命中任一分支就算适配；多类型联合的主 kind 记为 any，
    // 具体判定交给 altKinds（避免把数组值判成「只收字符串」）。
    const kinds = [
      ...new Set(metas.map((m) => m.kind).filter((k) => k !== 'unknown' && k !== 'any'))
    ]
    return {
      kind: kinds.length > 1 ? 'any' : (kinds[0] ?? 'any'),
      optional: optional || nullable,
      kinds
    }
  }
  if (t === 'unknown' || t === 'any') return { kind: 'any', optional }
  return { kind: ['string', 'number', 'boolean', 'null'].includes(t) ? t : 'any', optional }
}

/** 推断一个源码字面量参数的类型种类。 */
function argKind(a) {
  const t = String(a).trim()
  if (/^["'`]/.test(t)) return 'string'
  if (/^[+-]?(\d|\.\d)/.test(t)) return 'number'
  if (/^(true|false)$/.test(t)) return 'boolean'
  if (/^null$/.test(t)) return 'null'
  if (t.startsWith('[')) {
    const inner = t.slice(1).trim()
    if (inner.startsWith('{')) return 'array:object'
    if (/^["'`]/.test(inner)) return 'array:string'
    if (/^[+-]?(\d|\.\d)/.test(inner)) return 'array:number'
    if (inner.startsWith('[')) return 'array:array'
    if (inner === '') return 'array:empty'
    return 'array:any'
  }
  if (t.startsWith('{')) return 'object'
  return 'any'
}

/** 类型兼容：null 可填任意槽；array:* 之间宽松匹配（含嵌套数组）。 */
function compatible(a, b) {
  if (a === 'null' || b === 'null') return true
  if (a === b) return true
  if (a === 'any' || b === 'any') return true
  if (a.startsWith('array') && b.startsWith('array')) {
    if (a === 'array:empty' || b === 'array:empty' || a === 'array:any' || b === 'array:any')
      return true
    // 嵌套数组的元素类型编码不同（[[i,j]] → array:array，schema → array:array:number），
    // 只要一方是另一方的前缀即视为同族。
    return a.startsWith(b) || b.startsWith(a)
  }
  return false
}

/** 从 zod schema 里收集可接受的字符串枚举值（展开 optional/default/nullable/union）。 */
function enumValuesOf(z) {
  const out = new Set()
  const visit = (node, depth) => {
    if (!node || depth > 8) return
    const d = node._def ?? node
    const t = d.type
    if (
      t === 'optional' ||
      t === 'default' ||
      t === 'readonly' ||
      t === 'prefault' ||
      t === 'nullable'
    ) {
      visit(d.innerType ?? d.schema, depth + 1)
      return
    }
    if (t === 'enum') {
      for (const v of Object.values(d.entries ?? d.values ?? {}))
        if (typeof v === 'string') out.add(v)
      return
    }
    if (t === 'literal') {
      const vals = d.values ?? (d.value !== undefined ? [d.value] : [])
      for (const v of vals) if (typeof v === 'string') out.add(v)
      return
    }
    if (t === 'union') for (const o of d.options ?? []) visit(o, depth + 1)
  }
  visit(z, 0)
  return out
}

/** 解析一个完整的字符串字面量参数（引号必须配对；模板插值/变量引用返回 null）。 */
function stringLiteralOf(arg) {
  const t = String(arg).trim()
  const q = t[0]
  if (q !== '"' && q !== "'" && q !== '`') return null
  if (t.length < 2 || t[t.length - 1] !== q) return null
  let escapes = 0
  for (let i = t.length - 2; i >= 0 && t[i] === '\\'; i--) escapes++
  if (escapes % 2 === 1) return null
  const body = t.slice(1, -1)
  if (q === '`' && body.includes('${')) return null
  if (q === "'") return body.replace(/\\(['\\])/g, '$1')
  return body
}

const ENUM_ALIAS_FAMILIES = Object.values(ALIAS)

/**
 * 判断一个参数值能否落进某槽位的枚举值域：
 * - undefined：该槽没有枚举值域，或参数不是字符串字面量（交给类型匹配）；
 * - null：是字符串字面量但不属于此值域（不能硬塞）；
 * - string：命中（可能是别名归一后的规范值）。
 */
function enumMatch(enums, arg) {
  if (!enums || enums.size === 0) return undefined
  const raw = stringLiteralOf(arg)
  if (raw == null) return undefined
  if (enums.has(raw)) return raw
  for (const fam of ENUM_ALIAS_FAMILIES) {
    const mapped = fam[raw]
    if (typeof mapped === 'string' && enums.has(mapped)) return mapped
  }
  return null
}

/** 值域命中的字面量统一写成规范值（双引号），别名归一如 small→sm。 */
const quotedValue = (v) => JSON.stringify(v)

/** 槽位是否接受该源码字面量类型（联合槽只要有分支兼容即可）。 */
const slotAccepts = (k, idx, kinds, altKinds) =>
  (altKinds?.[idx] ?? [kinds[idx]]).some((kk) => compatible(k, kk))

/**
 * 位置参数绑定：先按声明顺序严格入槽（保留模型写下的位置语义），
 * 只对「类型/值域都不可能」的参数做语义归位：
 *   1. 值域归位 —— sm→size、bold→weight、column→direction 这类同组件内
 *      明确属于另一个枚举域的值，搬到值域匹配的空槽；
 *   2. 类型归位 —— 例如 Section(title, [children]) 的数组落到 children；
 *   3. 仍无处安放：可选槽静默丢弃（避免不可补救的警告），必填槽保留原位
 *      交给校验层报错。
 * occupied 里的槽位（已由命名参数占位）不参与分配。
 */
function bindArgs(kinds, args, optionalFlags, enums, altKinds, occupied = new Set()) {
  const slots = new Array(kinds.length).fill(undefined)
  const taken = new Set(occupied)
  const pending = []
  const aliasPending = []
  let cursor = 0
  for (const arg of args) {
    while (cursor < kinds.length && taken.has(cursor)) cursor++
    if (cursor >= kinds.length) {
      pending.push({ arg, k: argKind(arg), from: -1 })
      continue
    }
    const idx = cursor++
    const k = argKind(arg)
    const m = enumMatch(enums?.[idx], arg)
    const fits = m === undefined ? slotAccepts(k, idx, kinds, altKinds) : m !== null
    if (fits) {
      const raw = stringLiteralOf(arg)
      // 只靠别名猜中的值（direction="flex"→column）先让位：后面的精确成员
      // （"column"）才是真正的布局意图，避免 "flex", "column" 互换槽位。
      if (m != null && raw != null && m !== raw) {
        aliasPending.push({ arg, k, from: idx })
        continue
      }
      slots[idx] = m != null ? quotedValue(m) : arg
      taken.add(idx)
    } else {
      pending.push({ arg, k, from: idx })
    }
  }
  for (const p of [...pending, ...aliasPending]) {
    let placed = false
    if (stringLiteralOf(p.arg) != null) {
      for (let i = 0; i < kinds.length; i++) {
        if (taken.has(i) || kinds[i] === 'used') continue
        const m = enumMatch(enums?.[i], p.arg)
        if (m != null) {
          slots[i] = quotedValue(m)
          taken.add(i)
          placed = true
          break
        }
      }
    }
    if (!placed) {
      for (let i = 0; i < kinds.length; i++) {
        if (taken.has(i) || kinds[i] === 'used' || !slotAccepts(p.k, i, kinds, altKinds)) continue
        if (enumMatch(enums?.[i], p.arg) === null) continue
        slots[i] = p.arg
        taken.add(i)
        placed = true
        break
      }
    }
    if (!placed && p.from >= 0) {
      // 放不下的字符串多半是模型写错的值（如 align=..."6"）：保留原位让校验层给出
      // 可修正的警告，而不是悄悄变空；数字/数组/布尔这类「类型都不可能」的值
      // 无法通过任何合法值补救，静默丢弃（与原策略一致）。
      if (stringLiteralOf(p.arg) != null && slots[p.from] === undefined) {
        slots[p.from] = p.arg
        taken.add(p.from)
      }
    }
  }
  return slots
}

// ---------- 命名参数兼容层 ----------
// 模型常写出 Chart(series=[...], height=280) 这类命名参数；lang-core 只接受位置参数。
// 这里按组件 schema 的参数顺序把命名参数重排为位置参数，缺失的可选参数用默认值补齐。
const NAMED_ARG_POSITIONS = (() => {
  const map = {}
  for (const [name, comp] of Object.entries(library.components)) {
    const shape = comp.props?.shape ?? comp.props?._def?.shape
    if (!shape) continue
    let defaults = {}
    try {
      defaults = comp.props.parse({}) ?? {}
    } catch {
      defaults = {}
    }
    const metas = Object.values(shape).map((s) => ({
      ...kindAndOptional(s),
      enums: enumValuesOf(s)
    }))
    map[name] = {
      order: Object.keys(shape),
      defaults,
      kinds: metas.map((m) => m.kind),
      optionalFlags: metas.map((m) => m.optional),
      enums: metas.map((m) => m.enums),
      altKinds: metas.map((m) => m.kinds)
    }
  }
  return map
})()

const serializeDefault = (v) => {
  // 可选参数没有默认值时用 null 占位，保持位置对齐（不能当作"缺失"而放弃整次归一化）
  if (v === undefined) return 'null'
  if (v === null) return 'null'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    return JSON.stringify(v)
  try {
    return JSON.stringify(v)
  } catch {
    return null
  }
}

/** 找到与 s[openIdx]='(' 匹配的右括号（跳过字符串与转义）。 */
function matchParen(s, openIdx) {
  let depth = 0
  let quote = null
  for (let i = openIdx; i < s.length; i++) {
    const ch = s[i]
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 按顶层逗号切分参数。 */
function splitArgs(inner) {
  const out = []
  let depth = 0
  let quote = null
  let start = 0
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ',' && depth === 0) {
      out.push(inner.slice(start, i))
      start = i + 1
    }
  }
  out.push(inner.slice(start))
  return out.map((a) => a.trim()).filter((a) => a !== '')
}

/** 首参是 children 数组的组件（用于把裸子元素自动包成数组）。 */
const CHILD_ARRAY_COMPONENTS = (() => {
  const set = new Set()
  for (const [name, info] of Object.entries(NAMED_ARG_POSITIONS)) {
    if (info.order[0] === 'children') set.add(name)
  }
  return set
})()

const looksLikeComponent = (arg) => {
  const a = String(arg).trim()
  return /^[A-Z][A-Za-z0-9_]*\s*\(/.test(a) || /^[A-Za-z_$][\w$]*$/.test(a)
}

/** 把 `Stack(a, b)` 的裸子元素包成 `Stack([a, b])`。 */
/**
 * KeyValue 的 items 高频速记纠正：模型常写单键对象数组
 * `[{"负载 1min": "0.40"}]`（即 label→value 的映射），schema 要 `{label, value}`。
 * 仅当条目恰为一个键（且键不是 label/value 本身）时改写，多键条目原样保留。
 */
function coerceMapStyleItems(text) {
  const t = String(text).trim()
  if (!t.startsWith('[') || !t.endsWith(']')) return text
  const inner = t.slice(1, -1).trim()
  if (inner === '') return text
  const entries = splitArgs(inner)
  if (entries.length === 0) return text
  const singleKey =
    /^\{\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_$][\w$]*)\s*:\s*([\s\S]+?)\s*\}$/
  let touched = false
  const out = entries.map((e) => {
    const m = singleKey.exec(e.trim())
    if (!m) return e.trim()
    let key = m[1]
    if (!key.startsWith('"') && !key.startsWith("'")) key = '"' + key + '"'
    if (key === '"label"' || key === '"value"' || key === "'label'" || key === "'value'")
      return e.trim()
    touched = true
    return `{label: ${key}, value: ${m[2].trim()}}`
  })
  return touched ? '[' + out.join(', ') + ']' : text
}

function wrapChildArgs(name, args) {
  if (!CHILD_ARRAY_COMPONENTS.has(name) || args.length === 0) return args
  if (String(args[0]).trim().startsWith('[')) return args
  let end = 0
  while (end < args.length && looksLikeComponent(args[end])) end++
  if (end === 0) return args
  return ['[' + args.slice(0, end).join(', ') + ']', ...args.slice(end)]
}

/**
 * 把命名参数调用重排为位置参数（递归处理嵌套调用），并把裸子元素包成数组。
 * @param {string} code 程序文本
 * @returns {{code: string, changed: boolean}}
 */
export function normalizeNamedArgs(code) {
  let changed = false
  let out = ''
  let i = 0
  while (i < code.length) {
    // Never rewrite example calls inside strings or comments.
    const ch = code[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      const start = i++
      while (i < code.length) {
        if (code[i] === '\\') {
          i += 2
          continue
        }
        if (code[i++] === ch) break
      }
      out += code.slice(start, i)
      continue
    }
    if (ch === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i)
      if (end < 0) {
        out += code.slice(i)
        break
      }
      out += code.slice(i, end + 1)
      i = end + 1
      continue
    }
    const m = /^([A-Z][A-Za-z0-9_]*)\s*\(/.exec(code.slice(i))
    if (!m || !NAMED_ARG_POSITIONS[m[1]]) {
      out += code[i]
      i++
      continue
    }
    const name = m[1]
    const openIdx = i + m[0].length - 1
    const closeIdx = matchParen(code, openIdx)
    if (closeIdx < 0) {
      out += code[i]
      i++
      continue
    }
    const inner = code.slice(openIdx + 1, closeIdx)
    const rawArgs = splitArgs(inner)
    // 逐个参数递归归一（嵌套调用）
    const args = rawArgs.map((a) => {
      const r = normalizeNamedArgs(a)
      if (r.changed) changed = true
      return r.code
    })
    const named = args.map((a) => {
      // 同时接受 `name = value` 与 `name: value`（模型常写 JS 对象风格的冒号参数）
      const am = /^([A-Za-z_$][\w$]*)\s*(?:=|:)(?!=|:)\s*([\s\S]+)$/.exec(a)
      return am ? { name: am[1], value: am[2].trim() } : null
    })
    let positional = args
    if (named.some(Boolean)) {
      const {
        order,
        defaults,
        kinds = [],
        optionalFlags = [],
        enums = [],
        altKinds = []
      } = NAMED_ARG_POSITIONS[name]
      const namedMap = Object.create(null)
      const rest = []
      args.forEach((a, idx) => {
        if (named[idx]) namedMap[named[idx].name] = named[idx].value
        else rest.push(a)
      })
      // 槽位分配：命名参数先就位；剩余位置参数按「严格顺序 + 语义归位」绑定
      // （模型常写 Section(title: "…", [children])，数组不能被塞进 subtitle）
      const slots = new Array(order.length).fill(undefined)
      const occupied = new Set()
      for (const [k, v] of Object.entries(namedMap)) {
        const idx = order.indexOf(k)
        if (idx < 0) continue
        const vk = argKind(v)
        const m = enumMatch(enums[idx], v)
        if (m === null) {
          // 值不属于这个槽的枚举域：先归位到同组件里值域匹配的空槽
          // （Text(weight="sm") → size="sm"），归不了位时保留原值给出可修正警告。
          let moved = false
          for (let i = 0; i < order.length; i++) {
            if (i === idx || occupied.has(i)) continue
            const mm = enumMatch(enums[i], v)
            if (mm != null) {
              slots[i] = quotedValue(mm)
              occupied.add(i)
              moved = true
              break
            }
          }
          if (moved) continue
          if (vk !== 'string' && optionalFlags[idx]) continue
          slots[idx] = v
          occupied.add(idx)
          continue
        }
        // 命名参数同样跳过「类型不可能且槽可选」的值(如 align=6)
        if (
          m == null &&
          vk !== 'any' &&
          vk !== 'null' &&
          !slotAccepts(vk, idx, kinds, altKinds) &&
          optionalFlags[idx]
        )
          continue
        slots[idx] = m != null ? quotedValue(m) : v
        occupied.add(idx)
      }
      // 只对空闲槽做绑定
      const assigned = bindArgs(kinds, rest, optionalFlags, enums, altKinds, occupied)
      assigned.forEach((v, i) => {
        if (v !== undefined && slots[i] === undefined) slots[i] = v
      })
      const built = []
      for (let k = 0; k < order.length; k++) {
        if (slots[k] !== undefined) {
          built.push(slots[k])
          continue
        }
        const d = serializeDefault(defaults[order[k]])
        if (d === null) {
          built.push(undefined)
          continue
        }
        built.push(d)
      }
      if (built.some((v) => v === undefined)) {
        out += code.slice(i, closeIdx + 1)
        i = closeIdx + 1
        continue
      }
      while (built.length > 0) {
        const lastKey = order[built.length - 1]
        if (serializeDefault(defaults[lastKey]) === built[built.length - 1]) built.pop()
        else break
      }
      positional = built
      changed = true
    }
    // 位置参数：严格顺序优先，只有类型/值域都不可能时才做语义归位；中间空槽用 null 占位
    const orderKinds = NAMED_ARG_POSITIONS[name]?.kinds ?? []
    if (orderKinds.length > 0 && named.some(Boolean) === false) {
      const byShape = bindArgs(
        orderKinds,
        positional,
        NAMED_ARG_POSITIONS[name]?.optionalFlags,
        NAMED_ARG_POSITIONS[name]?.enums,
        NAMED_ARG_POSITIONS[name]?.altKinds
      )
      let last = -1
      byShape.forEach((v, i) => {
        if (v !== undefined) last = i
      })
      if (last >= 0) {
        const shaped = byShape.slice(0, last + 1).map((v) => (v === undefined ? 'null' : v))
        if (shaped.length !== positional.length || shaped.some((v, i) => v !== positional[i]))
          changed = true
        positional = shaped
      }
    }
    // KeyValue items 速记纠正（命名与位置两条路径都在 items 槽上生效）
    const kvSlot = (NAMED_ARG_POSITIONS[name]?.order ?? []).indexOf('items')
    if (name === 'KeyValue' && kvSlot >= 0 && positional[kvSlot] !== undefined) {
      const coerced = coerceMapStyleItems(positional[kvSlot])
      if (coerced !== positional[kvSlot]) {
        positional[kvSlot] = coerced
        changed = true
      }
    }
    const wrapped = wrapChildArgs(name, positional)
    if (wrapped.length !== positional.length) changed = true
    out += `${name}(${wrapped.join(', ')})`
    i = closeIdx + 1
  }
  return { code: out, changed }
}

export function evaluateProgram(code) {
  try {
    assertSourceBudget(code)
    const source = normalizeLiterals(code)
    let result = parser.parse(source)
    // 参数兜底：模型常写 Chart(series=[...], height=280) 这类命名参数，或把
    // Text 的尺寸 token（"sm"/"lg"）写进数字槽；归一化后重排/归位再试。
    // 采用标准是「重试错误更少」，而不是「重试零错误」——原始程序常同时混有
    // 可修正写法与个别真实错误；若要求零错误才采用，一条真实错误就会把整份
    // 修正结果丢弃，退回参数错绑的原始解析。
    // 两条路径都零错误时也采用归一化结果：Text.size 这类联合值域在 lang-core
    // 里是 composite schema（不做值校验），只有归一化才能把 "sm" 放进正确槽位。
    const normalized = normalizeNamedArgs(source)
    if (normalized.changed) {
      const retry = parser.parse(normalized.code)
      const origErrs = result.meta?.errors?.length ?? 0
      const retryErrs = retry.meta?.errors?.length ?? 0
      const origRooted = Boolean(result.root || result.rootExpression)
      const retryRooted = Boolean(retry.root || retry.rootExpression)
      const preferRepaired = retryErrs === 0 && retryErrs === origErrs && retryRooted
      if (retryErrs < origErrs || (!origRooted && retryRooted) || preferRepaired) result = retry
    }
    if (!result.root && !result.rootExpression)
      return { root: null, errors: [{ message: 'empty program' }] }
    assertDataBudget(result.root ?? result.rootExpression)
    const baseCtx = { getState: () => null, resolveRef: () => undefined, functions }
    const queryDefaults = new Map()
    for (const q of result.queryStatements ?? []) {
      try {
        queryDefaults.set(
          q.statementId,
          q.defaultsAST ? evaluate(q.defaultsAST, baseCtx) : undefined
        )
      } catch {
        /* 单个 Query 默认值失败不阻塞整体渲染 */
      }
    }
    const errors = []
    const root = evaluateRoot(result, {
      ctx: { getState: () => null, resolveRef: (name) => queryDefaults.get(name), functions },
      library,
      store: null,
      errors
    })
    assertDataBudget(root)
    return { root, errors: [...(result.meta.errors ?? []), ...errors] }
  } catch (e) {
    return { root: null, errors: [{ message: e?.message ?? String(e) }] }
  }
}

/**
 * 递归渲染求值后的元素树。
 * @param {unknown} value 元素/数组/标量
 * @returns {React.ReactNode} React 节点
 */
export function renderTree(value) {
  try {
    assertDataBudget(value)
  } catch (e) {
    return <FallbackNotice>{e.message}</FallbackNotice>
  }
  return renderValue(value)
}

function renderValue(value) {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>
  }
  if (Array.isArray(value))
    return (
      <>
        {value.map((v, i) => (
          <React.Fragment key={i}>{renderValue(v)}</React.Fragment>
        ))}
      </>
    )
  if (typeof value === 'object' && value.type === 'element') {
    return (
      <RenderBoundary resetKey={value.props}>
        <SafeElement value={value} />
      </RenderBoundary>
    )
  }
  return null
}

function SafeElement({ value }) {
  const def = Object.hasOwn(library.components, value.typeName)
    ? library.components[value.typeName]
    : null
  if (!def) return <FallbackNotice>无法识别此组件</FallbackNotice>
  // Evaluator may retain null/AST props during streaming or after a field error.
  // Validate before mounting a hook-using component, also safe for SSR.
  const props = { ...value.props }
  for (const [key, field] of Object.entries(def.props.shape)) {
    // OpenUI uses null as the positional placeholder for omitted optional slots.
    if (props[key] === null && field.safeParse(undefined).success) delete props[key]
  }
  const checked = def.props.safeParse(props)
  if (!checked.success) return <FallbackNotice>{value.typeName} 数据尚不完整</FallbackNotice>
  if (
    ['Chart', 'Map', 'Diagram', 'TreeView', 'Sparkline', 'PieChart'].includes(value.typeName) &&
    ['width', 'height', 'size'].some(
      (key) =>
        typeof checked.data[key] === 'number' &&
        (checked.data[key] <= 0 || checked.data[key] > 4096)
    )
  )
    return <FallbackNotice>视图尺寸无效</FallbackNotice>
  const Comp = def.component
  return <Comp props={checked.data} renderNode={renderValue} statementId={value.statementId} />
}

function Diagnostics({ errors }) {
  const text = errors
    .slice(0, 100)
    .map((e) => displayText(e?.message ?? e).slice(0, 1000))
    .join('\n')
  const [status, copy] = useCopyText(text)
  return (
    <details
      className="dsh-iui-diagnostics"
      style={{ marginTop: 8, fontSize: FS.small, color: T.textSecondary }}
    >
      <summary>{errors.length} 个警告</summary>
      <button type="button" className="dsh-iui-btn dsh-iui-btn-ghost" onClick={copy}>
        {status}
      </button>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          maxHeight: 240,
          overflow: 'auto',
          userSelect: 'text'
        }}
      >
        {text}
      </pre>
      {errors.length > 100 && <div>仅显示前 100 项</div>}
    </details>
  )
}

/** A local last-good snapshot preserves expansion and scroll during incomplete chunks. */
export function OpenUICard({ code, streaming, evaluation, pendingFallback = null }) {
  const [streamOrigin] = React.useState(Boolean(streaming))
  const result = useMemo(() => evaluation ?? evaluateProgram(code), [code, evaluation])
  const lastGood = React.useRef(null)
  React.useEffect(() => {
    if (result.root !== null && result.errors.length === 0) lastGood.current = result
    if (!streaming) lastGood.current = null
  }, [result, streaming])
  const shown =
    streaming && (result.root === null || result.errors.length > 0) && lastGood.current
      ? lastGood.current
      : result
  const { root, errors } = shown
  if (streaming && root === null) return pendingFallback
  return (
    <div
      className="dsh-iui-card"
      data-openui=""
      data-streaming={streaming || undefined}
      data-stream-origin={streamOrigin || undefined}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        margin: 0,
        overflowX: 'auto',
        minWidth: 0
      }}
    >
      <RenderBoundary resetKey={code}>
        {root ? (
          renderTree(root)
        ) : (
          <FallbackNotice>
            OpenUI 解析失败：
            {errors
              .slice(0, 3)
              .map((e) => displayText(e.message).slice(0, 300))
              .join('；')}
          </FallbackNotice>
        )}
      </RenderBoundary>
      {!streaming && errors.length > 0 && root && <Diagnostics errors={errors} />}
    </div>
  )
}
