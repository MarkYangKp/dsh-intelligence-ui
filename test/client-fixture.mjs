import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { readFileSync } from 'node:fs'

export function loadClient() {
  const platform = {
    react: React,
    'react/jsx-runtime': jsx,
    '@deepseek-ai/dsh-client-store': {
      createSnapshotStore: (v) => ({
        get: () => v,
        getSnapshot: () => v,
        subscribe: () => () => {}
      })
    },
    '@deepseek-ai/dsh-client-ui-primitives': {
      MarkdownText: ({ text }) => React.createElement('div', { 'data-md': '' }, text),
      DisclosureRow: ({ children }) => children,
      TextShimmer: ({ children }) => children,
      IconThinkOutlineRegular: () => null,
      JsonBlock: () => null
    }
  }
  let mod
  const previous = globalThis.window
  globalThis.window = {
    __ModuleLoader__: {
      load: (d) => {
        mod = d.factory((s) => platform[s])
      }
    }
  }
  try {
    eval(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
  } finally {
    globalThis.window = previous
  }
  return mod
}

export function messageProps(text, status = 'settled') {
  return {
    node: {
      data: { status, step: 1, blocks: [{ kind: 'text', text }] },
      location: { kind: 'step', turn: { status: 'closed' } }
    },
    useDisclosure: () => ({ expanded: false, toggle: () => {} }),
    useGroupAction: () => null,
    useTurnData: () => undefined,
    fileMentions: () => undefined,
    usePresentation: (s) => s({ settledReasoningPreview: true }),
    renderSlot: () => null,
    t: (k) => k
  }
}
