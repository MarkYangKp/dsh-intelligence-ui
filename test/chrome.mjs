import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Chromium binaries installed by Playwright for the current user (version-agnostic). */
function playwrightChromium() {
  const root =
    process.platform === 'darwin'
      ? join(homedir(), 'Library/Caches/ms-playwright')
      : join(homedir(), '.cache/ms-playwright')
  if (!existsSync(root)) return []
  const found = []
  for (const entry of readdirSync(root)) {
    const base = join(root, entry)
    if (entry.startsWith('chromium_headless_shell-')) {
      for (const sub of readdirSync(base)) {
        const path = join(base, sub, 'chrome-headless-shell')
        if (existsSync(path)) found.push(path)
      }
    } else if (entry.startsWith('chromium-')) {
      for (const sub of readdirSync(base)) {
        for (const rel of [
          'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
          'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
          'chrome-linux/chrome'
        ]) {
          const path = join(base, sub, rel)
          if (existsSync(path)) found.push(path)
        }
      }
    }
  }
  return found
}

export const CHROME = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ...playwrightChromium(),
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  process.env['PROGRAMFILES'] &&
    join(process.env['PROGRAMFILES'], 'Google/Chrome/Application/chrome.exe'),
  process.env['LOCALAPPDATA'] &&
    join(process.env['LOCALAPPDATA'], 'Google/Chrome/Application/chrome.exe')
]
  .filter(Boolean)
  .find(existsSync)

if (!CHROME) {
  console.warn(
    'ℹ 未找到 Chrome/Chromium：浏览器相关测试会跳过（设置 CHROME=/path/to/chrome 可启用）'
  )
}

// GitHub Actions / containers: Chrome's sandbox is unavailable; browser suites run as root.
const noSandbox =
  process.env.CI === 'true' || process.env.IUI_CHROME_NO_SANDBOX === '1' || process.getuid?.() === 0

let singleProcess = process.env.IUI_CHROME_SINGLE_PROCESS === '1'
export function runChrome(args) {
  const run = () =>
    execFileSync(
      CHROME,
      [
        '--headless',
        '--disable-gpu',
        '--disable-background-networking',
        '--no-first-run',
        '--disable-component-update',
        ...(noSandbox ? ['--no-sandbox'] : []),
        ...(singleProcess
          ? ['--no-sandbox', '--single-process', '--in-process-gpu', '--no-zygote']
          : []),
        ...args
      ],
      {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 30000,
        killSignal: 'SIGKILL',
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )
  try {
    return run()
  } catch (error) {
    // macOS workspace sandboxes deny Chromium's multiprocess Mach rendezvous.
    // A local-fixture-only fallback; test failures in the returned DOM still fail.
    if (
      singleProcess ||
      process.platform !== 'darwin' ||
      !['SIGTRAP', 'SIGABRT'].includes(error.signal)
    )
      throw error
    singleProcess = true
    console.log('ℹ Chrome 多进程启动受限，使用单进程运行本地测试页面')
    return run()
  }
}

/** Spawn a headless Chrome and talk CDP over the remote-debugging pipe. */
async function launch({ profile, args = [] }) {
  const chrome = spawn(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      '--disable-background-networking',
      '--no-first-run',
      '--disable-component-update',
      '--no-sandbox',
      '--single-process',
      '--in-process-gpu',
      '--no-zygote',
      '--remote-debugging-pipe',
      '--user-data-dir=' + profile,
      ...args,
      'about:blank'
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] }
  )
  let serial = 0,
    buffer = ''
  const pending = new Map()
  chrome.stdio[4].setEncoding('utf8')
  chrome.stdio[4].on('data', (chunk) => {
    buffer += chunk
    let end
    while ((end = buffer.indexOf('\0')) >= 0) {
      const response = JSON.parse(buffer.slice(0, end))
      buffer = buffer.slice(end + 1)
      const request = pending.get(response.id)
      if (!request) continue
      pending.delete(response.id)
      clearTimeout(request.timer)
      if (response.error) request.reject(new Error(JSON.stringify(response.error)))
      else request.resolve(response.result)
    }
  })
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++serial
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('Chrome timeout: ' + method))
      }, 15000)
      pending.set(id, { resolve, reject, timer })
      chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0')
    })
  const close = async () => {
    if (chrome.exitCode === null && chrome.signalCode === null) {
      const exited = new Promise((resolve) => chrome.once('exit', resolve))
      chrome.kill('SIGKILL')
      await exited
    }
    for (const request of pending.values()) clearTimeout(request.timer)
  }
  return { send, close }
}

export async function runChromeFrames({ url, profile, ready, args = [] }) {
  // A real frame clock is required for ResizeObserver. Virtual-time dump-dom can
  // exhaust its timer budget before any resize/rendering frame is delivered.
  const { send, close } = await launch({ profile, args })
  let dom
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    await send('Page.navigate', { url }, sessionId)
    const { result, exceptionDetails } = await send(
      'Runtime.evaluate',
      {
        expression: `new Promise((resolve, reject) => {
        const deadline = Date.now() + 7000;
        const poll = () => {
          if (${ready})
            resolve(document.documentElement.outerHTML);
          else if (Date.now() > deadline) reject(new Error('Browser report missing'));
          else setTimeout(poll, 50);
        }; poll();
      })`,
        awaitPromise: true,
        returnByValue: true
      },
      sessionId
    )
    if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails))
    dom = result.value
  } finally {
    await close()
  }
  return dom
}

/**
 * Full-page screenshot of a local HTML file (visual review / gallery snapshots).
 * Sets an explicit viewport width so media queries and container measurements are
 * deterministic, waits for fonts + two frames, then captures beyond the viewport.
 */
export async function capturePage({
  url,
  out,
  width = 920,
  height = 1200,
  profile = '/tmp/iui-shot-profile',
  args = []
}) {
  const { send, close } = await launch({ profile, args })
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    await send(
      'Emulation.setDeviceMetricsOverride',
      {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false
      },
      sessionId
    )
    await send('Page.navigate', { url }, sessionId)
    const { exceptionDetails } = await send(
      'Runtime.evaluate',
      {
        expression: `(async () => {
        const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await frame();
        if (document.fonts) { try { await document.fonts.ready } catch {} }
        await frame(); await frame();
        const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        return h;
      })()`,
        awaitPromise: true,
        returnByValue: true
      },
      sessionId
    )
    if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails))
    const { data } = await send(
      'Page.captureScreenshot',
      {
        format: 'png',
        captureBeyondViewport: true,
        fromSurface: true
      },
      sessionId
    )
    writeFileSync(out, Buffer.from(data, 'base64'))
    return out
  } finally {
    await close()
  }
}
