#!/usr/bin/env node
/*
 * Maintainer helper: build and sync the plugin into a local DSH plugin directory.
 *
 * The plugin is normally installed from a directory (bundle), so local iteration
 * means rebuilding and copying the repo into the directory the host loads.
 *
 * Usage:
 *   node scripts/deploy.mjs --to <plugin-directory> [--dry-run]
 *
 * The target can also come from the IUI_PLUGIN_DIR environment variable.
 * A timestamped backup of the target's key files is written next to it.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const argv = process.argv.slice(2)
const arg = (name) => {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined
}

const live = arg('to') ?? process.env.IUI_PLUGIN_DIR
const dryRun = argv.includes('--dry-run')

if (!live) {
  console.error(
    '缺少目标目录。用法：node scripts/deploy.mjs --to <DSH plugin directory> [--dry-run]'
  )
  console.error('（也可以设置 IUI_PLUGIN_DIR）')
  process.exit(1)
}
if (!existsSync(live)) {
  console.error('目标目录不存在：' + live)
  process.exit(1)
}

console.log('⚙️  构建生产 bundle …')
execFileSync(process.execPath, [join(repo, 'build.mjs')], { stdio: 'inherit', cwd: repo })

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backup = join(dirname(live), `.intelligence-ui-backup-${stamp}`)
if (!dryRun) {
  console.log('💾 备份目标 →', backup)
  mkdirSync(backup, { recursive: true })
  for (const entry of [
    'index.js',
    'lib',
    'locale',
    'src',
    'build.mjs',
    'cordis.patch.yml',
    'package.json',
    'README.md',
    'docs',
    'examples',
    'icon.svg'
  ]) {
    const from = join(live, entry)
    if (existsSync(from)) cpSync(from, join(backup, entry), { recursive: true })
  }
}

const excludes = [
  '--exclude=.git',
  '--exclude=.github',
  '--exclude=node_modules',
  '--exclude=.DS_Store',
  '--exclude=test/fixtures/dsh-theme.css'
]
const args = [
  '-a',
  '--delete',
  ...excludes,
  ...(dryRun ? ['--dry-run', '--itemize-changes'] : []),
  repo + '/',
  live + '/'
]
console.log('📦 rsync →', live)
execFileSync('rsync', args, { stdio: 'inherit' })

console.log(
  dryRun
    ? '（dry-run，未写入）'
    : '✅ 同步完成。刷新聊天页面使客户端 bundle 生效；宿主提示模块若未热更新，重启一次宿主应用。'
)
