#!/usr/bin/env node
/*
 * Local documentation link checker.
 *
 * Verifies that every relative Markdown link in the repository points at a file that exists
 * **and is tracked by Git** (an ignored/generated file would be a broken link for visitors).
 * External URLs and pure anchors are skipped; CI runs this via `pnpm test:docs`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skipDirs = new Set(['node_modules', '.git', 'lib', 'dist', 'coverage'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (entry.endsWith('.md')) out.push(path)
  }
  return out
}

const tracked = new Set(
  execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map((p) => p.split('/').join(sep))
)

const files = walk(root).sort()
const failures = []
let links = 0

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[2].replace(/^<|>$/g, '')
    if (!target || /^(?:https?:|mailto:|tel:|#|\/)/i.test(target)) continue
    links++
    const [rawPath, fragment] = target.split('#')
    if (!rawPath) continue // same-document anchor
    let decoded = rawPath
    try {
      decoded = decodeURIComponent(rawPath)
    } catch {
      /* keep raw */
    }
    const absolute = resolve(dirname(file), decoded)
    const rel = relative(root, absolute)
    if (rel.startsWith('..')) {
      failures.push(`${relative(root, file)} → ${target} (outside the repository)`)
      continue
    }
    if (!existsSync(absolute)) {
      failures.push(`${relative(root, file)} → ${target} (file does not exist)`)
      continue
    }
    const isDir = statSync(absolute).isDirectory()
    if (isDir) continue
    if (!tracked.has(rel.split('/').join(sep))) {
      failures.push(`${relative(root, file)} → ${target} (file is not tracked by Git)`)
    }
    if (fragment && decoded.endsWith('.md')) {
      const headings = readFileSync(absolute, 'utf8')
        .split('\n')
        .filter((line) => /^#{1,6}\s/.test(line))
        .map((line) =>
          line
            .replace(/^#{1,6}\s+/, '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]/gu, '')
            .trim()
            .replace(/\s+/g, '-')
        )
      if (!headings.includes(fragment.toLowerCase())) {
        failures.push(`${relative(root, file)} → ${target} (anchor not found)`)
      }
    }
  }
}

console.log(`检查 ${files.length} 个 Markdown 文件，${links} 个相对链接`)
if (failures.length) {
  console.error(`❌ ${failures.length} 个问题：`)
  for (const failure of failures) console.error('  -', failure)
  process.exit(1)
}
console.log('✅ 所有相对链接均有效且被 Git 跟踪')
