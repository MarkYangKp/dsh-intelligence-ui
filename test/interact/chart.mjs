// Actual DOM bounds catch collisions/clipping that SSR counts cannot detect.
// ResizeObserver is delivered during rendering, not merely when virtual timers advance.
const pause = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 100)))
setTimeout(async () => {
  const checks = []
  const check = (name, ok) => checks.push({ name, ok })
  const ticks = (el) => [...el.querySelectorAll('[data-chart-x-tick]')]
  const readable = (el) => {
    const boxes = ticks(el).map((t) => t.getBoundingClientRect())
    const plot = el.querySelector('svg').getBoundingClientRect()
    return (
      boxes.length > 0 &&
      boxes.every(
        (b, i) =>
          b.left >= plot.left && b.right <= plot.right && (!i || b.left >= boxes[i - 1].right + 11)
      )
    )
  }
  try {
    const chart = document.getElementById('chart-ticks-0')
    const initial = ticks(chart).map((t) => t.title)
    check(
      'Chart 紧凑 240px：刻度 ≤4，首尾保留，10 个点仍在',
      initial.length <= 4 &&
        initial[0] === '22:16' &&
        initial.at(-1) === '22:25' &&
        chart.querySelectorAll('circle').length === 10
    )
    check(
      'Chart 全部边界样例：标签不重叠、不越界',
      [...document.querySelectorAll('[id^="chart-ticks-"]')].every(readable)
    )
    check(
      'Chart y 轴 0.85 的完整文字位于容器内',
      [...chart.querySelectorAll('[data-chart-y-tick]')].some(
        (t) =>
          t.textContent === '0.85' &&
          t.getBoundingClientRect().left >= chart.getBoundingClientRect().left
      )
    )
    const button = chart.querySelector('button')
    const height = chart.querySelector('svg').getBoundingClientRect().height
    button.click()
    await pause()
    check(
      'Chart 展开：增高且窄容器刻度仍不重叠',
      button.getAttribute('aria-expanded') === 'true' &&
        chart.querySelector('svg').getBoundingClientRect().height > height * 1.2 &&
        readable(chart) &&
        ticks(chart).length === initial.length
    )
    chart.style.width = '480px'
    await pause()
    check(
      'Chart 展开后改为 480px：实测宽度增加可见刻度',
      ticks(chart).length > initial.length && readable(chart)
    )
    button.click()
    await pause()
    check(
      'Chart 收起：继续使用实际宽度，全部数据点保留',
      button.getAttribute('aria-expanded') === 'false' &&
        ticks(chart).length > initial.length &&
        readable(chart) &&
        chart.querySelectorAll('circle').length === 10
    )
    chart.style.width = '240px'
    await pause()
    check(
      'Chart 再缩窄：恢复同一组刻度',
      readable(chart) &&
        JSON.stringify(ticks(chart).map((t) => t.title)) === JSON.stringify(initial)
    )
  } catch (error) {
    check('Chart browser error: ' + error.message, false)
  }
  const report = document.createElement('pre')
  report.textContent = 'CHART_REPORT:' + JSON.stringify({ checks })
  document.body.appendChild(report)
}, 600)
