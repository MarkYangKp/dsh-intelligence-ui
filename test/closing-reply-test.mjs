// Exercise the actual replacement registration rather than supplying its missing service by hand.
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { loadClient, messageProps } from './client-fixture.mjs'

const client = loadClient()
const registrations = []
let service
client.apply({
  effect: (fn) => fn(),
  get: (name) => {
    assert.equal(name, 'chatFileMentions')
    return service
  },
  slots: {
    inject: (_name, fn) => fn(),
    register: (options, component) => registrations.push({ options, component })
  }
})
const { options, component } = registrations.find(({ options }) => options.key === 'assistant-step')
const injected = options.inject('session-fixture')
assert.equal(
  typeof injected.fileMentions,
  'function',
  'replacement must inject its own fileMentions'
)
const text = 'A completed synthetic reply.'
const closing = messageProps(text)
delete closing.fileMentions
closing.node.data.finalNode = { seq: 7 }
closing.useTurnData = () => ({ closing: { finalNode: { seq: 7 } } })
const render = (overrides = {}) =>
  renderToString(React.createElement(component, { ...closing, ...injected, ...overrides }))
const preserved = (html) => assert.ok(html.includes(text) && !html.includes('data-iui-fallback'))

// The optional provider may be absent even on a supported host.
preserved(render())
// Older embeddings may omit the injection entirely.
preserved(render({ fileMentions: undefined }))
preserved(render({ fileMentions: null }))

let received
const mentions = { resolve: () => undefined }
service = {
  forClosing(...args) {
    assert.equal(this, service)
    received = args
    return mentions
  }
}
const owner = { turn: closing.node.location.turn, seq: 7, openFile: () => {} }
const trigger = () => ({})
assert.equal(injected.fileMentions(owner, trigger), mentions)
assert.deepEqual(received, [owner, 'session-fixture', trigger])
preserved(render())
assert.equal(received[0].seq, 7)
assert.equal(received[0].turn, closing.node.location.turn)
assert.equal(received[1], 'session-fixture')

const warning = console.warn
const warnings = []
console.warn = (...args) => warnings.push(args)
try {
  service = {
    forClosing: () => {
      throw new Error('synthetic provider failure')
    }
  }
  preserved(render())
  assert.equal(warnings.length, 1)
  assert.ok(!JSON.stringify(warnings).includes('synthetic provider failure'))
  // No provider work before closing or for a different closing node.
  let calls = 0
  const fileMentions = () => {
    calls++
    throw new Error('must not run')
  }
  preserved(
    render({
      fileMentions,
      node: { ...closing.node, location: { kind: 'step', turn: { status: 'running' } } }
    })
  )
  preserved(render({ fileMentions, useTurnData: () => ({ closing: { finalNode: { seq: 8 } } }) }))
  preserved(render({ fileMentions, useTurnData: () => undefined }))
  assert.equal(calls, 0)
} finally {
  console.warn = warning
}
console.log(
  '✅ Closing reply registration, session forwarding, optional service and failure isolation'
)
