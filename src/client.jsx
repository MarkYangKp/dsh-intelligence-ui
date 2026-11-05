// Intelligence UI × DSH 聊天插件 —— 浏览器半边。
// Registers the assistant-step renderer at priority -20 (the host default is 0 and
// earlier OpenUI plugins used -10; lower numbers win, so this plugin takes over).
// 文本块走「回复管线」：
//   1) 含 ```openui 围栏 → 原生渲染（模型 authored，质量最高）
//   2) 无围栏且已定稿 → 编译器把结构化 Markdown 自动编译为 OpenUI 程序
//      （表格/指标/步骤 → 卡片、图表、搜索表格）
//   3) 纯文字 → 与官方完全一致的 Markdown 渲染
// 其余逻辑忠实移植自 ui-chat 的 AssistantNodeView / AssistantMarkdown / ReasoningRow。
import React, { memo, useCallback, useMemo, Fragment } from 'react'
import {
  MarkdownText,
  DisclosureRow,
  TextShimmer,
  IconThinkOutlineRegular,
  JsonBlock
} from '@deepseek-ai/dsh-client-ui-primitives'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { OpenUICard, evaluateProgram } from './openui-runtime.jsx'
import { compileReply } from './compiler.mjs'
import { RenderBoundary, FallbackNotice } from './render-safety.jsx'

/** 插件版本标记（排障用：页面控制台应打印本行）。 */
export const IUI_VERSION = 'dsh-intelligence-ui/1.1.1'

/** 自动编译开关：localStorage['dsh-intelligence-ui:disable-auto']='1' 可紧急关闭。 */
function autoCompileEnabled() {
  try {
    return (
      typeof localStorage === 'undefined' ||
      localStorage.getItem('dsh-intelligence-ui:disable-auto') !== '1'
    )
  } catch {
    return true
  }
}

// ---------- 样式（注入一次；对照 ui-chat 官方 CSS Modules 移植，类名加前缀） ----------
export const PLUGIN_CSS = `
.dsh-iui-root{display:flex;flex-direction:column;font-size:var(--dsh-content-font-size,14px);
line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-primary)}
.dsh-iui-body{display:flex;flex-direction:column;gap:16px}
.dsh-iui-stopped{align-self:flex-start;padding:0 6px;border-radius:var(--dsw-radius-sm);
background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);
font-size:11px;line-height:18px}
.dsh-iui-reasoning{display:flex;flex-direction:column}
.dsh-iui-reasoning:not([data-expanded]){contain:size layout;height:calc(24px + var(--dsh-content-font-delta,0px))}
.dsh-iui-reasoning [data-disclosure-header]{overflow:hidden}
.dsh-iui-reasoning[data-expanded] [data-open] [data-disclosure-header]{position:sticky;top:0;z-index:1;
background:var(--dsw-alias-bg-base)}
.dsh-iui-sep{flex:none;width:2px;height:2px;margin:0 8px;border-radius:1px;
background:var(--dsw-alias-label-caption)}
.dsh-iui-summary{min-width:0;overflow:hidden;flex:1 1 auto;
font-size:var(--dsh-content-font-size-secondary,13px);
line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));white-space:nowrap}
.dsh-iui-summary-text{display:block;overflow:hidden;text-overflow:ellipsis}
.dsh-iui-summary[data-streaming]{mask-image:linear-gradient(to right,black calc(100% - 48px),transparent)}
.dsh-iui-summary[data-streaming] .dsh-iui-summary-text{overflow:visible;text-overflow:clip}
.dsh-iui-reasoning:not([data-preview]) .dsh-iui-sep,
.dsh-iui-reasoning:not([data-preview]) .dsh-iui-summary{display:none}
.dsh-iui-think-body{padding:4px 0 4px calc(22px + var(--dsh-content-font-delta,0px));min-width:0}

/* ---------- Intelligence UI 动效与交互层（v3 Precision Editorial） ---------- */
/* 卡片入场：一次 6px 上浮 + 淡入，不做整块动画的堆叠 */
@keyframes dsh-iui-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes dsh-iui-fade{from{opacity:0}to{opacity:1}}
.dsh-iui-card{animation:dsh-iui-rise .3s cubic-bezier(.2,.7,.2,1) both}
/* 流式输出时不做入场动画，避免每帧重启 */
.dsh-iui-card[data-streaming],.dsh-iui-card[data-stream-origin]{animation:none}
/* 与聊天正文同一套字体/字号语言：正文跟随 DSH 正文字号设置 */
.dsh-iui-card{
  font-family:var(--dsw-font-family,inherit);
  font-size:var(--dsh-content-font-size,14px);
  line-height:calc(24px + var(--dsh-content-font-delta,0px));
  color:var(--dsw-alias-label-primary);
  -webkit-font-smoothing:antialiased;
}
.dsh-iui-card :is(button,input,summary,th[tabindex],a){
  transition:background-color .16s ease,color .16s ease,border-color .16s ease;
  outline-offset:3px;
}
.dsh-iui-card button,.dsh-iui-card input,.dsh-iui-card summary{font-family:inherit}
/* 悬停反馈统一走 interactive token；主按钮用按钮自己的 hover 色 */
.dsh-iui-card :is(button,summary,th[tabindex]):hover{background-color:var(--dsw-alias-interactive-bg-hover)!important}
.dsh-iui-card .dsh-iui-btn-primary:hover{background-color:var(--dsw-alias-button-primary-hover)!important}
.dsh-iui-card .dsh-iui-btn-ghost:hover{background-color:var(--dsw-alias-interactive-bg-hover)!important}
.dsh-iui-card :is(button,summary,th[tabindex]):active{background-color:var(--dsw-alias-interactive-bg-active)!important}
/* 焦点环：DSH 业务蓝，保持键盘可达与统一几何 */
.dsh-iui-card :is(button,input,summary,th[tabindex],a,details):focus-visible{
  outline:2px solid var(--dsw-alias-state-business-primary)!important;
  outline-offset:3px;
}
.dsh-iui-card ::selection{background:var(--dsw-alias-bg-document-selection)}
/* 展开/收起：低视觉权重，悬停才显形 */
.dsh-iui-expand:hover{background-color:var(--dsw-alias-interactive-bg-hover-solid)!important;color:var(--dsw-alias-label-secondary)!important}
/* 表格：行悬停 + 数字对齐；表头不可选、单元格可选中复制 */
.dsh-iui-table tbody tr:hover td{background:var(--dsw-alias-interactive-bg-hover)!important}
.dsh-iui-table td{transition:background-color .16s ease;user-select:text}
.dsh-iui-table tfoot td{font-variant-numeric:tabular-nums}
/* 内部滚动条收细，避免长代码/宽表格出现粗重滚动条 */
.dsh-iui-card :is([data-scroll],[style*="overflow"]):not(textarea)::-webkit-scrollbar{width:5px;height:5px}
.dsh-iui-card :is([data-scroll],[style*="overflow"]):not(textarea)::-webkit-scrollbar-thumb{
  background:color-mix(in srgb, var(--dsw-alias-label-tertiary) 45%, transparent);
  border-radius:999px;
}
.dsh-iui-card :is([data-scroll],[style*="overflow"]):not(textarea)::-webkit-scrollbar-track{background:transparent}
/* 诊断面板与降级提示：与主界面同一表面语言 */
.dsh-iui-diagnostics{
  padding:10px 14px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-markdown-code-block);
  font-size:var(--dsh-content-font-size-secondary,13px);color:var(--dsw-alias-label-secondary);
}
.dsh-iui-diagnostics summary{cursor:pointer;padding:2px 0;color:var(--dsw-alias-label-tertiary)}
.dsh-iui-diagnostics button{
  margin-top:8px;padding:4px 10px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-secondary);font-size:11px;cursor:pointer;
}
.dsh-iui-diagnostics pre{
  font-family:var(--ds-font-family-code,var(--dsh-font-family-code,ui-monospace,monospace));
  font-size:var(--dsh-code-font-size,11px);margin:8px 0 0;
}
.dsh-iui-notice{background:var(--dsw-alias-markdown-code-block);line-height:1.6;border-radius:var(--dsw-radius-sm,8px)}
.dsh-iui-collapse{transition:grid-template-rows .2s ease,visibility .2s ease}
@media (prefers-reduced-motion: reduce){
  .dsh-iui-card,.dsh-iui-card *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
}

`
if (
  typeof document !== 'undefined' &&
  document.querySelector('style[data-plugin-css="dsh-intelligence-ui/styles.css"]') === null
) {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-intelligence-ui'
  tag.dataset.pluginCss = 'dsh-intelligence-ui/styles.css'
  tag.textContent = PLUGIN_CSS
  document.head.appendChild(tag)
}

// ---------- locale 辅助（对照 ui-chat markdown-labels.ts；key 未命中时回退英文） ----------
/**
 * 安全取文案：t(key, params?) 返回 key 本身表示未命中（回退到调用方给的英文兜底）。
 * @param {Function} t 框架注入的 locale seat
 * @param {string} key 文案键
 * @param {string} fallback 未命中时的英文兜底
 * @param {Record<string, unknown>} [params] 插值参数（如 { total }）
 * @returns {string}
 */
function tr(t, key, fallback, params) {
  try {
    const value = t(key, params)
    return value === key ? fallback : value
  } catch {
    return fallback
  }
}

function markdownLabels(t) {
  return {
    code: {
      copyLabel: tr(t, 'copy', 'Copy'),
      copiedLabel: tr(t, 'copied', 'Copied'),
      toolbarLabels: {
        codeLabel: tr(t, 'codeBlock.title', 'Code'),
        wrapLabel: tr(t, 'codeBlock.wrap', 'Wrap'),
        unwrapLabel: tr(t, 'codeBlock.unwrap', 'Unwrap')
      }
    },
    footnotes: tr(t, 'markdown.footnotes', 'Footnotes')
  }
}

// ---------- ```openui 围栏切分 ----------
// Scan top-level Markdown fences. Longer outer fences protect embedded examples.
function scanFences(text) {
  const re = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)\r?$/gm
  const fences = []
  let open = null,
    m
  while ((m = re.exec(text)) !== null) {
    if (!open) {
      open = {
        start: m.index,
        body: re.lastIndex + (text[re.lastIndex] === '\n' ? 1 : 0),
        marker: m[1],
        lang: m[2].trim().toLowerCase()
      }
    } else if (
      m[1][0] === open.marker[0] &&
      m[1].length >= open.marker.length &&
      m[2].trim() === ''
    ) {
      const end = re.lastIndex + (text[re.lastIndex] === '\n' ? 1 : 0)
      fences.push({ ...open, end, code: text.slice(open.body, m.index), streaming: false })
      open = null
      if (fences.length >= 100) break // caller preserves the unprocessed tail as Markdown
    }
  }
  if (open) fences.push({ ...open, end: text.length, code: text.slice(open.body), streaming: true })
  return fences
}

export function splitOpenUIFences(text) {
  const parts = []
  let last = 0
  for (const fence of scanFences(text)) {
    if (fence.lang !== 'openui') continue
    const before = text.slice(last, fence.start)
    if (before.trim()) parts.push({ kind: 'md', text: before })
    parts.push({ kind: 'openui', code: fence.code, streaming: fence.streaming })
    last = fence.end
  }
  const tail = text.slice(last)
  if (tail.trim()) parts.push({ kind: 'md', text: tail })
  return parts
}

/**
 * 把围栏外的 Markdown 文字转成 OpenUI 的 Text 组件调用，让文字也进入 UI 内部渲染。
 *
 * 目的：整条回复由一个 OpenUI 程序承载，外面不再散落 Markdown 段落。
 * 规则：按空行分段；轻量剥离行内标记；过长段落按句切分保持可读。
 *
 * @param {string} md 围栏外的 Markdown 文本
 * @returns {string[]} OpenUI Text 组件调用表达式列表
 */
export function markdownToOpenUITexts(md) {
  const cleaned = md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '· ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()

  if (cleaned === '') return []

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  const out = []
  for (const para of paragraphs) {
    const escaped = para.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
    if (escaped.length > 260) {
      const sentences = escaped.split(/(?<=[。！？.!?])\s*/).filter(Boolean)
      let buf = ''
      for (const s of sentences) {
        if ((buf + s).length > 260 && buf !== '') {
          out.push(buf)
          buf = s
        } else {
          buf += s
        }
      }
      if (buf !== '') out.push(buf)
    } else {
      out.push(escaped)
    }
  }
  return out
}

// ---------- ReasoningRow（移植版） ----------
const THINK_ICON = <IconThinkOutlineRegular size={14} />

function firstLine(text) {
  const newline = text.indexOf('\n')
  return newline === -1 ? text : text.slice(0, newline)
}

function latestCompletedParagraphFirstLine(text) {
  let summary = ''
  let paragraphStart = 0
  const separator = /\r?\n(?:[\t ]*\r?\n)+/g
  for (;;) {
    const nextParagraph = separator.exec(text)
    const paragraphEnd =
      nextParagraph === null ? text.length : nextParagraph.index + nextParagraph[0].indexOf('\n')
    const newline = text.indexOf('\n', paragraphStart)
    if (newline !== -1 && newline <= paragraphEnd) {
      const candidate = text.slice(paragraphStart, newline).trim()
      if (candidate !== '') summary = candidate
    }
    if (nextParagraph === null) return summary
    paragraphStart = nextParagraph.index + nextParagraph[0].length
  }
}

/**
 * 剥离私有签名字段：DSH 会把 <signature>…</signature> 包在推论文本前，
 * 那部分不应展示。移植自宿主的 reasoningText()（0.2.1-rc.5）。
 * @param {string} text 原始推理文本
 * @returns {string} 可展示文本；仅剩签名时为空串
 */
function reasoningText(text) {
  if (typeof text !== 'string' || text[0] !== '<') return typeof text === 'string' ? text : ''
  const opening = '<signature>'
  if (opening.startsWith(text)) return ''
  if (!text.startsWith(opening)) return text
  const end = text.indexOf('</signature>', 11)
  if (end === -1) return ''
  let start = end + 12
  while (start < text.length) {
    if (text[start] === '\n') start++
    else if (text[start] === '\r' && text[start + 1] === '\n') start += 2
    else break
  }
  return text.slice(start)
}

/** 推理披露行：可展开，展开体优先走宿主推理内容 Factory，宿主不提供时本地渲染。 */
const ReasoningRow = memo(function ReasoningRow({
  text: rawText,
  running,
  usePresentation,
  useDisclosure,
  renderReasoningBody,
  labels,
  t
}) {
  const { expanded, toggle } = useDisclosure()
  const { text, hidden } = useMemo(() => {
    const normalized = reasoningText(rawText)
    return { text: normalized, hidden: normalized !== rawText && normalized.trim() === '' }
  }, [rawText])
  const summaryText = running ? latestCompletedParagraphFirstLine(text) : firstLine(text)
  const summary = useMemo(() => summaryText.replaceAll('**', ''), [summaryText])
  const preview = usePresentation(
    (policy) => !expanded && summary !== '' && (running || policy.settledReasoningPreview)
  )
  const collapsedContent = useMemo(
    () => (
      <>
        <span className="dsh-iui-sep" data-shimmer-decoration aria-hidden />
        <span className="dsh-iui-summary" data-streaming={running || undefined}>
          <span className="dsh-iui-summary-text">
            <TextShimmer>{summary}</TextShimmer>
          </span>
        </span>
      </>
    ),
    [running, summary]
  )
  const content = useMemo(
    () =>
      expanded ? (
        <div className="dsh-iui-think-body">{renderReasoningBody({ text, running, labels })}</div>
      ) : undefined,
    [expanded, labels, renderReasoningBody, running, text]
  )
  if (hidden) return null
  return (
    <div
      className="dsh-iui-reasoning"
      data-variant="think"
      data-state={running ? 'running' : 'ok'}
      data-expanded={expanded || undefined}
      data-preview={preview || undefined}
    >
      {running && <span className="dsh-visually-hidden">{tr(t, 'row.running', 'Running')}</span>}
      <DisclosureRow
        icon={THINK_ICON}
        title={tr(t, 'message.think', 'Think')}
        running={running}
        open={expanded}
        expandable
        expandOnRowClick
        onToggle={toggle}
        collapsedContent={collapsedContent}
      >
        {content}
      </DisclosureRow>
    </div>
  )
})

// ---------- Assistant 渲染主体（移植 + openui 拦截） ----------
const NOOP = () => {}

function ProcessReasoning({ hidden, reveal, useGroupAction, children }) {
  const ref = useGroupAction(hidden, reveal ?? NOOP)
  return (
    <div ref={ref} data-turn-process-inline={hidden || undefined}>
      {children}
    </div>
  )
}

/**
 * 抢救普通代码块：模型有时把程序写进 ``` 或 ```js（而非 ```openui）。
 * 内容以 `root =` 开头且能被解析时，按 OpenUI 渲染；否则保持原样。
 * @param {string} text 文本块
 * @returns {Array<{kind:'md',text:string}|{kind:'program',code:string}> | null}
 */
export function splitRecoverablePrograms(text) {
  const parts = []
  let last = 0
  for (const fence of scanFences(text)) {
    if (fence.streaming || !/^\s*root\s*=/m.test(fence.code)) continue
    const { root, errors } = evaluateProgram(fence.code)
    if (root === null || errors.length > 0) continue
    const before = text.slice(last, fence.start)
    if (before.trim()) parts.push({ kind: 'md', text: before })
    parts.push({ kind: 'program', code: fence.code })
    last = fence.end
  }
  if (parts.length === 0) return null
  const tail = text.slice(last)
  if (tail.trim()) parts.push({ kind: 'md', text: tail })
  return parts
}

/**
 * 文本块渲染——Intelligence UI 回复管线的三态入口：
 *  1) 有 ```openui 围栏 → 原生渲染（模型 authored）
 *  2) 无围栏 + 已定稿 + 结构化内容 → 编译器自动升级为卡片/表格/图表
 *  3) 其余（纯文字/流式中）→ 与官方完全一致的 Markdown 渲染
 *
 * 编译用 useMemo 缓存：流式结束后只编译一次，重渲染不重复计算。
 */
const TextBlock = memo(function TextBlock({ text, streaming, labels, mentions, pathImages }) {
  const parts = useMemo(() => splitOpenUIFences(text), [text])
  const hasFence = parts.some((part) => part.kind === 'openui')
  // 普通代码块里写的 OpenUI 程序（模型偶尔忘写 ```openui 标记）
  const recovered = useMemo(
    () => (!streaming && !hasFence ? splitRecoverablePrograms(text) : null),
    [text, streaming, hasFence]
  )
  const compiled = useMemo(
    () =>
      !streaming && !hasFence && recovered === null && autoCompileEnabled()
        ? compileReply(text)
        : null,
    [text, streaming, recovered, hasFence]
  )
  if (!hasFence) {
    if (recovered !== null) {
      return (
        <RenderBoundary
          resetKey={text}
          fallback={
            <MarkdownText
              text={text}
              streaming={streaming}
              labels={labels}
              fileMentions={mentions}
              pathImages={pathImages}
            />
          }
        >
          <div className="dsh-iui-body" data-iui-recovered="" style={{ gap: 12 }}>
            {recovered.map((part, i) =>
              part.kind === 'program' ? (
                <OpenUICard key={i} code={part.code} streaming={false} />
              ) : (
                <MarkdownText
                  key={i}
                  text={part.text}
                  streaming={false}
                  labels={labels}
                  fileMentions={mentions}
                  pathImages={pathImages}
                />
              )
            )}
          </div>
        </RenderBoundary>
      )
    }
    if (compiled !== null && compiled.mode === 'visual') {
      return (
        <RenderBoundary
          resetKey={text}
          fallback={
            <MarkdownText
              text={text}
              streaming={streaming}
              labels={labels}
              fileMentions={mentions}
              pathImages={pathImages}
            />
          }
        >
          <div className="dsh-iui-body" data-iui-compiled="" style={{ gap: 12 }}>
            <OpenUICard code={compiled.program} streaming={false} />
          </div>
        </RenderBoundary>
      )
    }
    return (
      <MarkdownText
        text={text}
        streaming={streaming}
        labels={labels}
        fileMentions={mentions}
        pathImages={pathImages}
      />
    )
  }

  // 插入式渲染：围栏外的文字保持原来的 Markdown 渲染（表格、列表、行内代码都不丢），
  // 围栏按出现位置插入为界面块。不再把整条回复拍平进一个 OpenUI 程序。
  return (
    <RenderBoundary
      resetKey={text}
      fallback={
        <MarkdownText
          text={text}
          streaming={streaming}
          labels={labels}
          fileMentions={mentions}
          pathImages={pathImages}
        />
      }
    >
      <div className="dsh-iui-body" style={{ gap: 12 }}>
        {parts.map((part, i) =>
          part.kind === 'md' ? (
            <MarkdownText
              key={i}
              text={part.text}
              streaming={streaming && i === parts.length - 1}
              labels={labels}
              fileMentions={mentions}
              pathImages={pathImages}
            />
          ) : (
            <OpenUICard
              key={i}
              code={part.code}
              pendingFallback={
                <MarkdownText
                  text={'```openui\n' + part.code}
                  streaming
                  labels={labels}
                  fileMentions={mentions}
                  pathImages={pathImages}
                />
              }
              streaming={streaming && (part.streaming || i === parts.length - 1)}
            />
          )
        )}
      </div>
    </RenderBoundary>
  )
})

/** assistant-step 节点渲染器（对照 ui-chat AssistantNodeView + AssistantMarkdown 移植）。 */
const AssistantNodeContent = memo(function AssistantNodeContent({
  node,
  groupPart,
  useDisclosure,
  useGroupAction,
  useTurnData,
  turnProcess,
  openFile,
  loadImage,
  fileMentions,
  usePresentation,
  renderSlot,
  renderFactorySlot,
  t
}) {
  const data = node.data
  const turn =
    node.location.kind === 'turn' || node.location.kind === 'step' ? node.location.turn : undefined
  const tail = useTurnData('turn-tail')
  const owner = useMemo(() => {
    if (turn?.status !== 'closed' || data.finalNode === undefined) return undefined
    if (tail?.closing?.finalNode.seq !== data.finalNode.seq) return undefined
    return { turn, seq: data.finalNode.seq, openFile }
  }, [data.finalNode, openFile, tail, turn])
  const mentions = useMemo(
    () => (owner === undefined ? undefined : fileMentions(owner)),
    [fileMentions, owner]
  )
  const labels = useMemo(() => markdownLabels(t), [t])
  const pathImages = useMemo(
    () => ({
      resolve: (value) => {
        try {
          const path = decodeURIComponent(value.split(/[?#]/u)[0] ?? '')
          const base = typeof document !== 'undefined' ? document.baseURI : 'file:///'
          if (path.startsWith('/') || path.startsWith('./') || path.startsWith('../')) {
            return new URL(path, base).href
          }
          return undefined
        } catch {
          return undefined
        }
      }
    }),
    []
  )
  const reasoningHidden =
    turnProcess !== undefined &&
    turnProcess.foldable &&
    turnProcess.spec.answerStep === data.step &&
    turnProcess.spec.inlineReasoning &&
    !turnProcess.open
  const revealProcess = useCallback(() => {
    turnProcess?.setOpen(true)
  }, [turnProcess])

  // 宿主 0.2.1-rc.5 起，替换同一 key 的渲染器不会再拿到 renderSlot：`renderSlot`
  // 只为「自己声明了 children」的注册注入（ui-renderer 的 standardKit），而替换者
  // 无法重复声明官方已声明的子插槽（SlotCore.register 会抛 already declared）。
  // 所以推理正文与消息图片优先走官方 Factory 路径，宿主不提供时再本地降级。
  const renderReasoningBody = useCallback(
    ({ text, running: reasoningRunning, labels: reasoningLabels }) => {
      if (typeof renderSlot === 'function') {
        return renderSlot('conversation.chat.reasoning.body', {
          text,
          rawText: text,
          running: reasoningRunning
        })
      }
      const fallback = (
        <MarkdownText
          text={text}
          streaming={reasoningRunning}
          labels={reasoningLabels}
          variant="compact"
        />
      )
      if (typeof renderFactorySlot === 'function') {
        return renderFactorySlot(
          'conversation.chat.reasoning.content',
          { text, running: reasoningRunning },
          { fallback }
        )
      }
      return fallback
    },
    [renderFactorySlot, renderSlot]
  )

  const renderMessageImages = useCallback(
    (images) => {
      if (typeof renderSlot === 'function') {
        return renderSlot('conversation.chat.message.images', { images, loadImage, align: 'start' })
      }
      if (typeof renderFactorySlot === 'function') {
        return renderFactorySlot(
          'conversation.images.content',
          { images, loadImage, align: 'start' },
          { fallback: null }
        )
      }
      return null
    },
    [loadImage, renderFactorySlot, renderSlot]
  )

  const streaming = data.status === 'running'
  const interrupted = data.status === 'interrupted'
  const blocks = data.blocks
  const hasVisible =
    streaming || interrupted === true || blocks.some((block) => block.kind !== 'tool-call')
  if (!hasVisible) return null

  const rendered = []
  const last = blocks.length - 1
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block === undefined) continue
    if (groupPart === 'reasoning' && block.kind !== 'reasoning') continue
    if (groupPart === 'response' && block.kind === 'reasoning') continue
    switch (block.kind) {
      case 'text':
        rendered.push(
          <RenderBoundary
            key={i}
            resetKey={block.text}
            fallback={
              <FallbackNotice>
                {typeof block.text === 'string' ? block.text : '文本格式无效'}
              </FallbackNotice>
            }
          >
            <TextBlock
              text={block.text}
              streaming={streaming && i === last}
              labels={labels}
              mentions={mentions}
              pathImages={pathImages}
            />
          </RenderBoundary>
        )
        break
      case 'reasoning': {
        if (block.text.trim() === '') break
        rendered.push(
          <ProcessReasoning
            key={i}
            hidden={reasoningHidden}
            reveal={revealProcess}
            useGroupAction={useGroupAction}
          >
            <ReasoningRow
              text={block.text}
              running={streaming && i === last}
              usePresentation={usePresentation}
              useDisclosure={useDisclosure}
              renderReasoningBody={renderReasoningBody}
              labels={labels}
              t={t}
            />
          </ProcessReasoning>
        )
        break
      }
      case 'image': {
        const start = i
        const group = [block]
        while (i + 1 < blocks.length) {
          const next = blocks[i + 1]
          if (next === undefined || next.kind !== 'image') break
          group.push(next)
          i += 1
        }
        rendered.push(
          <Fragment key={start}>
            {renderMessageImages(group.map(({ attachment }) => ({ attachment })))}
          </Fragment>
        )
        break
      }
      case 'tool-call':
        break
      default:
        rendered.push(
          <JsonBlock
            key={i}
            label={tr(t, 'message.unknownBlock', 'Unknown content block')}
            payload={block.block}
            truncatedLabel={(total) =>
              tr(t, 'json.truncated', `… truncated, ${total} characters total`, { total })
            }
          />
        )
    }
  }
  return (
    <div className="dsh-iui-root" data-streaming={streaming || undefined}>
      <div className="dsh-iui-body">
        {rendered.map((child) => (
          <RenderBoundary key={child.key} resetKey={data}>
            {child}
          </RenderBoundary>
        ))}
        {interrupted &&
          (groupPart === undefined ||
            groupPart === 'response' ||
            !blocks.some((block) => block.kind !== 'reasoning' && block.kind !== 'tool-call')) && (
            <span className="dsh-iui-stopped">{tr(t, 'message.stopped', 'Stopped')}</span>
          )}
      </div>
    </div>
  )
})

export const IntelligenceAssistantNodeView = memo(function IntelligenceAssistantNodeView(props) {
  return (
    <RenderBoundary resetKey={props.node?.data}>
      <AssistantNodeContent {...props} />
    </RenderBoundary>
  )
})

// ---------- 插件注册 ----------
// 展示策略：静态快照（标准模式默认值）。读取真实偏好需要 ui-settings 钩子，v1 从简。
const presentationStore = createSnapshotStore({
  mode: 'standard',
  collapseTiming: 'completion',
  foldCompletedTurns: true,
  stepGrouping: 'collapsed',
  liveProcessDetail: true,
  settledReasoningPreview: true
})

/** 客户端服务依赖：只要插槽系统。 */
export const inject = ['slots']

/**
 * Registers the assistant-step replacement renderer. priority -20 < -10 < host default 0,
 * 低数字渲染：迁移期旧插件即使还在也由本插件接管。
 * @param {import('@deepseek-ai/cordis').Context} ctx 客户端 cordis 上下文。
 */
export function apply(ctx) {
  try {
    console.info(`[${IUI_VERSION}] assistant-step renderer armed (priority -20)`)
  } catch {
    /* SSR 无 console 场景 */
  }
  // 注意：不要在这里再声明 children（'conversation.chat.reasoning.body' /
  // 'conversation.chat.message.images'）。官方 assistant-step 注册已声明过它们，
  // 重复声明会让 SlotCore.register 抛 "slot ... is already declared"，
  // 导致本插件 entry 激活失败 → web boot 整体 fail → 白屏。
  //
  // 也不能再依赖继承来的 renderSlot：DSH 0.2.1-rc.5 的 renderer kit 只在
  // entry.children 存在时才注入 renderSlot（见 ui-renderer 的 standardKit），
  // 替换者调用它会得到 undefined 并在展开思维链时抛 TypeError →
  // RenderBoundary 显示「此内容暂时无法显示」。所以子插槽内容改走官方
  // Factory 路径（renderFactorySlot，kit 恒定注入），本地再兜一层降级渲染。
  ctx.effect(() =>
    ctx.slots.inject('conversation.chat.node', () =>
      ctx.slots.register(
        {
          name: 'conversation.chat.node',
          key: 'assistant-step',
          locale: 'chat',
          priority: -20,
          inject: () => ({ hooks: { presentation: presentationStore } })
        },
        IntelligenceAssistantNodeView
      )
    )
  )
}
