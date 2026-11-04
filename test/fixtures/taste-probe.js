// 设计门禁探针：在真实 Chrome 里测量渲染结果，把 JSON 报告写进 #taste-report。
// 由 test/measure.mjs 注入到画廊页面；等待入场动画结束后再测量，避免把 opacity:0 误判为不可见。
;(function () {
  const run = () => {
    const out = {
      gradients: [],
      shadows: [],
      uppercase: [],
      sizes: {},
      overflow: [],
      headings: [],
      tokens: 0,
      animated: 0,
      contrastLow: [],
      contrastWarn: [],
      chroma: {},
      reduced: false
    }
    out.reduced = !!(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    const all = [...document.querySelectorAll('.dsh-iui-card, .dsh-iui-card *')]

    const parse = (color) => {
      const m = color && color.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number)
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
    }
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratio = (a, b) => {
      const l1 = lum(a),
        l2 = lum(b)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1
    })
    const baseBg = (() => {
      const c = parse(getComputedStyle(document.body).backgroundColor)
      return c && c.a >= 0.999 ? c : { r: 255, g: 255, b: 255, a: 1 }
    })()
    const bgOf = (el) => {
      const stack = []
      let n = el
      while (n && n !== document.documentElement) {
        const c = parse(getComputedStyle(n).backgroundColor)
        if (c && c.a > 0) {
          stack.push(c)
          if (c.a >= 0.999) break
        }
        n = n.parentElement
      }
      if (!stack.length) return baseBg
      let acc = stack.pop()
      while (stack.length) acc = over(stack.pop(), acc)
      return acc
    }

    for (const el of all) {
      if (el.closest('[aria-hidden="true"]')) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
      if (cs.backgroundImage && cs.backgroundImage.includes('gradient'))
        out.gradients.push(el.tagName + '.' + el.className)
      if (cs.boxShadow && cs.boxShadow !== 'none') {
        out.shadows.push(el.tagName + '.' + el.className + ' → ' + cs.boxShadow.slice(0, 40))
      }
      if (cs.textTransform === 'uppercase')
        out.uppercase.push(el.tagName + ' ' + (el.textContent || '').slice(0, 16))
      if (cs.animationName && cs.animationName !== 'none') out.animated++
      if ((cs.color || '').includes('var(')) out.tokens++
      if (
        !(el instanceof SVGElement) &&
        el.scrollWidth > el.clientWidth + 2 &&
        cs.overflowX !== 'auto' &&
        cs.overflowX !== 'scroll' &&
        el.clientWidth > 0
      ) {
        out.overflow.push(
          el.tagName + '.' + el.className + ' ' + el.scrollWidth + '>' + el.clientWidth
        )
      }
      if (/^H[1-6]$/.test(el.tagName)) {
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3
        out.headings.push({
          tag: el.tagName,
          lines: Math.round(el.getBoundingClientRect().height / lh),
          text: (el.textContent || '').slice(0, 30)
        })
      }
      const fs = cs.fontSize
      if (el.tagName === 'title') continue // SVG <title> 是不可见的提示文本
      if (el.children.length !== 0 || !(el.textContent || '').trim()) continue
      out.sizes[fs] = (out.sizes[fs] || 0) + 1
      out.samples = out.samples || {}
      if (!out.samples[fs]) out.samples[fs] = (el.textContent || '').trim().slice(0, 12)
      const fg = parse(cs.color)
      if (!fg) continue
      // 强调色克制：统计彩色文本的色相数量（灰度不计）。
      const max = Math.max(fg.r, fg.g, fg.b)
      const min = Math.min(fg.r, fg.g, fg.b)
      if (max - min > 28) out.chroma[cs.color] = (out.chroma[cs.color] || 0) + 1
      // 对比度：只检查 ≥13px 的真实文本；11px 轴标签/注释按 DSH caption 规范豁免。
      if (!(el instanceof SVGElement) && parseFloat(fs) >= 13 && fg.a > 0.4) {
        const bg = bgOf(el)
        const c = ratio(over(fg, bg), bg)
        const weightValue = parseInt(cs.fontWeight, 10) || 400
        const largeText = parseFloat(fs) >= 24 || (parseFloat(fs) >= 18.66 && weightValue >= 700)
        const threshold = largeText ? 3 : 4.5
        const label =
          el.tagName +
          ' ' +
          JSON.stringify((el.textContent || '').trim().slice(0, 14)) +
          ' ' +
          fs +
          ' ' +
          weightValue +
          ' ' +
          c.toFixed(2)
        if (c < threshold) out.contrastLow.push(label)
      }
    }

    out.chromaCount = Object.keys(out.chroma).length
    const pre = document.createElement('pre')
    pre.id = 'taste-report'
    pre.textContent = 'TASTE_JSON:' + JSON.stringify(out)
    document.body.appendChild(pre)
  }

  // 等入场动画结束（320ms）再测：否则卡片 opacity 处于 0，会被当成不可见跳过。
  const start = () => requestAnimationFrame(() => setTimeout(run, 380))
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
})()
