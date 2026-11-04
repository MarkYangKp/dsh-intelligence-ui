# test/corpus

本目录是 OpenUI Lang 的**合成回归语料**，用于守护解析、求值到渲染的整条管线的健壮性。

- 全部 56 段程序（`001.openui`–`056.openui`）都是**自编的合成示例**，主题为通用的业务 / 运维 / 技术 / 教学内容；**不是**从任何用户会话、聊天记录或日志中抽取的真实内容。
- 语料刻意覆盖模型输出中常见的写法：命名参数（`Chart(title=...)`）、冒号参数（`Heading(text: ..., level: ...)`）、位置尺寸 token（`Text("...", "sm")`）、`null` / `None` / `True` / `undefined` 占位、枚举同义词、裸子元素、`@Each` / `@Sum` / `@Sort` 内联循环、空数组、超长中文文本、合法深嵌套等。
- 每个文件都是一个合法程序（首行 `root = Stack([...])`），由 `test/corpus-test.mjs` 逐个求值并做服务端渲染，要求**零错误**。
- 新增或修改语料时：这里只放合法程序（故意非法的输入属于 `test/adversarial-test.mjs`），并运行 `node test/corpus-test.mjs` 确认 56/56 通过。

本目录不含任何真实姓名、主机名、IP 地址、URL、令牌、提交哈希或内部项目信息。
