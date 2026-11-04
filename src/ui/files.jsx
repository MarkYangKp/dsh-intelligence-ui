// 代码与文件：Diff / FileTree。
// v3 视觉语言：diff 是「精密校对面板」——双栏行号 + 语义色 diff 底 + 发丝分隔；
// 文件树是「仓库视图」——等宽路径、24px 行高、A/M/D 语义小胶囊。
import React from 'react'
import { z } from 'zod'
import { defineComponent } from '@openuidev/lang-core'
import { FallbackNotice } from '../render-safety.jsx'
import { T, TINT, INK, FS, FW, S, NUMS, TRACK, radiusMd, radiusXs, radiusFull } from './theme.js'
import { PanelTitle, useExpanded, ExpandToggle, EmptyState } from './shared.jsx'

const CODE_FONT = 'var(--ds-font-family-code, ui-monospace, monospace)'
// DSH 自带的 diff 行底色（8% / 12% 语义色），比自造 tint 更贴近平台。
const DIFF_ADD = 'var(--dsw-alias-code-diff-added)'
const DIFF_DEL = 'var(--dsw-alias-code-diff-deleted)'
const DIFF_PREVIEW = 30

/** 统一 diff → 渲染行（带旧/新行号）。头部元信息折叠成极少量的上下文行。 */
function parseDiff(raw) {
  const lines = String(raw ?? '').split('\n')
  const rows = []
  let oldNo = 1,
    newNo = 1,
    inHunk = false,
    add = 0,
    del = 0,
    fileName = null
  for (const line of lines) {
    if (/^diff /.test(line)) {
      inHunk = false
      continue
    }
    if (
      /^(index |new file mode|deleted file mode|old mode|new mode|similarity index|rename from|rename to|Binary files)/.test(
        line
      )
    )
      continue
    const plusName = /^\+\+\+ (?:b\/)?(.+)$/.exec(line)
    if (plusName) {
      fileName = plusName[1].trim()
      continue
    }
    if (/^--- /.test(line)) continue
    const hunk = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@(.*)$/.exec(line)
    if (hunk) {
      oldNo = Number(hunk[1])
      newNo = Number(hunk[2])
      inHunk = true
      rows.push({ kind: 'meta', text: line.trim() })
      continue
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      add++
      rows.push({ kind: 'add', old: null, next: newNo, text: line.slice(1) })
      newNo++
      continue
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      del++
      rows.push({ kind: 'del', old: oldNo, next: null, text: line.slice(1) })
      oldNo++
      continue
    }
    if (line.startsWith(' ')) {
      rows.push({ kind: 'ctx', old: oldNo, next: newNo, text: line.slice(1) })
      oldNo++
      newNo++
      continue
    }
    if (line.startsWith('\\')) {
      rows.push({ kind: 'meta', text: line.trim() })
      continue
    }
    if (line === '') continue
    if (!inHunk) {
      rows.push({ kind: 'meta', text: line })
      continue
    }
    rows.push({ kind: 'ctx', old: oldNo + 1, next: newNo + 1, text: line })
  }
  return { rows, add, del, fileName }
}

export const components = [
  defineComponent({
    name: 'Diff',
    description:
      'Unified diff with +/- colouring and change stats. Pass the raw unified diff text; ' +
      'filename is shown in the header. Use for code changes, config edits, review findings.',
    props: z.object({
      filename: z.string().optional(),
      diff: z.string()
    }),
    component: ({ props }) => {
      const [open, toggle] = useExpanded()
      const { rows, add, del, fileName } = React.useMemo(() => parseDiff(props.diff), [props.diff])
      const shown = open ? rows : rows.slice(0, DIFF_PREVIEW)
      const long = rows.length > DIFF_PREVIEW
      const maxNo = rows.reduce((m, r) => Math.max(m, r.old ?? 0, r.next ?? 0), 0)
      const numW = Math.max(20, 8 + String(Math.max(maxNo, 1)).length * 7)
      const stat = (text, color, bg) => (
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            height: 18,
            padding: '0 6px',
            borderRadius: radiusFull,
            background: bg,
            color,
            fontSize: FS.caption,
            fontWeight: FW.medium,
            letterSpacing: TRACK.caption,
            lineHeight: 1,
            ...NUMS
          }}
        >
          {text}
        </span>
      )
      return (
        <div
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: radiusMd,
            overflow: 'hidden',
            background: T.codeBg,
            minWidth: 0
          }}
        >
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
              {props.filename ?? fileName ?? 'diff'}
            </span>
            {long && (
              <button
                type="button"
                onClick={toggle}
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
                  color: T.inkTertiary,
                  lineHeight: 1.6,
                  letterSpacing: TRACK.caption,
                  whiteSpace: 'nowrap'
                }}
              >
                {open ? '收起' : `展开 ${rows.length} 行`}
              </button>
            )}
            {stat(`+${add}`, INK.success, TINT.success)}
            {stat(`−${del}`, INK.danger, TINT.danger)}
          </div>
          {rows.length === 0 ? (
            <EmptyState>没有可显示的差异</EmptyState>
          ) : (
            <pre
              data-scroll
              style={{
                margin: 0,
                padding: `${S.xs}px 0`,
                background: T.codeBg,
                overflowX: 'auto',
                overflowY: 'hidden',
                fontFamily: CODE_FONT,
                fontSize: FS.small,
                lineHeight: '21px',
                color: T.ink
              }}
            >
              {shown.map((row, i) => {
                if (row.kind === 'meta') {
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        width: 'max-content',
                        minWidth: '100%',
                        background: T.surfaceTint
                      }}
                    >
                      <span
                        style={{
                          padding: `0 ${S.md}px`,
                          whiteSpace: 'pre',
                          color: T.inkTertiary,
                          fontSize: FS.caption,
                          lineHeight: '21px'
                        }}
                      >
                        {row.text || ' '}
                      </span>
                    </div>
                  )
                }
                const isAdd = row.kind === 'add'
                const isDel = row.kind === 'del'
                const bg = isAdd ? DIFF_ADD : isDel ? DIFF_DEL : undefined
                const marker = isAdd ? '+' : isDel ? '−' : ''
                const markerColor = isAdd ? INK.success : isDel ? INK.danger : T.inkTertiary
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
                    {/* 双栏行号 + 变更标记：横向滚动时粘在左侧，读长行不丢定位 */}
                    <span
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'stretch',
                        background: bg ?? T.codeBg,
                        borderRight: `1px solid ${T.hairline}`
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: numW,
                          flexShrink: 0,
                          textAlign: 'right',
                          paddingRight: S.xs,
                          boxSizing: 'border-box',
                          userSelect: 'none',
                          fontSize: FS.caption,
                          lineHeight: '21px',
                          color: T.inkCaption,
                          ...NUMS
                        }}
                      >
                        {row.old ?? ''}
                      </span>
                      <span
                        aria-hidden
                        style={{
                          width: numW,
                          flexShrink: 0,
                          textAlign: 'right',
                          paddingRight: S.sm,
                          boxSizing: 'border-box',
                          userSelect: 'none',
                          fontSize: FS.caption,
                          lineHeight: '21px',
                          color: T.inkCaption,
                          ...NUMS
                        }}
                      >
                        {row.next ?? ''}
                      </span>
                      <span
                        aria-hidden
                        style={{
                          width: 16,
                          flexShrink: 0,
                          textAlign: 'center',
                          userSelect: 'none',
                          fontSize: FS.caption,
                          lineHeight: '21px',
                          color: markerColor,
                          fontWeight: FW.medium
                        }}
                      >
                        {marker}
                      </span>
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        whiteSpace: 'pre',
                        paddingLeft: S.sm,
                        paddingRight: S.lg,
                        color: T.ink
                      }}
                    >
                      {row.text === '' ? ' ' : row.text}
                    </span>
                  </div>
                )
              })}
            </pre>
          )}
        </div>
      )
    }
  }),
  defineComponent({
    name: 'FileTree',
    description:
      'Nested file/directory tree from a list of paths. files=[{path, status?}] where status is ' +
      'added|modified|deleted (shown as a coloured marker). Use for repo structure or change sets.',
    props: z.object({
      title: z.string().optional(),
      files: z
        .array(
          z.object({
            path: z.string(),
            status: z.enum(['added', 'modified', 'deleted']).optional()
          })
        )
        .default([])
    }),
    component: ({ props }) => {
      const [open, toggle] = useExpanded()
      const PREVIEW = 15
      const long = props.files.length > PREVIEW
      const files = open ? props.files : props.files.slice(0, PREVIEW)
      // 构建树
      const root = { children: new Map(), status: null, name: '' }
      for (const f of files) {
        const parts = String(f.path).split('/').filter(Boolean)
        if (parts.length > 64) return <FallbackNotice>路径层级过深</FallbackNotice>
        let node = root
        parts.forEach((part, i) => {
          if (!node.children.has(part))
            node.children.set(part, { children: new Map(), status: null, name: part })
          node = node.children.get(part)
          if (i === parts.length - 1 && f.status) node.status = f.status
        })
      }
      // 状态胶囊：A/M/D + 语义浅底，比裸字母更像版本控制的正式标记。
      const STATUS = {
        added: { mark: 'A', color: INK.success, bg: TINT.success },
        modified: { mark: 'M', color: INK.warning, bg: TINT.warning },
        deleted: { mark: 'D', color: INK.danger, bg: TINT.danger }
      }
      const renderNode = (node, depth) => {
        const entries = [...node.children.values()].sort((a, b) => {
          const aDir = a.children.size > 0,
            bDir = b.children.size > 0
          if (aDir !== bDir) return aDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        return entries.map((child) => {
          const isDir = child.children.size > 0
          const status = child.status != null ? STATUS[child.status] : null
          return (
            <React.Fragment key={depth + '/' + child.name}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: S.sm,
                  height: 24,
                  paddingLeft: S.xs + depth * 14,
                  paddingRight: S.md,
                  minWidth: 0
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 12,
                    textAlign: 'center',
                    fontSize: FS.small,
                    lineHeight: 1,
                    color: T.inkTertiary
                  }}
                >
                  {isDir ? '▾' : ''}
                </span>
                <span
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: CODE_FONT,
                    fontSize: FS.small,
                    color: isDir ? T.ink : T.inkSecondary,
                    fontWeight: isDir ? FW.medium : FW.regular,
                    letterSpacing: TRACK.caption
                  }}
                >
                  {child.name}
                </span>
                {status != null && (
                  <span
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: 16,
                      padding: '0 4px',
                      borderRadius: radiusXs,
                      background: status.bg,
                      color: status.color,
                      fontSize: FS.caption,
                      fontWeight: FW.medium,
                      lineHeight: 1,
                      fontFamily: CODE_FONT,
                      ...NUMS
                    }}
                  >
                    {status.mark}
                  </span>
                )}
              </div>
              {isDir && renderNode(child, depth + 1)}
            </React.Fragment>
          )
        })
      }
      return (
        <div style={{ minWidth: 0 }}>
          {props.title != null && (
            <PanelTitle right={`${props.files.length} 个文件`}>{props.title}</PanelTitle>
          )}
          <div
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: radiusMd,
              padding: `${S.xs}px 0`,
              background: T.surface,
              minWidth: 0,
              overflow: 'hidden'
            }}
          >
            {props.files.length === 0 ? <EmptyState>没有文件</EmptyState> : renderNode(root, 0)}
          </div>
          {long && (
            <ExpandToggle open={open} onToggle={toggle} note={`共 ${props.files.length} 个文件`} />
          )}
        </div>
      )
    }
  })
]
