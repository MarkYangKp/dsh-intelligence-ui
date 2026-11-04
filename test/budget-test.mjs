import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { WORLD_PATH } from '../src/world-map.mjs'
import { library } from '../src/compiler-runtime-check.mjs'

const bundle = readFileSync(new URL('../lib/client.js', import.meta.url))
// v3（2026-11）设计系统与 44 个组件的视觉重做抬升了预算；仍守住 740/190KB，防止无界膨胀。
assert.ok(bundle.length <= 740000, 'raw bundle exceeds 740KB')
assert.ok(gzipSync(bundle).length <= 190000, 'gzip bundle exceeds 190KB')
assert.equal(Object.keys(library.components).length, 44)
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
// Fingerprint captured from ada146d, including parameter order, defaults and descriptions.
// 2026-10-21: Text.size 扩为 number|sm|md|lg|xl，接受 Text("…", "sm") 的尺寸 token，指纹随 schema 更新。
assert.equal(
  hash(library.toJSONSchema()),
  '7d1a86f11917202b24411e335d88796191ddfdae5f1c2ec245a851280d378583'
)

// Verify every original map vertex, including duplicates. Encoding alone changed.
let x = 0,
  y = 0
const vertices = []
for (const [, command, args] of WORLD_PATH.matchAll(/([MLlhvZ])([^MLlhvZ]*)/g)) {
  const values = args.trim().split(/\s+/).map(Number)
  if (command === 'Z') {
    vertices.push(['Z'])
    continue
  }
  if (command === 'M' || command === 'L') [x, y] = values
  if (command === 'l') {
    x += values[0]
    y += values[1]
  }
  if (command === 'h') x += values[0]
  if (command === 'v') y += values[0]
  vertices.push([command === 'M' ? 'M' : 'L', x, y])
}
assert.equal(hash(vertices), '2c1474464ab34ed55a985551e3f9ca0a045bdedfda7560663e0b158010083519')
console.log(
  `5 通过, 0 失败 (budget/API/map); raw=${bundle.length} B, gzip=${gzipSync(bundle).length} B`
)
