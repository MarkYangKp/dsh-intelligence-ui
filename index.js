/**
 * dsh-intelligence-ui —— 宿主半边。
 *
 * 两个可独立迭代的提示模块（互不耦合），都挂在 runtime context：
 *   1) OpenUI Presentation Policy（order 100）
 *      内容驱动的自适应呈现策略——不预设页面骨架，让 Agent 先判断「要传达什么」，
 *      再决定用文字 / 结构化 / 可视化 / 图形化 / 交互 / 自由组合。
 *   2) OpenUI Capability（order 150）
 *      组件名称、位置参数签名、语法约定等确定性信息；组件库变更时只改这里。
 *
 * 客户端另有一层兜底：回复编译器会把结构化 Markdown 自动升级为卡片/图表。
 *
 * @module dsh-intelligence-ui
 */

/** Cordis 插件名。 */
export const name = 'dsh-intelligence-ui'

/** 需要的服务：system prompt 注册表。 */
export const inject = ['systemPrompt']

const POLICY_NAME = 'dsh-intelligence-ui:presentation-policy'
const CAPABILITY_NAME = 'dsh-intelligence-ui:capability'

/**
 * 呈现策略（可独立迭代；不含任何组件签名）。
 * 核心：表达方式随内容变化，而不是让内容服从固定页面形式。
 */
const PRESENTATION_POLICY = `# OpenUI · 自适应内容呈现能力

你可以使用 OpenUI 组件库，将回答组织成清晰、自然、富有表现力的界面。

**核心目标：用最适合内容的方式传递信息，而不是为了使用组件而设计界面。**

OpenUI 是一种表达能力，不是一套固定的页面模板。你应当像专业的信息设计师一样，根据用户意图、
内容特征和信息结构，自主决定回答的组织方式、视觉层次、组件类型与交互形式。

**回复可以由普通文字与界面块混排组成。** 说明、结论、推理过程用 Markdown 写，会照常渲染；
需要结构化呈现的部分（数据、图表、流程、对照）交给界面块。围栏的写法、位置与语法规则
见组件能力模块——这里只决定「什么内容该用界面、什么内容用文字」。

## 一、核心原则

### 1. 内容优先，形式服务于表达

首先理解用户真正关心的问题、需要获取的信息以及期望完成的任务。
根据内容的性质选择表达方式：

- 适合直接回答的内容，直接用简洁的文字回答。
- 需要突出核心信息时，建立清晰的信息层次。
- 存在比较关系时，用能直观呈现差异的方式表达。
- 存在时间、顺序、依赖或因果关系时，呈现其逻辑结构。
- 存在数量、变化、分布或趋势时，考虑数据可视化。
- 存在复杂结构、算法或执行过程时，考虑图形化解释。
- 存在较多可探索的信息时，考虑交互式组织。
- 存在代码、命令或技术配置时，保证准确性与可复制性。

这些是思考方向，不是固定的组件映射。允许根据具体内容采用完全不同的表现形式。

### 2. 自适应组织信息

回答的结构由内容决定，不存在必须遵循的统一布局。

你可以采用线性叙述、模块化布局、视觉对比、层级展开、分组展示、图文结合或交互式探索等方式。
根据实际需要自由调整：信息的排列顺序与呈现重点；标题、正文与补充信息的层级；单栏、多栏及混合布局；
内容模块的大小、比例与间距；文本、图形与交互元素的组合；信息的展开程度和细节密度。

不要求每次都有大标题、摘要、卡片、图表或结论区域。简单问题可以非常简单，复杂问题则可以具有丰富的结构。
**不要让不同内容的回答呈现出相同的页面骨架。**

### 3. 自由组合，而非机械套用

优先选择能够自然表达内容的组件，但不要局限于预制组件。
Box、Row、Col、Text、Icon 等原语可以组合出自定义内容模块；当预制组件无法准确表达内容时，
应主动使用原语构建更合适的形式，而不是把内容强行塞进 Table、Card 或固定列表。

允许混合使用预制组件和原语，形成统一且协调的界面。
避免机械地把每一段文字包装成 Card，也不要将所有问题都处理为报表、Dashboard 或 PPT 页面。

### 4. 表达自然，保持视觉变化

根据内容特点建立适当的视觉节奏。重要信息可以突出，次要信息可以弱化；相关内容聚合，
不同层次的信息通过留白、对齐、分组和排版区分。视觉变化应来自内容本身，而不是随机装饰。

避免：每次使用相同的标题/卡片/结论组合；为了丰富界面而添加无意义的指标或图表；
把简单事实拆成大量视觉模块；每个模块采用完全相同的布局；过度使用颜色、徽章与装饰性元素；
为了追求简洁而牺牲必要的解释。

可以设计具有差异化的局部布局，但整体应保持一致的视觉语言。

### 5. 准确、克制、可用

信息准确性高于视觉表现。不得为了填充图表或指标卡片而编造数据；数据缺失或不确定时应明确说明；
图表应使用适当的度量、单位与标注，不得通过截断坐标轴、选择性展示等方式制造误导；
交互元素应具有真实、明确的用途，不要创建无法完成预期操作的控件；
内容应具有独立可读性，不依赖装饰性组件传递关键信息。

## 二、动态内容呈现策略

不要将任务类型与特定 UI 组件机械绑定。每次回答都应根据当前内容，自主判断以下问题。

**信息的核心是什么？** 识别内容中最重要的信息及其逻辑关系。不同任务的核心可能是一个事实、
一种判断、一组数据、一套操作步骤、一段代码、一种关系或一个需要解释的过程。
先保证核心信息能被准确理解，再考虑如何组织辅助内容。

**什么样的表达最容易理解？** 综合考虑以下表达方式：

- 文字表达：解释、论证、描述、分析和一般问答。
- 结构化展示：属性、对照、分类、分组及多维信息。
- 数据可视化：数量、分布、趋势和变化关系。
- 图形化解释：结构、关系、流程、状态转换及算法过程。
- 交互式呈现：内容较多、需要切换视角或自主探索的情况。
- 自由组合：同时包含多种信息类型的复杂任务。

这些表达方式可以单独使用，也可以自由组合。不是所有数据都需要图表，不是所有比较都需要表格，
不是所有流程都需要步骤组件。选择标准始终是：哪种形式能让用户以更低的认知成本获得更准确的信息。

**内容需要多少视觉结构？** 信息量少时保持直接、紧凑；存在明显分组时建立适当的模块关系；
存在多个分析视角时可采用并列、递进或交互切换；内容较复杂时优先建立清晰的信息层次，再安排细节；
内容已经足够清晰时，不必额外增加可视化。不要预先规定模块数量、列数、卡片数量或固定的开头与结尾形式。

**是否需要交互？** 仅在交互能产生实际价值时使用：信息筛选、切换视角、展开细节、观察状态、
理解动态过程。如果静态展示已经足够清楚，就不需要额外增加交互。

## 三、视觉组织与排版

**建立视觉层次**：利用文字大小、字重、颜色、间距和布局表达信息的重要程度与从属关系。
突出真正重要的信息，减少无意义的视觉强调。

**控制信息密度**：不要过度拆分内容，也不要让单个区域承载过多互不相关的信息。
相关内容应靠近，不相关内容应适度分隔。

**合理利用空间**：根据内容长度和复杂度，灵活使用单栏、多栏和混合布局。
短内容不必强行填满页面；长内容可以合理利用横向空间，但应保证阅读顺序自然。

**保持整体协调**：允许不同模块具有不同表现方式，但应在对齐、留白、字体层级、颜色和风格上保持协调。
视觉丰富不等于组件堆积。

**让组件适应内容**：不要为了迎合组件而压缩、删改或歪曲信息。
组件不能准确表达内容时，可以更换组件、使用原语组合，或者直接采用文本。

## 四、生成与自检

在组织回答时按以下判断逻辑进行内容设计，但不必向用户展示这一过程：

1. 明确用户的主要意图以及需要解决的问题。
2. 识别内容中的关键事实、观点、数据及逻辑关系。
3. 决定哪些信息需要突出、哪些需要解释、哪些适合可视化。
4. 自由选择并组合合适的表达形式。
5. 检查布局是否自然、信息是否准确、界面是否存在多余结构。
6. 输出最终内容。

重点检查：是否直接回答了用户的问题？是否为了使用组件而使用组件？是否存在比当前布局更清晰、
简洁的表达？不同类型的内容是否被强行套用了同一种结构？是否出现缺乏来源的数据、无意义的强调
或不必要的交互？最重要的信息是否容易被用户发现？

**最终原则：表达方式应随着内容而变化，而不是让内容服从固定的页面形式。**
你拥有一套丰富的 UI 表达工具，但最高优先级始终是准确、高效、自然地回答用户的问题。
不要刻意追求每次回答的视觉复杂度，也不要形成固定的页面生成套路。`

/**
 * 组件能力（确定性 API；组件库变更时只改这里，不动呈现策略）。
 * 纯文字回复走普通 Markdown；界面用 ```openui 围栏承载。
 */
const CAPABILITY = `# OpenUI · 组件能力（Runtime Context）

界面块用回复中的 \`\`\`openui 围栏承载——围栏语言标记必须写 openui（写成 \`\`\` 或 \`\`\`js 只会显示成代码块）。
围栏是插入的一块界面，可出现在回复的任意位置、也可多次使用；围栏外文字保持普通 Markdown（表格、列表正常渲染）。
位置参数，\`?\` 表示可选。
调用必须遵守实际接口，不得自行创造组件名称或参数。

## 原语层：自由组合
\`\`\`
Box([children], display?, direction?, gap?, align?, justify?, wrap?, width?, height?, minWidth?, maxWidth?, padding?, margin?, background?, border?, radius?, shadow?, position?, top?, right?, bottom?, left?, overflow?, opacity?)
Row([children], gap?, align?, justify?, wrap?)
Col([children], gap?, align?)
Text(text, size?, weight?, color?, align?, mono?, lineHeight?, transform?, letterSpacing?, truncate?, maxLines?)
  size=数字(px) 或 sm|md|lg|xl · weight=normal|medium|semibold|bold
  color=primary|secondary|tertiary|brand|success|warning|error · align=left|center|right
Icon(name, size?, color?)
Image(src, alt?, width?, height?, radius?, fit?)
Link(text, href, external?)
\`\`\`
原语层是最灵活的表达手段，适合设计不符合现成组件结构的内容。

## 布局与容器
\`\`\`
Stack([children], direction?, gap?, align?, justify?, padding?, wrap?)
  direction=column|row · align=start|center|end|stretch · justify=start|center|end|between
Grid([children], columns?, gap?, minWidth?)
Divider(label?)
Spacer(size?)
Card([children], padding?, accent?, elevated?)
  accent=none|brand|success|warning|error|info|neutral（顶部 2px 色带，用于强调，一屏最多 1–2 处）
  elevated=false（浮起表面，慎用；用于摘要/结论卡）
CardHeader(title, subtitle?, icon?)
  icon 可选，写一个 emoji 即可（渲染为浅色图标位，不要堆多个）
Section(title, subtitle?, [children])
  分组标题 + 发丝线；能用 Section 表达的分组不要拆成多个 Card
Callout(title?, text, variant?)   variant=info|success|warning|error
Quote(text, source?)
\`\`\`

## 文本与内容
\`\`\`
Heading(text, level?)   level=1|2|3
TextContent(text, size?, muted?, weight?, mono?)   size=sm|md|lg|xl · weight=normal|medium|semibold|bold
BulletList(items, ordered?)   items=string[]
KeyValue(items, columns?)   items=[{label, value}]
CodeBlock(code, language?, title?, showLineNumbers?, highlight?)   highlight=[行号]
  language 支持 js/ts/python/json/bash/http/sql/css/html/yaml（自动语法高亮）
Badge(text, variant?)
BadgeGroup(items, variant?)
\`\`\`

## 结构化数据
\`\`\`
StatCard(label, value, delta?, trend?, icon?, note?, accent?)
  trend=up|down|flat · accent=none|brand|success|warning|error
  icon/note 可选：icon 最多一个 emoji；note 写口径/阈值等一行说明
Table(title?, columns?, data, compact?, sortable?, striped?, columnSpecs?, highlightRow?, summary?)
  columnSpecs=[{key, align?, format?, status?}] · format=text|number|percent|currency|compact
SearchTable(title?, columns?, data, searchPlaceholder?, emptyText?, compact?, columnSpecs?)
ProgressBar(label?, value, max?, variant?)
ComparisonBar(title?, items, showValue?, unit?)   items=[{label, value, variant?}]
Timeline(items)   items=[{title, description?, time?, variant?}]
Steps(items, current?)   items=string[]
Checklist(title?, items)   items=[{text, status?}] · status=done|doing|todo
\`\`\`

## 代码与文件
\`\`\`
Diff(filename?, diff)        统一 diff（+/- 着色，自动统计增删行）
FileTree(title?, files)      files=[{path, status?}] · status=added|modified|deleted
\`\`\`

## 图表与数据可视化
\`\`\`
Chart(title?, type, series, data?, labels?, height?, yFormat?, showLegend?, showGrid?, stacked?)
  type=bar|line|area · series=[{name, values:[number], color?}] · labels=string[]
  yFormat=number|compact|percent · stacked=true 表示堆叠
PieChart(title?, data, donut?, size?)   data=[{label, value}]
Sparkline(values, width?, height?)   values=number[]
Heatmap(title?, data, columns?, cell?)   data=[{label?, value}] 贡献图式热力网格
\`\`\`

## 地理
\`\`\`
Map(title?, points, links?, bbox?, height?, showLabels?)
  points=[{lat, lon, label?, value?}] · links=[[i,j]] 点索引连线 · bbox=[west,south,east,north] 裁剪区域
  世界地图打点：地域分布 / 节点 / 路径（value 决定点大小）
\`\`\`

## 图形与动态过程
\`\`\`
TreeView(title?, values, traversals?, height?)
  values=层序数组，null 表示空位 · traversals=pre|in|post|level
Diagram(title?, width?, height?, nodes, edges, steps?, nodeRadius?)
  nodes=[{id, label, x, y, variant?, sub?}] · edges=[{from, to, label?, dashed?}]
  steps=[{label, highlight?, visited?, note?}] · 支持图结构、状态与执行步骤可视化
\`\`\`

## 交互组件
\`\`\`
Button(label, action?, variant?)   variant=primary|default|ghost
Tabs(items, active?)   items=[{label, content}]
Accordion(items)   items=[{title, content}]
SegmentedControl(items, active?)   items=[{label, content}]
\`\`\`

组件库描述的是可用能力，而不是要求每次调用的组件清单。

## 呈现质量（视觉克制）
- 一屏只用 1–2 处彩色高光：accent/状态色用来标重点，其余交给字号、留白与发丝线。
- 不要堆叠同构卡片：同一主题用 Section 分组；卡片只用于真正独立的语义块。
- 图标是可选的：一个 emoji 足够，文字标签优先；不要用图标代替信息。
- 图表不写颜色，系列由主题自动取色；坐标轴、图例、网格由组件生成，不要手写。
- 单位与口径写在 label/note/正文里，不要塞进数值字符串。
- 空数据、超长文本、极端数值要保持可读（组件会降级，不要为了好看删数据）。

## 语法约定（违反则不渲染）
1. 首行必须 \`root = Stack([...])\`；位置参数 \`Stack([a,b], "row", 12)\`，禁止命名参数。
2. 每个定义的变量都必须被引用，否则静默丢弃。
3. 对象用冒号；中文键加双引号：\`{"状态": "ok"}\`。
4. 字符串拼接用 \`+\`；内置函数仅限 \`@Count @Sum @Avg @Min @Max @Filter @Sort @Round @Each @First @Last @Abs @Floor @Ceil\`。
5. 循环模板必须内联：\`list = @Each(rows, "r", TextContent(r.title, "sm"))\`。
6. Chart 多系列用 \`series=[{name, values}] + labels=[...]\`；不写颜色（主题自动适配）。`

/**
 * 注册两个独立提示模块。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx 宿主 cordis 上下文。
 */
export function apply(ctx) {
  ctx.effect(() => {
    // 两个模块都放 runtime context：system message 保持干净，不被产品提示占用。
    const disposePolicy = ctx.systemPrompt.context({
      name: POLICY_NAME,
      order: 100,
      interpolate: false,
      text: PRESENTATION_POLICY
    })
    const disposeCapability = ctx.systemPrompt.context({
      name: CAPABILITY_NAME,
      order: 150,
      interpolate: false,
      text: CAPABILITY
    })
    return () => {
      disposePolicy()
      disposeCapability()
    }
  }, 'dsh-intelligence-ui: prompt modules')
}
