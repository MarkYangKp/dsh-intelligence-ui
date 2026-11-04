// 设计法度自测量：真实浏览器计算样式 → 报告 → 断言。
// 用 chrome-headless-shell --dump-dom 拿回页面内脚本写好的 JSON 报告。
// 检查项对应当前 design-taste 的 house rules + DSH 品牌约束（token 化、暗色可跟随）。
import { CHROME, runChromeFrames } from './chrome.mjs'
await import('./gallery.mjs')
import { readFileSync, writeFileSync } from 'node:fs'

if (!CHROME) throw new Error('Chrome is required for design verification')
const probe =
  '<script>\n' +
  readFileSync(new URL('./fixtures/taste-probe.js', import.meta.url), 'utf8') +
  '</script>'

let totalPass = 0,
  totalFail = 0
for (const theme of ['light', 'dark'])
  for (const width of [920, 390]) {
    const gallery = theme === 'light' ? '/tmp/iui-gallery.html' : '/tmp/iui-gallery-dark.html'
    const measured = `/tmp/iui-measured-${theme}-${width}.html`
    const html = readFileSync(gallery, 'utf8')
    writeFileSync(measured, html.replace('</body>', probe + '</body>'))
    console.log(`\n${theme} / ${width}px`)
    const dom = await runChromeFrames({
      url: 'file://' + measured,
      profile: '/tmp/iui-design-profile',
      ready: "Boolean(document.querySelector('#taste-report'))",
      args: [`--window-size=${width},2600`, '--hide-scrollbars']
    })

    const m = dom.match(/TASTE_JSON:(\{[\s\S]*?\})<\/pre>/)
    if (!m) {
      console.error('❌ 未拿到测量报告')
      process.exit(1)
    }
    const r = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))

    let pass = 0,
      fail = 0
    const check = (name, ok, detail = '') => {
      ok
        ? (pass++, console.log('✅ ' + name))
        : (fail++, console.log('❌ ' + name + (detail ? ' — ' + detail : '')))
    }

    check('无渐变填充', r.gradients.length === 0, r.gradients.slice(0, 3).join(' | '))
    check('静止元素无阴影', r.shadows.length === 0, r.shadows.slice(0, 3).join(' | '))
    check('无大写小标签', r.uppercase.length === 0, r.uppercase.slice(0, 3).join(' | '))
    check('无横向溢出', r.overflow.length === 0, r.overflow.slice(0, 3).join(' | '))
    const sizes = Object.keys(r.sizes).sort((a, b) => parseFloat(a) - parseFloat(b))
    // 7 档设计字号 + 最多 2 个模型自选字号（原语层 Text 的 px 尺寸）。
    check('字号档位 ≤ 9（设计 7 档 + 模型自选 ≤2）', sizes.length <= 9, sizes.join(' '))
    check(
      '存在入场动效（或系统要求减少动态）',
      r.animated > 0 || r.reduced,
      `animations=${r.animated} reduced=${r.reduced} sample=${r.animSample}`
    )
    const longHeads = r.headings.filter((h) => h.lines > 2)
    check('标题 ≤ 2 行', longHeads.length === 0, JSON.stringify(longHeads.slice(0, 2)))
    check(
      '正文对比度 ≥ 4.5:1（≥13px 文本，WCAG AA）',
      r.contrastLow.length === 0,
      r.contrastLow.slice(0, 3).join(' | ')
    )
    check(
      '强调色克制（色相 ≤ 8 种）',
      (r.chromaCount ?? 0) <= 8,
      `chroma=${r.chromaCount} ${Object.keys(r.chroma || {})
        .slice(0, 8)
        .join(', ')}`
    )

    console.log('\n字号分布:', sizes.map((s) => `${s}×${r.sizes[s]}`).join('  '))
    for (const k of Object.keys(r.samples || {})) console.log('  ', k, '→', r.samples[k])
    console.log('动效元素:', r.animated)
    console.log(`\n${pass} 通过, ${fail} 失败`)
    totalPass += pass
    totalFail += fail
  }
console.log(`\n设计门禁合计：${totalPass} 通过, ${totalFail} 失败（7 项 × 明暗 × 宽窄）`)
process.exit(totalFail > 0 ? 1 : 0)
