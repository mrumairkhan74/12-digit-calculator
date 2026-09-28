(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const display        = $("#display");
  const keys           = $("#keys");
  const memoryIndicator= $("#memory-indicator");
  const gtIndicator    = $("#gt-indicator");
  const modeIndicator  = $("#mode-indicator");
  const brightness     = $("#brightness");
  const themeBtn       = $("#themeBtn");
  const taxInput       = $("#taxRate");
  const copyBtn        = $("#copyBtn");
  const historyBtn     = $("#historyBtn");
  const historyPanel   = $("#historyPanel");
  const historyList    = $("#historyList");
  const historyClear   = $("#historyClear");

  const MAX_DIGITS  = 12;
  const HISTORY_MAX = 20;

  const state = {
    current: "0",
    stored: null,
    operator: null,
    waiting: false,
    memory: 0,
    grandTotal: 0,
    hasGT: false,
    error: false,
    lastOperator: null,
    lastOperand: null,
    taxRate: 0,
    history: []
  };

  /* ---------- storage helpers ---------- */
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  /* ---------- number helpers ---------- */
  function numeric(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function digitCount(v) {
    return v.replace("-", "").replace(".", "").length;
  }
  function formatNumber(value) {
    if (!Number.isFinite(value)) return "ERROR";
    if (Math.abs(value) < 1e-12) value = 0;

    let s = value.toPrecision(12);
    if (s.includes("e") || s.includes("E")) s = value.toFixed(10);
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");

    if (digitCount(s) > MAX_DIGITS) return "ERROR";
    return s;
  }

  /* ---------- rendering ---------- */
  function update() {
    display.textContent = state.error ? "ERROR" : state.current;
    memoryIndicator.style.opacity = state.memory !== 0 ? "1" : ".18";
    gtIndicator.style.opacity     = state.hasGT ? "1" : ".18";
    modeIndicator.textContent     = state.operator ? state.operator : "";
  }

  function renderHistory() {
    historyBtn.textContent = `History (${state.history.length})`;
    if (!state.history.length) {
      historyList.innerHTML = '<li class="empty">No calculations yet.</li>';
      return;
    }
    historyList.innerHTML = state.history
      .map(h => `<li><span class="expr">${h.expr}</span><span class="res">${h.result}</span></li>`)
      .join("");
  }
  function addHistory(expr, result) {
    state.history.unshift({ expr, result });
    if (state.history.length > HISTORY_MAX) state.history.length = HISTORY_MAX;
    renderHistory();
  }

  /* ---------- errors ---------- */
  function setError() {
    state.error = true;
    state.current = "0";
    state.stored = null;
    state.operator = null;
    state.waiting = false;
    update();
  }

  /* ---------- input ---------- */
  function inputDigit(d) {
    if (state.error) clearAll();
    if (state.waiting) {
      state.current = (d === "00" || d === "000") ? "0" : d;
      state.waiting = false;
      update();
      return;
    }
    if (d === "00" || d === "000") {
      if (state.current !== "0" && !state.current.includes(".")) {
        const next = state.current + d;
        if (digitCount(next) <= MAX_DIGITS) state.current = next;
      }
    } else if (state.current === "0") {
      state.current = d;
    } else if (state.current === "-0") {
      state.current = "-" + d;
    } else if (digitCount(state.current + d) <= MAX_DIGITS) {
      state.current += d;
    }
    update();
  }

  function decimal() {
    if (state.error) clearAll();
    if (state.waiting) {
      state.current = "0.";
      state.waiting = false;
    } else if (!state.current.includes(".")) {
      if (digitCount(state.current + ".") <= MAX_DIGITS) state.current += ".";
    }
    update();
  }

  /* ---------- operations ---------- */
  function calculate(a, op, b) {
    switch (op) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? null : a / b;
      default : return b;
    }
  }

  function chooseOperator(op) {
    if (state.error) return;
    const input = numeric(state.current);

    if (state.operator && !state.waiting) {
      const result = calculate(numeric(state.stored), state.operator, input);
      if (result === null || !Number.isFinite(result)) return setError();
      const formatted = formatNumber(result);
      if (formatted === "ERROR") return setError();
      state.current = formatted;
      state.stored = result;
    } else {
      state.stored = input;
    }

    state.operator = op;
    state.waiting  = true;
    update();
  }

  function equals() {
    if (state.error) return;

    if (state.operator !== null && state.stored !== null) {
      const a = numeric(state.stored);
      const b = state.waiting ? state.stored : numeric(state.current);
      const op = state.operator;
      const result = calculate(a, op, b);
      if (result === null || !Number.isFinite(result)) return setError();
      const formatted = formatNumber(result);
      if (formatted === "ERROR") return setError();

      addHistory(`${formatNumber(a)} ${op} ${formatNumber(b)}`, formatted);

      state.current      = formatted;
      state.lastOperator = op;
      state.lastOperand  = b;
      state.grandTotal  += result;
      state.hasGT        = true;
      state.stored       = null;
      state.operator     = null;
      state.waiting      = true;
    } else if (state.lastOperator && state.lastOperand !== null) {
      const a = numeric(state.current);
      const b = state.lastOperand;
      const op = state.lastOperator;
      const result = calculate(a, op, b);
      if (result === null || !Number.isFinite(result)) return setError();
      const formatted = formatNumber(result);
      if (formatted === "ERROR") return setError();

      addHistory(`${formatNumber(a)} ${op} ${formatNumber(b)}`, formatted);
      state.current = formatted;
      state.grandTotal += result;
      state.hasGT = true;
    }
    update();
  }

  function percent() {
    if (state.error) return;
    const value = numeric(state.current);
    let result = value / 100;
    if (state.stored !== null && state.operator) {
      result = numeric(state.stored) * value / 100;
    }
    const formatted = formatNumber(result);
    if (formatted === "ERROR") return setError();
    state.current = formatted;
    update();
  }

  function sign() {
    if (state.error) return;
    if (state.current === "0" || state.current === "0.") return;
    state.current = state.current.startsWith("-")
      ? state.current.slice(1)
      : "-" + state.current;
    update();
  }

  function clearAll() {
    state.current = "0";
    state.stored = null;
    state.operator = null;
    state.waiting = false;
    state.error = false;
    state.lastOperator = null;
    state.lastOperand = null;
    state.grandTotal = 0;
    state.hasGT = false;
    update();
  }

  function clearEntry() {
    if (state.error) return clearAll();
    state.current = "0";
    update();
  }

  function backspace() {
    if (state.error || state.waiting) return;
    state.current = state.current.length > 1 ? state.current.slice(0, -1) : "0";
    if (state.current === "-" || state.current === "") state.current = "0";
    update();
  }

  function memoryAdd()      { state.memory += numeric(state.current); update(); }
  function memorySubtract() { state.memory -= numeric(state.current); update(); }
  function memoryRecall() {
    const formatted = formatNumber(state.memory);
    if (formatted === "ERROR") return setError();
    state.current = formatted;
    state.waiting = false;
    update();
  }
  function memoryClear() { state.memory = 0; update(); }

  function grandTotal() {
    const formatted = formatNumber(state.grandTotal);
    if (formatted === "ERROR") return setError();
    state.current = formatted;
    state.waiting = false;
    update();
  }

  /* ---------- tax ---------- */
  function taxAdd() {
    const rate = state.taxRate || 0;
    const result = numeric(state.current) * (1 + rate / 100);
    const formatted = formatNumber(result);
    if (formatted === "ERROR") return setError();
    addHistory(`${state.current} TAX+ ${rate}%`, formatted);
    state.current = formatted;
    update();
  }
  function taxSubtract() {
    const rate = state.taxRate || 0;
    if (rate === -100) return setError();
    const result = numeric(state.current) / (1 + rate / 100);
    const formatted = formatNumber(result);
    if (formatted === "ERROR") return setError();
    addHistory(`${state.current} TAX− ${rate}%`, formatted);
    state.current = formatted;
    update();
  }

  /* ---------- MU / markup (Casio-style) ----------
     A × B MU  → A × (1 + B/100)      (add markup)
     A ÷ B MU  → A ÷ (1 − B/100)      (selling price from cost & margin)
     A + B MU  → A ÷ (1 − B/100)      (same as ÷ for convenience)
     A − B MU  → A × (1 − B/100)      (discount)
  -------------------------------------------------- */
  function markup() {
    if (state.error) return;
    if (state.stored === null || !state.operator || state.waiting) {
      modeIndicator.textContent = "MU";
      return;
    }
    const a = numeric(state.stored);
    const b = numeric(state.current);
    let result;
    switch (state.operator) {
      case "×": result = a * (1 + b / 100); break;
      case "÷": result = b === 100 ? null : a / (1 - b / 100); break;
      case "+": result = b === 100 ? null : a / (1 - b / 100); break;
      case "−": result = a * (1 - b / 100); break;
      default: return;
    }
    if (result === null || !Number.isFinite(result)) return setError();
    const formatted = formatNumber(result);
    if (formatted === "ERROR") return setError();
    addHistory(`${formatNumber(a)} ${state.operator} ${formatNumber(b)} MU`, formatted);
    state.current  = formatted;
    state.stored   = null;
    state.operator = null;
    state.waiting  = true;
    update();
  }

  /* ---------- copy ---------- */
  async function copyResult() {
    const text = display.textContent || "0";
    try {
      await navigator.clipboard.writeText(text);
      const old = copyBtn.textContent;
      copyBtn.textContent = "COPIED";
      setTimeout(() => { copyBtn.textContent = old; }, 900);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      ta.remove();
      copyBtn.textContent = "COPIED";
      setTimeout(() => { copyBtn.textContent = "COPY"; }, 900);
    }
  }

  /* ---------- action dispatcher ---------- */
  function handle(action) {
    const map = {
      add: () => chooseOperator("+"),
      subtract: () => chooseOperator("−"),
      multiply: () => chooseOperator("×"),
      divide: () => chooseOperator("÷"),
      equals, percent, sign,
      clear: clearAll,
      "clear-entry": clearEntry,
      backspace,
      "memory-add": memoryAdd,
      "memory-subtract": memorySubtract,
      "memory-recall": memoryRecall,
      "memory-clear": memoryClear,
      "grand-total": grandTotal,
      "tax-add": taxAdd,
      "tax-subtract": taxSubtract,
      markup,
      decimal
    };
    if (map[action]) map[action]();
  }

  /* ---------- events ---------- */
  keys.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.digit) inputDigit(btn.dataset.digit);
    else if (btn.dataset.action) handle(btn.dataset.action);
  });

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const k = e.key;
    if (/^[0-9]$/.test(k))             { e.preventDefault(); inputDigit(k); }
    else if (k === "." || k === ",")   { e.preventDefault(); decimal(); }
    else if (k === "+")                { e.preventDefault(); chooseOperator("+"); }
    else if (k === "-")                { e.preventDefault(); chooseOperator("−"); }
    else if (k === "*")                { e.preventDefault(); chooseOperator("×"); }
    else if (k === "/")                { e.preventDefault(); chooseOperator("÷"); }
    else if (k === "%")                { e.preventDefault(); percent(); }
    else if (k === "Enter" || k === "="){ e.preventDefault(); equals(); }
    else if (k === "Backspace")        { e.preventDefault(); backspace(); }
    else if (k === "Escape")           { e.preventDefault(); clearAll(); }
  });

  brightness.addEventListener("input", () => {
    const v = Number(brightness.value) / 100;
    display.style.opacity = v;
    save("calc.brightness", brightness.value);
  });

  taxInput.addEventListener("input", () => {
    const v = Number(taxInput.value);
    state.taxRate = Number.isFinite(v) ? v : 0;
    save("calc.taxRate", state.taxRate);
  });

  themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    save("calc.theme", next);
  });

  copyBtn.addEventListener("click", copyResult);

  historyBtn.addEventListener("click", () => {
    const hidden = historyPanel.style.display === "none";
    historyPanel.style.display = hidden ? "" : "none";
  });

  historyClear.addEventListener("click", () => {
    state.history = [];
    renderHistory();
  });

  /* ---------- init ---------- */
  document.documentElement.setAttribute("data-theme", load("calc.theme", "light"));
  const savedBrightness = load("calc.brightness", "88");
  brightness.value = savedBrightness;
  display.style.opacity = Number(savedBrightness) / 100;
  state.taxRate = load("calc.taxRate", 0);
  taxInput.value = state.taxRate;

  renderHistory();
  update();
})();
