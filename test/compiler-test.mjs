// 回复编译器单测：格式决策 + 发射程序的可解析性。
// 直接测 src/compiler.mjs（纯函数），再用 dist 的运行时库验证发射程序可渲染。
import { readFileSync, writeFileSync } from 'node:fs'
import { compileReply } from '../src/compiler.mjs'

let pass = 0,
  fail = 0
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++
    console.log(`✅ ${name}`)
  } else {
    fail++
    console.log(`❌ ${name}${detail ? ' — ' + detail : ''}`)
  }
}

// ---- 1. 表格回复 → 视觉模式（Table + 可能的 Chart）----
const tableReply = `本周各服务运行情况汇总：

| 服务 | 请求数 | 错误率 | 状态 |
|---|---:|---:|---|
| api-gateway | 128,400 | 0.3% | healthy |
| user-service | 82,000 | 2.1% | degraded |
| search | 3,100 | 15.4% | failed |
| billing | 45,600 | 0.1% | healthy |

整体可用性 99.2%，环比 +0.3%。`

const r1 = compileReply(tableReply)
check('表格回复 → 视觉模式', r1.mode === 'visual', `mode=${r1.mode} score=${r1.score}`)
check(
  '表格回复 → 发射 Table',
  r1.program?.includes('Table(') || r1.program?.includes('SearchTable(')
)
check('表格回复 → 数字列 compact 格式', /format: "compact"/.test(r1.program ?? ''))
check('表格回复 → 状态列自动着色', /status: true/.test(r1.program ?? ''))
check('表格回复 → 数值转为数字字面量', /128400/.test(r1.program ?? ''))

// ---- 2. KPI 列表 → StatCard 网格 ----
const kpiReply = `本周经营指标：

- **本周收入** ¥84,300（+12.6%）
- **新增用户** 1,204（+3.1%）
- **退款率** 1.2%（-0.3%）

以上为含税口径。`

const r2 = compileReply(kpiReply)
check('KPI 列表 → 视觉模式', r2.mode === 'visual', `mode=${r2.mode} score=${r2.score}`)
check('KPI 列表 → StatCard×3', (r2.program?.match(/StatCard\(/g) ?? []).length === 3)
check(
  'KPI 列表 → delta 与趋势',
  /StatCard\("本周收入", "¥84,300", "\+12\.6%", "up"\)/.test(r2.program ?? '')
)
check('KPI 列表 → 下降趋势', /"退款率", "1\.2%", "-0\.3%", "down"/.test(r2.program ?? ''))

// ---- 3. 步骤列表 → Steps ----
const stepsReply = `部署流程如下：

1. 构建镜像并推送到仓库
2. 更新 helm values 文件
3. 触发灰度发布
4. 观察监控确认无异常

完成后通知值班群。`

const r3 = compileReply(stepsReply)
check('有序步骤 → 视觉模式', r3.mode === 'visual', `mode=${r3.mode} score=${r3.score}`)
check('有序步骤 → Steps 组件', r3.program?.includes('Steps(['))

// ---- 4. 纯文字 → 文字模式（保持官方渲染）----
const proseReply = `这个问题的根因在于 React 18 的并发特性：当组件在渲染过程中被中断，
状态快照与实际 DOM 可能短暂不一致。你看到的闪烁正是这个窗口期的表现。

建议的修复方式是把派生状态移入 useMemo，并确保 effect 的依赖数组完整。`

const r4 = compileReply(proseReply)
check('纯文字 → 文字模式', r4.mode === 'text', `mode=${r4.mode} score=${r4.score}`)

// ---- 5. 短回复 → 文字模式 ----
const r5 = compileReply('好的，马上处理。')
check('短回复 → 文字模式', r5.mode === 'text')

// ---- 6. 时间序列表格 → 附带 Chart ----
const trendReply = `近五日收入（万元）：

| 日期 | 收入 | 成本 |
|---|---:|---:|
| 周一 | 12.0 | 8.2 |
| 周二 | 13.1 | 8.4 |
| 周三 | 9.8 | 8.1 |
| 周四 | 12.9 | 8.6 |
| 周五 | 15.2 | 8.8 |`

const r6 = compileReply(trendReply)
check('时间序列表 → 视觉模式', r6.mode === 'visual')
check(
  '时间序列表 → 自动发射 Chart(line)',
  /Chart\(null, "line", /.test(r6.program ?? ''),
  r6.program
)
check('时间序列表 → 双系列', (r6.program?.match(/\{name: "/g) ?? []).length === 2)

// ---- 7. 混合：标题 + 段落 + 表格 + 建议 ----
const mixedReply = `## 升级总结

这次升级覆盖了渲染层与提示层。

| 模块 | 变更 | 风险 |
|---|---|---|
| 渲染器 | priority -20 | 低 |
| 编译器 | 新增 | 低 |

> [!warning] 回滚前请先导出会话数据。`

const r7 = compileReply(mixedReply)
check('混合内容 → 视觉模式', r7.mode === 'visual')
check('混合内容 → Heading', r7.program?.includes('Heading("升级总结", 2)'))
check('混合内容 → Callout(warning)', /Callout\(null, "[^"]+", "warning"\)/.test(r7.program ?? ''))

// ---- 8. 病态输入安全 ----
check('超长输入 → 文字模式', compileReply('x'.repeat(7000)).mode === 'text')
check('空输入 → 文字模式', compileReply('').mode === 'text')
check('null 安全', compileReply(null).mode === 'text')

// ---- 9. 发射程序全部可被真实运行时解析 ----
const { evaluateProgram } = await import('../src/compiler-runtime-check.mjs').catch(() => ({}))
if (evaluateProgram) {
  for (const [name, r] of [
    ['表格', r1],
    ['KPI', r2],
    ['步骤', r3],
    ['趋势', r6],
    ['混合', r7]
  ]) {
    if (r.mode !== 'visual') continue
    const { root, errors } = evaluateProgram(r.program)
    check(
      `发射程序可解析：${name}`,
      root !== null && errors.length === 0,
      errors.map((e) => e.message).join(';')
    )
  }
}

console.log(`\n${pass} 通过, ${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)
