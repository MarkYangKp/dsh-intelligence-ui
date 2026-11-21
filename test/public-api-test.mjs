// Public client API: other plugins consume these through `dsh.client.external`.
// Kept in its own file because the surface is used outside this plugin, so a silent
// rename would break an installed consumer without failing any renderer test.
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { loadClient } from './client-fixture.mjs'

const client = loadClient()

assert.equal(typeof client.renderOpenUI, 'function', 'renderOpenUI must be callable')
assert.equal(typeof client.OpenUICard, 'function', 'OpenUICard must be exported')
assert.equal(typeof client.evaluateProgram, 'function', 'evaluateProgram must be exported')

const program = 'root = Stack([t], "column", 8)\nt = Text("公开出口可用", 14)'

// The evaluator is part of the surface: consumers may inspect a program before rendering it.
const evaluated = client.evaluateProgram(program)
assert.ok(evaluated && evaluated.root !== null, 'evaluateProgram parses a valid program')
assert.equal(evaluated.errors.length, 0, 'evaluateProgram reports no errors for a valid program')

const element = client.renderOpenUI(program)
assert.ok(React.isValidElement(element), 'renderOpenUI returns a React element')
// The outer boundary is what stops a broken program from replacing a host panel.
// Assert the boundary contract rather than the class name: the bundle mangles names.
assert.equal(
  typeof element.type.getDerivedStateFromError,
  'function',
  'renderOpenUI isolates failures from the caller'
)

const html = renderToString(element)
assert.ok(html.includes('公开出口可用'), 'rendered program text is present')
assert.ok(html.includes('data-openui'), 'renders through the shared OpenUI card')

// A program that cannot be evaluated must degrade locally, never throw at the caller.
// (An unknown child name is tolerated on purpose, so use a program with no root expression.)
const broken = renderToString(client.renderOpenUI('root = '))
assert.ok(broken.includes('data-iui-fallback'), 'broken program degrades to the local notice')

console.log('✅ 公开运行时出口：renderOpenUI / OpenUICard / evaluateProgram 可用且错误隔离')
