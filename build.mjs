// 构建 Intelligence UI 客户端 bundle：lib/client.js（ModuleLoader 闭包工厂格式）。
// 宿主半边是包根 index.js（纯 JS，无构建）。外部模块 = DSH 平台模块表
// （zod 除外：lang-core 需要 zod/v4 子路径，打进 bundle）。
//
// 可编程接口：buildClient({ outfile }) 供预览/多分支构建复用；直接执行时写 lib/client.js。
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

// zod@4 的 /v4 与 /v4/core 子路径实体（打进 bundle，规避平台表只有裸名 'zod'）
const zodV4 = fileURLToPath(import.meta.resolve('zod/v4'))
const zodV4Core = fileURLToPath(import.meta.resolve('zod/v4/core'))

const PLATFORM_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit'
]

const STUB_MCP = 'data:text/javascript,export const Client=class{};export default Client;'
const STUB_PATHS = [
  '@modelcontextprotocol/sdk/client/index.js',
  '@modelcontextprotocol/sdk/client/streamableHttp.js'
]

/**
 * 构建客户端 bundle。默认写入 lib/client.js。
 * @param {{ outfile?: string, logLevel?: 'info'|'silent'|'warning' }} [options]
 */
export async function buildClient({
  outfile = join(here, 'lib/client.js'),
  logLevel = 'info'
} = {}) {
  mkdirSync(dirname(outfile), { recursive: true })
  const cjsOut = join(dirname(outfile), '.client.cjs')

  // 1) CJS bundle（外部模块保持 require() 调用）
  await build({
    entryPoints: [join(here, 'src/client.jsx')],
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    // Prefer tree-shakeable ESM dependencies; output still uses the DSH CJS factory.
    mainFields: ['module', 'main'],
    jsx: 'automatic',
    minify: true,
    outfile: cjsOut,
    external: [...PLATFORM_EXTERNALS, 'node:*'],
    alias: {
      'zod/v4/core': zodV4Core,
      'zod/v4': zodV4,
      ...Object.fromEntries(STUB_PATHS.map((p) => [p, STUB_MCP]))
    },
    define: { 'process.env.NODE_ENV': '"production"' },
    target: ['es2022', 'chrome110', 'safari16'],
    logLevel
  })

  // 2) 包成 window.__ModuleLoader__.load({id, factory}) 闭包工厂格式（对照官方 bundle）
  const cjs = readFileSync(cjsOut, 'utf8')
  const packageName = 'dsh-intelligence-ui'
  const client = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(packageName)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${cjs}
		return module.exports;
	}
});
`
  writeFileSync(outfile, client)
  rmSync(cjsOut, { force: true })
  return { outfile, bytes: client.length }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { outfile, bytes } = await buildClient()
  console.log(`✅ ${outfile} (${(bytes / 1024).toFixed(0)} KB)`)
  console.log(`   外部依赖（由 DSH 模块表提供）: ${PLATFORM_EXTERNALS.join(', ')}`)
}
