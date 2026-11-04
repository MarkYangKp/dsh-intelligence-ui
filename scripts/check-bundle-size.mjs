#!/usr/bin/env node
/* Bundle size guard used by CI (same ceilings as test/budget-test.mjs). */
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const RAW_LIMIT = 740_000
const GZIP_LIMIT = 190_000
const path = new URL('../lib/client.js', import.meta.url)
const bundle = readFileSync(path)
const gzip = gzipSync(bundle)
console.log(`lib/client.js: ${bundle.length} B raw, ${gzip.length} B gzip`)
if (bundle.length > RAW_LIMIT || gzip.length > GZIP_LIMIT) {
  console.error(`❌ bundle exceeds the budget (${RAW_LIMIT} B raw / ${GZIP_LIMIT} B gzip)`)
  process.exit(1)
}
console.log('✅ within the bundle budget')
