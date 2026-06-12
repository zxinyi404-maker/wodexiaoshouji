;(function () {
  // ══════════════════════════════════════════════════════
  //  记忆曲线·简  v1.2.0
  //  新增：核心记忆编辑区（手动输入 / AI 重生成）
  //  其他：无向量依赖、保护重要记忆、按权重排序
  // ══════════════════════════════════════════════════════

  const PLUGIN_ID  = "memory-curve-lite"
  const APP_HOME   = "mcl-home"
  const APP_COG    = "mcl-cognition"
  const APP_RECALL = "mcl-recall"

  // ── 遗忘曲线参数 ────────────────────────────────
  const STABILITY = { emotional: 60, important: 21, normal: 7, trivial: 2 }
  const EMOTIONAL_KW = ["伤心","难过","哭","开心","感动","害怕","愤怒","爱","恨",
                        "心疼","失望","惊喜","触动","心理阴影","委屈","孤独","温暖","痛苦","后悔"]
  const IMPORTANT_KW = ["喜欢","讨厌","习惯","偏好","总是","从不","生日","名字","工作",
                        "家人","朋友","梦想","目标","不喜欢","最爱","害怕"]

  // ── 工具函数 ─────────────────────────────────────
  function classifyText(t) {
    t = t || ""
    if (EMOTIONAL_KW.some(k => t.includes(k))) return "emotional"
    if (IMPORTANT_KW.some(k => t.includes(k))) return "important"
    if (t.length > 25) return "normal"
    return "trivial"
  }

  function calcRetention(mem, overrides) {
    const text = mem.summaryText || mem.action || mem.text || ""
    const kind = (overrides || {})[mem.id] || classifyText(text)
    const S    = STABILITY[kind] || 7
    let days   = 0
    const raw  = mem.createdAt || mem.timestamp
    if (raw) {
      const ts = typeof raw === "number" ? raw : Date.parse(raw)
      if (!isNaN(ts)) days = (Date.now() - ts) / 86400000
    }
    return Math.max(0, Math.round(Math.exp(-days / S) * 100))
  }

  function retLabel(r) { return r > 70 ? "清晰" : r > 40 ? "模糊" : r > 20 ? "淡化" : "即将遗忘" }
  function kindLabel(k) { return ({ emotional: "情感", important: "重要", normal: "普通", trivial: "琐碎" }[k] || k) }

  function getWeight(mem, overrides) {
    const kind = overrides[mem.id] || classifyText(mem.summaryText || mem.action || mem.text || "")
    return { emotional: 4, important: 3, normal: 2, trivial: 1 }[kind] || 0
  }

  function isProtected(mem, overrides) {
    const kind = overrides[mem.id] || classifyText(mem.summaryText || mem.action || mem.text || "")
    return kind === "emotional" || kind === "important"
  }

  function fmtAge(mem) {
    const raw = mem.createdAt || mem.timestamp
    if (!raw) return ""
    const ts = typeof raw === "number" ? raw : Date.parse(raw)
    if (isNaN(ts)) return ""
    const d = Math.floor((Date.now() - ts) / 86400000)
    if (d === 0) return "今天"
    if (d === 1) return "昨天"
    if (d < 7) return `${d}天前`
    if (d < 30) return `${Math.floor(d / 7)}周前`
    return `${Math.floor(d / 30)}个月前`
  }
  function escHtml(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") }

  // ── 极简样式（新增核心编辑区样式）────────────────
  const STYLE_ID  = "mcl-style"
  const STYLE_CSS = `
.mcl-root{display:flex;flex-direction:column;height:100%;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;font-size:14px;background:#0c0c0e;color:#e4e4f0}
.mcl-header{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0}
.mcl-header h2{margin:0;font-size:15px;font-weight:600;flex:1}
.mcl-back{background:none;border:none;color:#e4e4f0;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:15px;opacity:.7}
.mcl-back:hover{opacity:1;background:rgba(255,255,255,.08)}
.mcl-controls{display:flex;gap:6px;padding:8px 16px;flex-shrink:0;flex-wrap:wrap;align-items:center}
.mcl-select{flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#e4e4f0;border-radius:6px;padding:5px 10px;font-size:13px}
.mcl-btn{background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.3);color:#a78bfa;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;white-space:nowrap}
.mcl-btn:hover{background:rgba(167,139,250,.28)}
.mcl-btn:disabled{opacity:.35;cursor:not-allowed}
.mcl-btn.red{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.3);color:#f87171}
.mcl-btn.red:hover{background:rgba(248,113,113,.2)}
.mcl-btn.green{background:rgba(74,222,128,.1);border-color:rgba(74,222,128,.3);color:#4ade80}
.mcl-btn.green:hover{background:rgba(74,222,128,.2)}
.mcl-stat-row{display:flex;gap:6px;padding:6px 16px;flex-shrink:0}
.mcl-stat{flex:1;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:6px 4px;text-align:center;font-size:11px;opacity:.85}
.mcl-stat strong{display:block;font-size:17px;font-weight:700;margin-bottom:1px}
.mcl-list{flex:1;overflow-y:auto;padding:6px 16px 20px}
.mcl-empty{text-align:center;opacity:.3;padding:40px 0;font-size:13px}
.mcl-loading{text-align:center;opacity:.4;padding:30px 0;font-size:13px}
.mcl-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px;margin-bottom:6px}
.mcl-card-text{font-size:13px;line-height:1.5;margin-bottom:6px}
.mcl-kind-tag{display:inline-block;font-size:10px;padding:1px 6px;border-radius:3px;background:rgba(167,139,250,.14);color:#c4b5fd}
.mcl-bar-row{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.mcl-bar{flex:1;height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}
.mcl-bar-fill{height:100%;border-radius:2px;transition:width .3s}
.mcl-bar-label{font-size:10px;width:60px;text-align:right}
.mcl-card-meta{font-size:10px;opacity:.3;margin-bottom:4px}
.mcl-card-actions{display:flex;gap:4px;flex-wrap:wrap}
.mcl-mini{font-size:10px;padding:2px 7px;border-radius:4px;cursor:pointer;border:1px solid;transition:background .1s}
.mcl-mini.g{background:rgba(74,222,128,.09);border-color:rgba(74,222,128,.25);color:#4ade80}
.mcl-mini.g:hover{background:rgba(74,222,128,.18)}
.mcl-mini.o{background:rgba(251,146,60,.09);border-color:rgba(251,146,60,.25);color:#fb923c}
.mcl-mini.o:hover{background:rgba(251,146,60,.18)}
.mcl-mini.r{background:rgba(248,113,113,.09);border-color:rgba(248,113,113,.2);color:#f87171}
.mcl-mini.r:hover{background:rgba(248,113,113,.18)}
.mcl-dist-wrap{padding:0 16px 6px;flex-shrink:0}
.mcl-dist{display:flex;height:5px;border-radius:3px;overflow:hidden;gap:1px}
.mcl-dist-seg{border-radius:1px;transition:flex .3s}
.mcl-dist-labels{display:flex;justify-content:space-between;margin-top:2px;font-size:9px;opacity:.35}
.mcl-msg-sender{font-weight:600;font-size:11px;opacity:.6;margin-bottom:2px}
.mcl-msg-text{font-size:12px;line-height:1.5}
.mcl-cog-body{flex:1;overflow-y:auto;padding:14px 16px}
.mcl-cog-hint{text-align:center;opacity:.35;padding:30px 20px;font-size:13px}
.mcl-cog-section{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px;margin-bottom:8px}
.mcl-cog-section h3{margin:0 0 6px;font-size:13px;color:#c4b5fd;font-weight:600}
.mcl-cog-section p{margin:0;font-size:13px;line-height:1.7;opacity:.88;white-space:pre-wrap}
.mcl-thinking{text-align:center;opacity:.4;padding:24px;font-size:12px;font-style:italic}
.mcl-cog-meta{font-size:10px;opacity:.25;padding:4px 0 8px;text-align:center}
.mcl-cache-bar{display:flex;align-items:center;gap:8px;padding:6px 12px;margin-bottom:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px;font-size:11px;opacity:.7}
.mcl-cache-bar span{flex:1}
/* recall */
.mcl-rc-root{display:flex;flex-direction:column;height:100%;overflow:hidden;font-family:system-ui,-apple-ui,sans-serif;background:#0c0c0e;color:#e4e4f0;font-size:14px}
.mcl-rc-search-bar{display:flex;gap:6px;padding:8px 16px;flex-shrink:0;align-items:center}
.mcl-rc-input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#e4e4f0;border-radius:6px;padding:5px 10px;font-size:13px;outline:none}
.mcl-rc-input:focus{border-color:#a78bfa}
.mcl-rc-row{display:flex;gap:4px;padding:4px 16px;flex-wrap:wrap;align-items:center}
.mcl-rc-item{padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
.mcl-rc-code{font-size:10px;color:#8585a0;font-family:monospace;letter-spacing:.5px}
.mcl-rc-body{font-size:12px;line-height:1.6;margin:4px 0 6px;word-break:break-word}
.mcl-rc-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:10px}
.mcl-rc-chip{padding:1px 5px;border-radius:3px}
.mcl-rc-chip.green{color:#4ade80;border:1px solid rgba(74,222,128,.2)}
.mcl-rc-chip.yellow{color:#facc15;border:1px solid rgba(250,204,21,.2)}
.mcl-rc-chip.orange{color:#fb923c;border:1px solid rgba(251,146,60,.2)}
.mcl-rc-chip.red{color:#f87171;border:1px solid rgba(248,113,113,.2)}
.mcl-rc-rel{font-size:10px;margin-left:4px;color:#a78bfa}
.mcl-rc-stats{padding:6px 16px;display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:#8585a0;border-top:1px solid rgba(255,255,255,.06);flex-shrink:0}
.mcl-rc-inject{background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.25);color:#a78bfa;padding:8px 16px;flex-shrink:0;cursor:pointer;font-size:11px;text-align:center}
.mcl-rc-inject:hover{background:rgba(167,139,250,.2)}
.protected-icon{color:#4ade80;font-size:11px;margin-left:4px}
/* core editor */
.mcl-core{background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.2);border-radius:8px;padding:12px;margin:0 16px 8px;flex-shrink:0}
.mcl-core h3{margin:0 0 6px;font-size:13px;color:#c4b5fd;font-weight:600}
.mcl-core textarea{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#e4e4f0;border-radius:6px;padding:8px;font-size:12px;resize:vertical;min-height:60px;outline:none;box-sizing:border-box}
.mcl-core textarea:focus{border-color:#a78bfa}
.mcl-core-actions{display:flex;gap:6px;margin-top:6px}
  `

  function ensureStyle() {
    if (!document.getElementById(STYLE_ID)) {
      const s = document.createElement("style")
      s.id = STYLE_ID
      s.textContent = STYLE_CSS
      document.head.appendChild(s)
    }
  }
  function removeStyle() {
    const el = document.getElementById(STYLE_ID)
    if (el) el.remove()
  }

  // ── 加载角色列表 ──────────────────────────────────
  async function loadCharOptions(sel, roche) {
    const chars = await roche.character.list().catch(() => [])
    sel.innerHTML = '<option value="">— 选择角色 —</option>' +
      chars.map(c =>
        `<option value="${escHtml(c.id)}" data-conv="${escHtml(c.conversationId || c.id)}">${escHtml(c.handle || c.name)}</option>`
      ).join("")
    return chars
  }

  // ══════════════════════════════════════════════════════
  //  App 1: Home — 包含核心记忆编辑区 + 记忆列表
  // ══════════════════════════════════════════════════════
  async function mountHome(container, roche) {
    ensureStyle()
    container.innerHTML = `
<div class="mcl-root">
  <div class="mcl-header">
    <button class="mcl-back" id="mh-back">←</button>
    <h2>记忆曲线</h2>
    <button class="mcl-btn green" id="mh-export" style="font-size:11px;padding:3px 8px">导出</button>
    <button class="mcl-btn" id="mh-refresh" style="font-size:11px;padding:3px 8px">刷新</button>
  </div>
  <div class="mcl-controls">
    <select class="mcl-select" id="mh-char"></select>
    <button class="mcl-btn green" id="mh-bulk-emote" style="font-size:11px">批量强化情感</button>
    <button class="mcl-btn red" id="mh-apply-forget" style="font-size:11px">应用遗忘</button>
  </div>
  <!-- 核心记忆编辑区 -->
  <div class="mcl-core" id="mh-core">
    <h3>核心记忆 <span style="font-weight:normal;font-size:11px;opacity:.6">（AI 自动更新 / 手动编辑）</span></h3>
    <textarea id="mh-core-input" placeholder="加载角色后显示当前核心记忆，可在此编辑…"></textarea>
    <div class="mcl-core-actions">
      <button class="mcl-btn green" id="mh-core-save" style="font-size:11px">保存编辑</button>
      <button class="mcl-btn" id="mh-core-regen" style="font-size:11px">AI 重新生成</button>
      <button class="mcl-btn red" id="mh-core-revert" style="font-size:11px">恢复自动</button>
      <span id="mh-core-status" style="font-size:10px;opacity:.5;align-self:center"></span>
    </div>
  </div>
  <div class="mcl-dist-wrap" id="mh-dist-wrap" style="display:none">
    <div class="mcl-dist" id="mh-dist"></div>
    <div class="mcl-dist-labels"><span>清晰</span><span>模糊</span><span>淡化</span><span>遗忘</span></div>
  </div>
  <div class="mcl-stat-row" id="mh-stats"></div>
  <div class="mcl-list" id="mh-list"><div class="mcl-loading">请先选择角色</div></div>
</div>`

    let data = { facts: [], short: [], core: null }
    let overrides = (await roche.storage.get("mcl-overrides").catch(() => null)) || {}
    // 用于记录用户手动覆盖的核心记忆
    let userCoreOverride = (await roche.storage.get("mcl-userCore").catch(() => null)) || {}
    let convId = null
    let currentCharId = null

    const $ = id => container.querySelector(id)

    $("#mh-back").onclick    = () => roche.ui.closeApp()
    $("#mh-refresh").onclick = () => { if (convId) load() }

    // ── 核心记忆编辑 ─────────────────────────────
    // 保存手动编辑
    $("#mh-core-save").onclick = async () => {
      if (!convId) { roche.ui.toast("请先选择角色"); return }
      const text = $("#mh-core-input").value.trim()
      // 保存到 storage（存储角色ID对应的覆盖核心）
      userCoreOverride[currentCharId] = { text, ts: Date.now() }
      await roche.storage.set("mcl-userCore", userCoreOverride)
      $("#mh-core-status").textContent = "✓ 已保存（手动覆盖）"
      roche.ui.toast("核心记忆已保存")
    }

    // AI 重新生成
    $("#mh-core-regen").onclick = async () => {
      if (!convId) { roche.ui.toast("请先选择角色"); return }
      const input = $("#mh-core-input")
      input.placeholder = "AI 正在生成…"
      input.disabled = true
      try {
        const char = await roche.character.get(currentCharId).catch(() => null)
        const charName = char ? (char.handle || char.name) : "角色"
        const lt = await roche.memory.getLongTerm({ conversationId: convId, limit: 150 }).catch(() => ({}))
        const facts = (lt.facts || []).map(f => f.summaryText || f.action || f.text || "").filter(Boolean).slice(0, 30)
        // 调用 AI 生成
        const res = await roche.ai.chat({
          messages: [{
            role: "user",
            content: `你是 ${charName}，请用一段话总结你对面前这个人的核心印象，包括他的性格特点、重要习惯、你们之间最特别的关系。基于以下记忆（按重要性排序前30条）：\n${facts.join("\n") || "暂无具体记忆"}。直接输出总结，不要客套。`
          }],
          temperature: 0.7
        })
        input.value = res.text || "生成失败"
        // 自动保存为手动覆盖（方便用户微调）
        userCoreOverride[currentCharId] = { text: input.value, ts: Date.now() }
        await roche.storage.set("mcl-userCore", userCoreOverride)
        $("#mh-core-status").textContent = "✓ AI 生成并保存"
      } catch (e) {
        input.value = ""
        input.placeholder = `生成失败：${e.message}`
      } finally {
        input.disabled = false
        input.focus()
      }
    }

    // 恢复自动（删除手动覆盖）
    $("#mh-core-revert").onclick = async () => {
      if (!convId) return
      delete userCoreOverride[currentCharId]
      await roche.storage.set("mcl-userCore", userCoreOverride)
      // 重新加载并显示 AI 自动的核心
      loadCore()
      $("#mh-core-status").textContent = "已恢复为 AI 自动生成"
      roche.ui.toast("已恢复自动核心记忆")
    }

    // ── 导出、批量强化、应用遗忘（与之前相同）──
    $("#mh-export").onclick = () => {
      const items = data.facts
      if (!items.length) { roche.ui.toast("暂无记忆"); return }
      const text = items.map((f, i) => {
        const r = calcRetention(f, overrides)
        const k = kindLabel(overrides[f.id] || classifyText(f.summaryText || f.action || f.text || ""))
        return `[${String(i + 1).padStart(3, "0")}][${k}][${retLabel(r)} ${r}%] ${f.summaryText || f.action || f.text || "（无）"}`
      }).join("\n")
      navigator.clipboard?.writeText(text).catch(() => {})
      roche.ui.toast(`复制了 ${items.length} 条记忆`)
    }

    $("#mh-bulk-emote").onclick = async () => {
      const items = data.facts
      if (!items.length) { roche.ui.toast("请先加载记忆"); return }
      const targets = items.filter(f => {
        const t = f.summaryText || f.action || f.text || ""
        const cur = overrides[f.id] || classifyText(t)
        return cur === "emotional" || EMOTIONAL_KW.some(k => t.includes(k))
      })
      if (!targets.length) { roche.ui.toast("未发现情感记忆"); return }
      const ok = await roche.ui.confirm({ title: "批量强化", message: `将 ${targets.length} 条内存标为最高保留级别（60天）` })
      if (!ok) return
      targets.forEach(f => { overrides[f.id] = "emotional" })
      await roche.storage.set("mcl-overrides", overrides)
      renderStats(); render(); renderDist()
      roche.ui.toast("已强化")
    }

    $("#mh-apply-forget").onclick = async () => {
      if (!convId) { roche.ui.toast("请先选择角色"); return }
      const toDel = data.facts.filter(f => {
        const r = calcRetention(f, overrides)
        return r < 15 && !isProtected(f, overrides)
      })
      if (!toDel.length) { roche.ui.toast("暂无符合条件的可遗忘记忆"); return }
      const ok = await roche.ui.confirm({
        title: "应用遗忘",
        message: `将删除 ${toDel.length} 条淡化记忆（情感/重要记忆不受影响）`
      })
      if (!ok) return
      let done = 0
      for (const m of toDel) {
        try { await roche.memory.delete(m.id); done++ } catch {}
      }
      await load()
      roche.ui.toast(`已清理 ${done} 条日常记忆`)
    }

    const sel = $("#mh-char")
    await loadCharOptions(sel, roche)
    sel.onchange = () => {
      convId = sel.value || null
      currentCharId = sel.value || null
      if (convId) {
        load()
        loadCore()
      }
    }

    // 加载核心记忆（考虑用户覆盖）
    async function loadCore() {
      if (!convId) return
      // 先检查用户是否有手动覆盖
      const override = userCoreOverride[currentCharId]
      if (override && override.text) {
        $("#mh-core-input").value = override.text
        $("#mh-core-status").textContent = "手动编辑（可修改后保存）"
        return
      }
      // 否则从 AI 自动核心读取
      try {
        const lt = await roche.memory.getLongTerm({ conversationId: convId, limit: 1 }).catch(() => ({}))
        const coreText = (lt.core && (lt.core.summary || lt.core.text)) || ""
        $("#mh-core-input").value = coreText
        $("#mh-core-status").textContent = coreText ? "AI 自动生成" : "（无核心记忆）"
      } catch {
        $("#mh-core-input").value = ""
        $("#mh-core-status").textContent = "加载失败"
      }
    }

    async function load() {
      if (!convId) return
      $("#mh-list").innerHTML = '<div class="mcl-loading">读取中…</div>'
      try {
        const [lt, st] = await Promise.all([
          roche.memory.getLongTerm({ conversationId: convId, limit: 300 }),
          roche.memory.getShortTerm({ conversationId: convId, limit: 120 })
        ])
        data.facts = lt.facts || []
        data.short = st || []
        data.core = lt.core || null
        renderDist()
        renderStats()
        render()
      } catch (e) {
        $("#mh-list").innerHTML = `<div class="mcl-empty">读取失败：${escHtml(e.message)}</div>`
      }
    }

    function renderDist() {
      const wrap = $("#mh-dist-wrap")
      if (!data.facts.length) { wrap.style.display = "none"; return }
      wrap.style.display = ""
      const b = { clear: 0, fuzzy: 0, fading: 0, gone: 0 }
      data.facts.forEach(f => {
        const r = calcRetention(f, overrides)
        if (r > 70) b.clear++
        else if (r > 40) b.fuzzy++
        else if (r > 20) b.fading++
        else b.gone++
      })
      $("#mh-dist").innerHTML = [
        [b.clear, "#4ade80"],
        [b.fuzzy, "#facc15"],
        [b.fading, "#fb923c"],
        [b.gone, "#f87171"]
      ].map(([n, col]) => n > 0 ? `<div class="mcl-dist-seg" style="flex:${n};background:${col}"></div>` : "").join("")
    }

    function renderStats() {
      const rets = data.facts.map(f => calcRetention(f, overrides))
      const clear = rets.filter(r => r > 70).length
      const fade = rets.filter(r => r <= 20).length
      const protect = data.facts.filter(f => isProtected(f, overrides)).length
      $("#mh-stats").innerHTML = `
        <div class="mcl-stat"><strong>${data.facts.length}</strong>事实记忆</div>
        <div class="mcl-stat"><strong style="color:#4ade80">${clear}</strong>清晰</div>
        <div class="mcl-stat"><strong style="color:#f87171">${fade}</strong>即将遗忘</div>
        <div class="mcl-stat"><strong style="color:#818cf8">${protect}</strong>受保护</div>`
    }

    function render() {
      const list = $("#mh-list")
      if (!data.facts.length) { list.innerHTML = '<div class="mcl-empty">暂无事实记忆</div>'; return }

      const sorted = data.facts.map(f => ({
        ...f,
        _r: calcRetention(f, overrides),
        _w: getWeight(f, overrides),
        _protected: isProtected(f, overrides)
      })).sort((a, b) => (b._w - a._w) || (a._r - b._r))

      list.innerHTML = sorted.map(f => {
        const r = f._r
        const text = escHtml(f.summaryText || f.action || f.text || "（无）")
        const kind = overrides[f.id] || classifyText(f.summaryText || f.action || f.text || "")
        const col = r > 70 ? "#4ade80" : r > 40 ? "#facc15" : r > 20 ? "#fb923c" : "#f87171"
        const prot = f._protected
        return `<div class="mcl-card">
          <div class="mcl-card-text">${text}
            <span class="mcl-kind-tag">${kindLabel(kind)}</span>
            ${prot ? '<span class="protected-icon">🔒 受保护</span>' : ''}
          </div>
          <div class="mcl-bar-row">
            <div class="mcl-bar"><div class="mcl-bar-fill" style="width:${r}%;background:${col}"></div></div>
            <div class="mcl-bar-label" style="color:${col}">${retLabel(r)} ${r}%</div>
          </div>
          <div class="mcl-card-meta">${fmtAge(f)}</div>
          <div class="mcl-card-actions">
            <button class="mcl-mini g" data-id="${f.id}" data-act="reinforce">+ 强化</button>
            <button class="mcl-mini o" data-id="${f.id}" data-act="elevate">⬆ 升级</button>
            <button class="mcl-mini r" data-id="${f.id}" data-act="forget">✕ 遗忘</button>
          </div>
        </div>`
      }).join("")

      list.querySelectorAll("[data-act]").forEach(btn => {
        btn.onclick = () => handleAction(btn.dataset.act, btn.dataset.id)
      })
    }

    async function handleAction(act, memId) {
      const mem = data.facts.find(f => f.id === memId)
      if (!mem) return
      if (act === "forget") {
        const ok = await roche.ui.confirm({ title: "确认遗忘", message: "将从Roche主记忆删除，不可撤销" })
        if (!ok) return
        try {
          await roche.memory.delete(memId)
          data.facts = data.facts.filter(f => f.id !== memId)
          delete overrides[memId]
          await roche.storage.set("mcl-overrides", overrides)
          renderDist()
          renderStats()
          render()
          roche.ui.toast("已遗忘")
        } catch (e) {
          roche.ui.toast("删除失败：" + e.message)
        }
      } else {
        const levels = ["trivial", "normal", "important", "emotional"]
        const cur = overrides[memId] || classifyText(mem.summaryText || mem.action || "")
        overrides[memId] = levels[Math.min(levels.indexOf(cur) + 1, levels.length - 1)]
        await roche.storage.set("mcl-overrides", overrides)
        renderDist()
        render()
        roche.ui.toast(`已升级为 ${kindLabel(overrides[memId])}，保留期延长`)
      }
    }

    // 初始化时如果已有角色选择则加载
    if (sel.value) {
      convId = sel.value
      currentCharId = sel.value
      load()
      loadCore()
    }
  }

  // ══════════════════════════════════════════════════════
  //  App 2: 角色认知（保持不变）
  // ══════════════════════════════════════════════════════
  async function mountCognition(container, roche) {
    // ... 保持与之前 v1.1.0 完全相同的代码（因篇幅省略，实际发布时请保留完整）...
    // 注意：由于代码长度，此处省略，实际替换时请将之前版本的 mountCognition 函数拷回。
    // 为了完整性，请复制 v1.1.0 中的 mountCognition 内容到这里。
  }

  // ══════════════════════════════════════════════════════
  //  App 3: 记忆召回（无向量依赖，保持不变）
  // ══════════════════════════════════════════════════════
  async function mountRecall(container, roche) {
    // ... 保持与之前 v1.1.0 完全相同的代码（因篇幅省略）...
  }

  // ══════════════════════════════════════════════════════
  //  注册插件
  // ══════════════════════════════════════════════════════
  window.RochePlugin.register({
    id: PLUGIN_ID,
    name: "记忆曲线·简",
    version: "1.2.0",
    apps: [
      {
        id: APP_HOME,
        name: "记忆管理",
        icon: "psychology",
        iconImage: "",
        async mount(c, r) { await mountHome(c, r) },
        async unmount(c) { removeStyle(); c.replaceChildren() }
      },
      {
        id: APP_COG,
        name: "角色认知",
        icon: "person_search",
        iconImage: "",
        async mount(c, r) { await mountCognition(c, r) },
        async unmount(c) { removeStyle(); c.replaceChildren() }
      },
      {
        id: APP_RECALL,
        name: "记忆召回",
        icon: "auto_stories",
        iconImage: "",
        async mount(c, r) { await mountRecall(c, r) },
        async unmount(c) { removeStyle(); c.replaceChildren() }
      }
    ]
  })
})()
