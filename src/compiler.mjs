/**
 * Intelligence UI 回复编译器：把结构化 Markdown 确定性地编译为 OpenUI 程序。
 *
 * 设计原则：
 * - 纯函数、零依赖、可 SSR（无 DOM/网络）
 * - 格式决策器：内容得分 ≥ 阈值才进「视觉模式」，纯文字回复原样保留
 * - 保守失败：任何解析异常都退回文字模式，绝不阻塞渲染
 * - 输出喂给与原生围栏完全相同的 parse→evaluate→render 管线（单一渲染路径）
 *
 * @module compiler
 */

// ---------- 公共类型 ----------
/** @typedef {{kind:'heading',level:number,text:string}} HeadingBlock */
/** @typedef {{kind:'table',header:string[],rows:string[][],aligns:string[]}} TableBlock */
/** @typedef {{kind:'code',lang:string,code:string}} CodeBlock */
/** @typedef {{kind:'quote',text:string}} QuoteBlock */
/** @typedef {{kind:'olist',items:string[]}} OListBlock */
/** @typedef {{kind:'ulist',items:string[]}} UListBlock */
/** @typedef {{kind:'hr'}} HrBlock */
/** @typedef {{kind:'para',text:string}} ParaBlock */

// ---------- 常量 ----------
/** 视觉模式分数阈值。 */
const VISUAL_THRESHOLD = 5
/** 最大输入长度（超过直接文字模式，防病态长文）。 */
const MAX_INPUT = 6000
/** 最大语句数（超过退回文字模式）。 */
const MAX_STATEMENTS = 40

const NUM_RE =
  /^[+-]?[\d,，]+(?:\.\d+)?\s*(?:%|万|亿|k|K|M|B|元|次|人|单|个|分|秒|时|小时|天|张|条|篇|台|件|位)?$/
const MONEY_RE = /^[+-]?(?:¥|￥|＄|\$|€)\s?[\d,，]+(?:\.\d+)?(?:万|亿)?(?:元)?$/
const PERCENT_RE = /^[+-]?\d+(?:\.\d+)?\s*%$/
const STATUS_WORDS =
  /^(ok|okay|success|succeeded|done|passed|pass|healthy|active|online|running|pending|warn|warning|degraded|slow|fail|failed|failure|error|down|offline|正常|成功|完成|通过|健康|在线|运行中|进行中|等待|待定|警告|降级|缓慢|失败|异常|错误|离线|已上线|已下线)$/i
const STATUS_HEADER_RE = /状态|status|结果|健康|health|进度/i
const TIME_LABEL_RE =
  /^(一|二|三|四|五|六|七|八|九|十|周一|周二|周三|周四|周五|周六|周日|星期[一二三四五六日]|Q[1-4]|周|月|年|\d{1,4}[/\-年月日:]\d{0,2}[/\-年月日:]?\d{0,2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i

// ---------- 基础工具 ----------
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')

/** 数字字符串 → number（去千分位/全角逗号）；不可解析返回 null。 */
function toNumber(raw) {
  const s = String(raw).trim()
  if (!NUM_RE.test(s) && !MONEY_RE.test(s) && !PERCENT_RE.test(s)) return null
  const m = s.replace(/[¥￥＄$€%\s]/g, '').replace(/，/g, ',')
  let v = parseFloat(m.replace(/,/g, ''))
  if (Number.isNaN(v)) return null
  if (/万$/.test(m)) v *= 1e4
  else if (/亿$/.test(m)) v *= 1e8
  else if (/[Kk]$/.test(m)) v *= 1e3
  else if (/B$/.test(m)) v *= 1e9
  if (!Number.isFinite(v)) throw new Error('Non-finite table number')
  return v
}

const isNumericCell = (raw) => {
  const s = String(raw ?? '').trim()
  if (s === '') return true // 空单元格不算破坏数值性
  return toNumber(s) !== null
}

/** 行内 Markdown 剥离（bold/em/code/link → 纯文本）。 */
const stripInline = (s) =>
  s
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

// ---------- 块级解析 ----------
/**
 * 把 Markdown 文本切成块序列。
 * @param {string} text
 * @returns {Array<HeadingBlock|TableBlock|CodeBlock|QuoteBlock|OListBlock|UListBlock|HrBlock|ParaBlock>}
 */
export function parseBlocks(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let i = 0
  const isBlank = (l) => l.trim() === ''
  const isBullet = (l) => /^\s{0,3}[-*+]\s+/.test(l)
  const isOItem = (l) => /^\s{0,3}\d{1,3}[.、)]\s+/.test(l)
  const isQuote = (l) => /^ {0,3}>/.test(l)
  const isTableLine = (l) => /^\s*\|.*\|\s*$/.test(l) || /^\s*\|/.test(l)
  const isTableSep = (l) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes('-')

  while (i < lines.length) {
    const line = lines[i]
    if (isBlank(line)) {
      i++
      continue
    }

    // 围栏代码
    const fence = line.match(/^\s{0,3}```([\w+-]*)\s*$/)
    if (fence) {
      const lang = fence[1] ?? ''
      const body = []
      i++
      while (i < lines.length && !/^\s{0,3}```\s*$/.test(lines[i])) {
        body.push(lines[i])
        i++
      }
      if (i >= lines.length) throw new Error('Unclosed code fence')
      i++ // 跳过闭合
      blocks.push({ kind: 'code', lang, code: body.join('\n') })
      continue
    }
    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      blocks.push({ kind: 'heading', level: h[1].length, text: stripInline(h[2]).trim() })
      i++
      continue
    }
    // 水平线（非表格分隔行）
    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }
    // 表格：当前行是表格线且下一行是分隔行
    if (isTableLine(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const parseRow = (l) =>
        l
          .replace(/^\s*\|/, '')
          .replace(/\|\s*$/, '')
          .split(/(?<!\\)\|/)
          .map((c) => c.trim().replace(/\\\|/g, '|'))
      const header = parseRow(line).map(stripInline)
      const separators = parseRow(lines[i + 1])
      if (
        header.some((h) => !h) ||
        new Set(header).size !== header.length ||
        separators.length !== header.length ||
        separators.some((c) => !/^:?-{3,}:?$/.test(c))
      )
        throw new Error('Malformed table')
      const aligns = separators.map((c) =>
        c.startsWith(':') && c.endsWith(':')
          ? 'center'
          : c.endsWith(':')
            ? 'right'
            : c.startsWith(':')
              ? 'left'
              : ''
      )
      i += 2
      const rows = []
      while (i < lines.length && isTableLine(lines[i]) && !isBlank(lines[i])) {
        const row = parseRow(lines[i]).map(stripInline)
        if (row.length !== header.length) throw new Error('Uneven table row')
        rows.push(row)
        i++
      }
      blocks.push({ kind: 'table', header, rows, aligns })
      continue
    }
    // 引用块
    if (isQuote(line)) {
      const body = []
      while (
        i < lines.length &&
        (isQuote(lines[i]) ||
          (!isBlank(lines[i]) &&
            body.length > 0 &&
            !/^\s{0,3}#{1,6}\s/.test(lines[i]) &&
            !isBullet(lines[i]) &&
            !isTableLine(lines[i])))
      ) {
        body.push(lines[i].replace(/^ {0,3}>\s?/, ''))
        i++
      }
      blocks.push({ kind: 'quote', text: body.join('\n').trim() })
      continue
    }
    // 无序列表
    if (isBullet(line)) {
      const items = []
      while (
        i < lines.length &&
        (isBullet(lines[i]) ||
          (items.length > 0 && /^\s{2,}\S/.test(lines[i]) && !isBlank(lines[i])))
      ) {
        if (isBullet(lines[i])) items.push(lines[i].replace(/^\s{0,3}[-*+]\s+/, ''))
        else items[items.length - 1] += ' ' + lines[i].trim()
        i++
      }
      blocks.push({ kind: 'ulist', items })
      continue
    }
    // 有序列表
    if (isOItem(line)) {
      const items = []
      while (
        i < lines.length &&
        (isOItem(lines[i]) ||
          (items.length > 0 && /^\s{2,}\S/.test(lines[i]) && !isBlank(lines[i])))
      ) {
        if (isOItem(lines[i])) items.push(lines[i].replace(/^\s{0,3}\d{1,3}[.、)]\s+/, ''))
        else items[items.length - 1] += ' ' + lines[i].trim()
        i++
      }
      blocks.push({ kind: 'olist', items })
      continue
    }
    // 段落：到空行或下一个块起始
    const para = []
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !/^\s{0,3}```/.test(lines[i]) &&
      !/^ {0,3}#{1,6}\s/.test(lines[i]) &&
      !isBullet(lines[i]) &&
      !isOItem(lines[i]) &&
      !isQuote(lines[i]) &&
      !(isTableLine(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i])
      i++
    }
    if (para.length === 0) {
      i++
      continue
    } // 防御：不应到达
    blocks.push({ kind: 'para', text: para.join('\n').trim() })
  }
  return blocks
}

// ---------- KPI / 键值识别 ----------
/**
 * 识别 KPI 项：`标签 数值（增量）` 形态。
 * @returns {{label:string, value:string, delta?:string, trend?:'up'|'down'|'flat'} | null}
 */
export function parseKpi(raw) {
  const s = stripInline(String(raw)).trim()
  if (s === '' || s.length > 80) return null
  // 拆出括号里的增量：(+12.3%) / （-0.3%）/ (+1,204)
  let delta = null
  let trend = 'flat'
  let body = s
  const dm = s.match(/[（(]\s*([+-±↑↓]?)\s*([+-]?[\d,，.]+)\s*%?\s*[）)]/)
  if (dm) {
    const signChar = dm[1]
    const signed = /^[+-]/.test(dm[2])
    const neg = signChar === '-' || signChar === '↓' || (signed && dm[2].startsWith('-'))
    const pos = signChar === '+' || signChar === '↑' || (signed && dm[2].startsWith('+'))
    delta =
      (pos ? '+' : neg ? '-' : '') +
      dm[2].replace(/^[+-]/, '') +
      (s.slice(dm.index).includes('%') ? '%' : '')
    trend = neg ? 'down' : pos ? 'up' : 'flat'
    body = (s.slice(0, dm.index) + s.slice(dm.index + dm[0].length)).trim()
  }
  // 主体 = 标签 + 数值
  const vm = body.match(
    /((?:¥|￥|＄|\$|€)\s?)?([\d,，]+(?:\.\d+)?)\s*(%|万|亿|K|M|B|元|次|人|单|个|分|秒|小时|天|张|条|篇|台|件|位)?\s*$/
  )
  if (!vm) return null
  const label = stripInline(body.slice(0, vm.index))
    .replace(/[：:—\-–\s]+$/, '')
    .trim()
  if (label === '' || label.length > 24) return null
  const value = (vm[1] ?? '') + vm[2] + (vm[3] ?? '')
  if (toNumber(value) === null) return null
  return { label, value, delta, trend }
}

/** 识别纯键值对项（无数字）：`标签：值`。 */
function parseKv(raw) {
  const s = stripInline(String(raw)).trim()
  const m = s.match(/^([^：:]{1,16})[：:]\s*(.{1,60})$/)
  if (!m) return null
  return { label: m[1].trim(), value: m[2].trim() }
}

// ---------- 表格分析 ----------
/** 推断列规格与图表潜力。 */
function analyzeTable(tbl) {
  const nCols = tbl.header.length
  const colKind = [] // 'label' | 'num' | 'text'
  const colFormat = []
  for (let c = 0; c < nCols; c++) {
    const vals = tbl.rows.map((r) => r[c] ?? '')
    const nonEmpty = vals.filter((v) => String(v).trim() !== '')
    const allNum = nonEmpty.length > 0 && nonEmpty.every(isNumericCell)
    if (allNum) {
      colKind.push('num')
      const allPct = nonEmpty.every((v) => PERCENT_RE.test(String(v).trim()))
      const allMoney = nonEmpty.every((v) => MONEY_RE.test(String(v).trim()))
      const maxAbs = Math.max(...nonEmpty.map((v) => Math.abs(toNumber(v) ?? 0)))
      colFormat.push(
        allPct ? 'percent' : allMoney ? 'currency' : maxAbs >= 10000 ? 'compact' : 'number'
      )
    } else {
      colKind.push(nonEmpty.some((v) => STATUS_WORDS.test(String(v).trim())) ? 'status' : 'text')
      colFormat.push('text')
    }
  }
  // 图表潜力：恰好 1 个 label 列 + 1~3 个 num 列，行数 3~14
  const labelCols = colKind
    .map((k, i) => [k, i])
    .filter(([k]) => k === 'text')
    .map(([, i]) => i)
  const numCols = colKind
    .map((k, i) => [k, i])
    .filter(([k]) => k === 'num')
    .map(([, i]) => i)
  const labelCol = labelCols.length >= 1 ? labelCols[0] : -1
  let chart = null
  if (
    labelCol >= 0 &&
    numCols.length >= 1 &&
    numCols.length <= 3 &&
    tbl.rows.length >= 3 &&
    tbl.rows.length <= 14 &&
    tbl.rows.every((r) => numCols.every((c) => toNumber(String(r[c] ?? '')) !== null))
  ) {
    const labels = tbl.rows.map((r) => String(r[labelCol] ?? '').trim())
    const series = numCols.map((c) => ({
      name: String(tbl.header[c] ?? ''),
      values: tbl.rows.map((r) => toNumber(String(r[c] ?? '')) ?? 0)
    }))
    const looksTime =
      labels.filter((l) => TIME_LABEL_RE.test(l)).length >= Math.ceil(labels.length * 0.6)
    chart = { labels, series, type: looksTime || series.length > 1 ? 'line' : 'bar' }
  }
  return { colKind, colFormat, chart }
}

// ---------- 编译主入口 ----------
/**
 * 编译一条回复：决定形态并（视觉模式时）产出 OpenUI 程序文本。
 *
 * @param {string} text 助手回复 Markdown（不含 openui 围栏）
 * @returns {{mode:'text'|'visual', program?:string, score:number, stats:Record<string,number>}}
 */
export function compileReply(text) {
  try {
    const raw = String(text ?? '')
    if (raw.trim() === '' || raw.length > MAX_INPUT) return { mode: 'text', score: 0, stats: {} }

    if (
      raw
        .split(/\r?\n/)
        .some((line) => line.length > 2000 || /^(?: {2,}|\t)(?:[-*+]|\d+[.)、])\s/.test(line))
    )
      return { mode: 'text', score: 0, stats: {} }
    const blocks = parseBlocks(raw)
    if (blocks.length === 0) return { mode: 'text', score: 0, stats: {} }

    // ---- 逐块分析与计分 ----
    let score = 0
    const stats = {
      tables: 0,
      kpis: 0,
      steps: 0,
      bullets: 0,
      kv: 0,
      headings: 0,
      code: 0,
      quotes: 0
    }
    const analyzed = blocks.map((b) => {
      if (b.kind === 'table') {
        stats.tables++
        const a = analyzeTable(b)
        score += Math.min(10, 5 + (a.chart ? 2 : 0))
        return { block: b, ...a }
      }
      if (b.kind === 'ulist') {
        const kpis = b.items.map(parseKpi).filter(Boolean)
        if (kpis.length >= 2 && kpis.length >= b.items.length * 0.7) {
          stats.kpis += kpis.length
          score += Math.min(6, 5 + (kpis.length - 2) * 0.5)
          return { block: b, kpis }
        }
        const kvs = b.items.map(parseKv).filter(Boolean)
        if (kvs.length >= 3 && kvs.length >= b.items.length * 0.8) {
          stats.kv += kvs.length
          score += 2
          return { block: b, kvs }
        }
        stats.bullets += b.items.length
        score += Math.min(3, b.items.length * 0.8)
        return { block: b }
      }
      if (b.kind === 'olist') {
        if (
          b.items.length >= 2 &&
          b.items.length <= 7 &&
          b.items.every((it) => stripInline(it).length <= 48)
        ) {
          stats.steps += b.items.length
          score += 5
          return { block: b, asSteps: true }
        }
        stats.bullets += b.items.length
        score += Math.min(3, b.items.length * 0.8)
        return { block: b }
      }
      if (b.kind === 'heading') {
        stats.headings++
        if (stats.headings >= 2) score += 1
        return { block: b }
      }
      if (b.kind === 'code') {
        stats.code++
        score += 0.5
        return { block: b }
      }
      if (b.kind === 'quote') {
        stats.quotes++
        score += 0.5
        return { block: b }
      }
      return { block: b }
    })

    if (score < VISUAL_THRESHOLD) return { mode: 'text', score, stats }

    // ---- 视觉模式：发射 OpenUI 程序 ----
    const stmts = []
    const rootChildren = []
    let n = 0
    const fresh = (p) => `v${++n}`
    const push = (expr, toRoot = true) => {
      const id = fresh()
      stmts.push(`${id} = ${expr}`)
      if (toRoot) rootChildren.push(id)
      return id
    }

    for (const a of analyzed) {
      const b = a.block
      if (b.kind === 'heading') {
        push(`Heading("${esc(b.text)}", ${b.level <= 2 ? 2 : 3})`)
      } else if (b.kind === 'hr') {
        push('Divider()')
      } else if (b.kind === 'para') {
        for (const t of paraTexts(b.text)) push(`TextContent("${t}", "md")`)
      } else if (b.kind === 'code') {
        push(`CodeBlock("${esc(b.code)}"${b.lang ? `, "${esc(b.lang)}"` : ''})`)
      } else if (b.kind === 'quote') {
        const m = b.text.match(/^\[!(warning|caution|note|tip|danger)\]\s*/i)
        const variant = m
          ? { warning: 'warning', caution: 'warning', danger: 'error', note: 'info', tip: 'info' }[
              m[1].toLowerCase()
            ]
          : null
        const body = stripInline((m ? b.text.slice(m[0].length) : b.text).split('\n')[0] ?? '')
        if (variant) push(`Callout(null, "${esc(body)}", "${variant}")`)
        else push(`Quote("${esc(body)}")`)
      } else if (b.kind === 'table') {
        if (a.chart) {
          const labels = `[${a.chart.labels.map((l) => `"${esc(l)}"`).join(', ')}]`
          const series = `[${a.chart.series.map((s) => `{name: "${esc(s.name)}", values: [${s.values.map((v) => String(v)).join(', ')}]}`).join(', ')}]`
          push(
            `Chart(null, "${a.chart.type}", ${series}, [], ${labels}, 200, "compact", true, true, false)`
          )
        }
        const header = `[${b.header.map((h) => `"${esc(h)}"`).join(', ')}]`
        const specs = a.colKind
          .map((k, c) => {
            if (k === 'num') return `{key: "${esc(b.header[c])}", format: "${a.colFormat[c]}"}`
            if (k === 'status' || STATUS_HEADER_RE.test(b.header[c] ?? ''))
              return `{key: "${esc(b.header[c])}", status: true}`
            return null
          })
          .filter(Boolean)
        const specList = specs.length > 0 ? `[${specs.join(', ')}]` : '[]'
        const dataArg = `[${b.rows
          .slice(0, 60)
          .map(
            (r) =>
              `{${b.header
                .map((h, c) => {
                  const cell = String(r[c] ?? '').trim()
                  const num = a.colKind[c] === 'num' && cell !== '' ? toNumber(cell) : null
                  return `"${esc(h)}": ${num !== null ? String(num) : `"${esc(cell)}"`}`
                })
                .join(', ')}}`
          )
          .join(', ')}]`
        // SearchTable(title, columns, data, searchPlaceholder, emptyText, compact, columnSpecs)
        // Table(title, columns, data, compact, sortable, striped, columnSpecs, highlightRow)
        if (b.rows.length >= 7) {
          push(
            `SearchTable(null, ${header}, ${dataArg}, "搜索…", "没有匹配的记录", true, ${specList})`
          )
        } else {
          push(`Table(null, ${header}, ${dataArg}, false, true, true, ${specList})`)
        }
      } else if (b.kind === 'ulist' && a.kpis) {
        const cards = a.kpis
          .slice(0, 6)
          .map(
            (k) =>
              `StatCard("${esc(k.label)}", "${esc(k.value)}"${k.delta ? `, "${esc(k.delta)}", "${k.trend}"` : ''})`
          )
        if (cards.length >= 2)
          push(`Grid([${cards.join(', ')}], ${Math.min(cards.length, 3)}, 12, 150)`)
        else push(cards[0])
      } else if (b.kind === 'ulist' && a.kvs) {
        const items = a.kvs
          .slice(0, 12)
          .map((kv) => `{label: "${esc(kv.label)}", value: "${esc(kv.value)}"}`)
        push(`KeyValue([${items.join(', ')}], 2)`)
      } else if (b.kind === 'ulist') {
        const items = b.items
          .slice(0, 20)
          .map((it) => `"${esc(stripInline(it).replace(/^\s*/, ''))}"`)
        push(`BulletList([${items.join(', ')}])`)
      } else if (b.kind === 'olist') {
        const items = b.items.slice(0, 20).map((it) => `"${esc(stripInline(it))}"`)
        if (a.asSteps) push(`Steps([${items.join(', ')}])`)
        else push(`BulletList([${items.join(', ')}], true)`)
      }
    }

    if (rootChildren.length === 0) return { mode: 'text', score, stats }
    stmts.push(`root = Stack([${rootChildren.join(', ')}], "column", 12)`)
    if (stmts.length > MAX_STATEMENTS) return { mode: 'text', score, stats }
    return { mode: 'visual', program: stmts.join('\n'), score, stats }
  } catch {
    return { mode: 'text', score: 0, stats: {} }
  }
}

/** 段落 → TextContent 字符串列表（行内剥离 + 长段落按句切分）。 */
function paraTexts(md) {
  const cleaned = stripInline(md)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '· ')
    .trim()
  if (cleaned === '') return []
  const out = []
  for (const para of cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)) {
    const escaped = esc(para.replace(/\n/g, ' '))
    if (escaped.length > 260) {
      let buf = ''
      for (const s of escaped.split(/(?<=[。！？.!?])\s*/).filter(Boolean)) {
        if ((buf + s).length > 260 && buf !== '') {
          out.push(buf)
          buf = s
        } else buf += s
      }
      if (buf !== '') out.push(buf)
    } else out.push(escaped)
  }
  return out
}
