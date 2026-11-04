// SlotCore-compatible test fixture: re-implements the observable registration behaviour of the
// host slot engine so the "registration must not crash" regression runs without a host install.
//
// 对照的行为（2026-10 版 DSH）：
// - record(name) 登记一个插槽规格（kind/scope），返回可写 spec 的记录
// - register({name, key?, priority?, children?}, component) 注册条目；
//   子插槽一旦被某个父声明，另一个父再声明同名子插槽会抛 "already declared"
// - entriesOfSlot(name) 按 priority 升序返回条目（数字小者优先）
// - spec(name) 返回已声明的规格；未声明返回 undefined
//
// The real engine lives in the host app; this fixture only models the plugin registration path.

export class SlotCore {
  #records = new Map()
  #entries = new Map()

  record(name) {
    if (!this.#records.has(name)) this.#records.set(name, { spec: undefined, owner: null })
    return this.#records.get(name)
  }

  spec(name) {
    return this.#records.get(name)?.spec
  }

  register(options, component) {
    const { name, key, priority = 0, children } = options
    if (!name) throw new Error('slot name is required')
    // 子插槽声明冲突（真实实现会在这里抛 already-declared）
    for (const child of Object.keys(children ?? {})) {
      const existing = this.#records.get(child)
      if (existing?.owner && existing.owner !== name) {
        throw new Error(`slot ${child} is already declared`)
      }
      const rec = this.record(child)
      rec.spec = children[child]
      rec.owner = name
    }
    const slot = this.#entries.get(name) ?? []
    slot.push({ options: { ...options, priority }, component })
    slot.sort((a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0))
    this.#entries.set(name, slot)
  }

  entriesOfSlot(name) {
    return this.#entries.get(name) ?? []
  }
}

export default SlotCore
