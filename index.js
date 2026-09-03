(() => {
  const savedCounter = parseInt(localStorage.getItem("counter"), 10);
  let counter = isNaN(savedCounter) ? 0 : savedCounter;
  const savedStep = parseInt(localStorage.getItem("step"), 10);
  let step = isNaN(savedStep) || savedStep < 1 ? 1 : Math.min(savedStep, 100);
  let boundsEnabled = localStorage.getItem("boundsEnabled") === "true";
  let minBound = localStorage.getItem("minBound") ? parseInt(localStorage.getItem("minBound"), 10) : -1000;
  let maxBound = localStorage.getItem("maxBound") ? parseInt(localStorage.getItem("maxBound"), 10) : 1000;
  const history = [];
  const undoStack = [];
  let historyFilter = "all";
  const stats = { inc: 0, dec: 0, reset: 0, peak: 0, low: 0, total: 0 };
  let soundEnabled = localStorage.getItem("sound") !== "off";
  let confettiEnabled = localStorage.getItem("confetti") !== "off";

  const $ = (sel) => document.querySelector(sel);
  const counterDisplay = $("#counter-display");
  const historyList = $("#history-list");
  const stepInput = $("#step-input");
  const toastEl = $("#toast");
  const boundsContent = $("#bounds-content");
  const boundsToggle = $("#bounds-toggle");
  const minInput = $("#min-input");
  const maxInput = $("#max-input");
  const milestoneFill = $("#milestone-fill");
  const milestoneLabel = $("#milestone-label");

  const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4"];

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove("show"), 1500);
  }

  function confetti() {
    if (!confettiEnabled) return;
    const count = 60;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.width = Math.random() * 8 + 6 + "px";
      piece.style.height = Math.random() * 10 + 8 + "px";
      piece.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
      piece.style.animationDuration = Math.random() * 2 + 1.5 + "s";
      piece.style.animationDelay = Math.random() * 0.5 + "s";
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 4500);
    }
  }

  function playTone(freq, duration = 0.06, type = "sine") {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function playSound(type) {
    if (!soundEnabled) return;
    if (type === "inc") playTone(520);
    else if (type === "dec") playTone(340);
    else if (type === "reset") playTone(220, 0.12, "triangle");
    else if (type === "undo") playTone(400, 0.08, "triangle");
    if (navigator.vibrate) {
      navigator.vibrate(type === "inc" || type === "dec" ? 10 : 20);
    }
  }

  function updateMilestone() {
    const next = Math.abs(counter) >= 100
      ? Math.sign(counter) === -1
        ? -Math.floor(Math.abs(counter) / 100) * 100 - 100
        : Math.floor(Math.abs(counter) / 100) * 100 + 100
      : 100;
    const prev = next - Math.sign(next || 1) * 100;
    const abs = Math.abs(counter);
    const pct = abs === 0 ? 0 : ((abs % 100) / 100) * 100;
    milestoneFill.style.width = pct + "%";
    milestoneLabel.textContent = `Next: ${next}`;
  }

  function updateDisplay() {
    counterDisplay.textContent = counter;
    counterDisplay.className = "counter-display " + getColorClass(counter);
    localStorage.setItem("counter", String(counter));
    document.title = `${counter} - Counter`;
    updateMilestone();
    bump();
  }

  function getColorClass(val) {
    if (val > 0) return "positive";
    if (val < 0) return "negative";
    return "neutral";
  }

  function bump() {
    counterDisplay.classList.add("bump");
    setTimeout(() => counterDisplay.classList.remove("bump"), 150);
  }

  function addHistory(action, value, oldValue = null) {
    history.unshift({ action, value, time: new Date().toLocaleTimeString() });
    if (history.length > 30) history.pop();
    if (oldValue !== null) undoStack.push({ prev: oldValue, action });
    renderHistory();
    updateStats();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML =
        '<li class="history-empty">No changes yet</li>';
      return;
    }
    let items = history;
    if (historyFilter === "inc") items = history.filter((h) => h.action === "Increment");
    else if (historyFilter === "dec") items = history.filter((h) => h.action === "Decrement");
    else if (historyFilter === "reset") items = history.filter((h) => h.action === "Reset");
    if (items.length === 0) {
      historyList.innerHTML = '<li class="history-empty">No matching entries</li>';
      return;
    }
    historyList.innerHTML = items
      .map((h) => {
        const cls = h.value > 0 ? "positive" : h.value < 0 ? "negative" : "";
        const liClass = h.value > 0 ? " positive" : h.value < 0 ? " negative" : "";
        const sign = h.value > 0 ? "+" : "";
        const displayVal =
          h.action === "Reset" ? `${h.value} \u2192 0` : `${sign}${h.value}`;
        return `<li class="${liClass}"><span>${h.action}</span><span class="change ${cls}">${displayVal}</span><span>${h.time}</span></li>`;
      })
      .join("");
  }

  function updateStats() {
    $("#stat-inc").textContent = stats.inc;
    $("#stat-dec").textContent = stats.dec;
    $("#stat-reset").textContent = stats.reset;
    $("#stat-peak").textContent = stats.peak;
    $("#stat-low").textContent = stats.low;
    $("#stat-total").textContent = stats.total;
  }

  function checkBounds(next) {
    if (!boundsEnabled) return next;
    return Math.max(minBound, Math.min(maxBound, next));
  }

  function shake() {
    counterDisplay.classList.remove("shake");
    void counterDisplay.offsetWidth;
    counterDisplay.classList.add("shake");
  }

  function increment() {
    const old = counter;
    const next = checkBounds(counter + step);
    if (next === counter) {
      showToast("Limit reached");
      shake();
      return;
    }
    counter = next;
    stats.inc++;
    stats.total++;
    if (counter > stats.peak) stats.peak = counter;
    const actual = next - old;
    updateDisplay();
    addHistory("Increment", actual, old);
    playSound("inc");
    afterChange(old);
  }

  function decrement() {
    const old = counter;
    const next = checkBounds(counter - step);
    if (next === counter) {
      showToast("Limit reached");
      shake();
      return;
    }
    counter = next;
    stats.dec++;
    stats.total++;
    if (counter < stats.low) stats.low = counter;
    const actual = next - old;
    updateDisplay();
    addHistory("Decrement", actual, old);
    playSound("dec");
    afterChange(old);
  }

  function reset() {
    if (counter === 0) {
      showToast("Already at zero");
      return;
    }
    const prev = counter;
    undoStack.push({ prev, action: "Reset" });
    counter = 0;
    stats.reset++;
    stats.total++;
    updateDisplay();
    addHistory("Reset", prev, prev);
    playSound("reset");
  }

  function afterChange(prev) {
    if (counter !== 0 && Math.abs(counter) % 100 === 0 && Math.abs(prev) < Math.abs(counter)) {
      confetti();
      showToast(`Milestone! ${counter}`);
      return;
    }
    if (counter !== 0 && counter % 500 === 0) {
      confetti();
    }
  }

  function setValue() {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "inline-edit";
    input.value = counter;
    counterDisplay.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const val = parseInt(input.value, 10);
      const raw = isNaN(val) ? 0 : val;
      const next = boundsEnabled ? Math.max(minBound, Math.min(maxBound, raw)) : raw;
      const old = counter;
      if (!document.contains(input)) return;
      input.replaceWith(counterDisplay);
      counter = next;
      updateDisplay();
      history.unshift({ action: "Set", value: next, time: new Date().toLocaleTimeString() });
      if (history.length > 30) history.pop();
      renderHistory();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(); }
      if (e.key === "Escape") { done = true; if (document.contains(input)) input.replaceWith(counterDisplay); }
    });
    input.addEventListener("blur", finish);
  }

  function undo() {
    const last = undoStack.pop();
    if (!last) {
      showToast("Nothing to undo");
      return;
    }
    counter = last.prev;
    updateDisplay();
    playSound("undo");
    showToast(`Undid ${last.action}`);
    history.unshift({
      action: "Undo",
      value: last.prev,
      time: new Date().toLocaleTimeString(),
    });
    if (history.length > 30) history.pop();
    renderHistory();
  }

  function attachRepeat(selector, fn) {
    const el = $(selector);
    let timer = null;
    let interval = null;
    const start = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      fn();
      timer = setTimeout(() => {
        interval = setInterval(fn, 80);
      }, 350);
    };
    const stop = () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
    el.addEventListener("mousedown", start);
    ["mouseup", "mouseleave", "mouseout"].forEach((t) => el.addEventListener(t, stop));
    el.addEventListener("touchstart", (e) => start(e), { passive: false });
    ["touchend", "touchcancel"].forEach((t) => el.addEventListener(t, stop));
  }

  function copyValue() {
    navigator.clipboard.writeText(counter).then(() => {
      const btn = $("#copy-btn");
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 1200);
    });
  }

  function exportCSV() {
    if (history.length === 0) {
      showToast("No history to export");
      return;
    }
    const rows = [
      ["Action", "Value", "Time"],
      ...history.map((h) => [h.action, String(h.value), h.time]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "counter-history.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("History exported");
  }

  function getStep() {
    const val = parseInt(stepInput.value, 10);
    return isNaN(val) || val < 1 ? 1 : Math.min(val, 100);
  }

  function toggleDarkTheme() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "" : "dark"
    );
    $("#theme-toggle").textContent = isDark ? "\u263E" : "\u2600";
    localStorage.setItem("theme", isDark ? "light" : "dark");
  }

  function openHelp() {
    $("#modal-overlay").hidden = false;
    $("#modal-close").focus();
  }

  function closeHelp() {
    $("#modal-overlay").hidden = true;
  }

  function toggleBounds() {
    boundsEnabled = !boundsEnabled;
    localStorage.setItem("boundsEnabled", String(boundsEnabled));
    boundsToggle.textContent = boundsEnabled ? "Disable" : "Enable";
    boundsToggle.setAttribute("aria-expanded", String(boundsEnabled));
    boundsContent.hidden = !boundsEnabled;
    if (boundsEnabled) {
      minBound = parseInt(minInput.value, 10) || -Infinity;
      maxBound = parseInt(maxInput.value, 10) || Infinity;
      localStorage.setItem("minBound", String(minBound));
      localStorage.setItem("maxBound", String(maxBound));
      if (minBound > maxBound) {
        const t = minBound;
        minBound = maxBound;
        maxBound = t;
        minInput.value = minBound;
        maxInput.value = maxBound;
      }
      if (counter < minBound || counter > maxBound) {
        counter = Math.max(minBound, Math.min(maxBound, counter));
        updateDisplay();
      }
      showToast("Limits enabled");
    } else {
      showToast("Limits disabled");
    }
  }

  attachRepeat("#increase", increment);
  attachRepeat("#decrease", decrement);
  $("#reset").addEventListener("click", reset);
  $("#copy-btn").addEventListener("click", copyValue);
  $("#theme-toggle").addEventListener("click", toggleDarkTheme);
  $("#help-btn").addEventListener("click", openHelp);
  $("#modal-close").addEventListener("click", closeHelp);
  $("#modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeHelp();
  });
  $("#undo-btn").addEventListener("click", undo);
  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem("sound", soundEnabled ? "on" : "off");
    const btn = $("#sound-toggle");
    btn.setAttribute("aria-checked", String(soundEnabled));
    btn.classList.toggle("on", soundEnabled);
    showToast(soundEnabled ? "Sound on" : "Sound off");
  }

  function toggleConfetti() {
    confettiEnabled = !confettiEnabled;
    localStorage.setItem("confetti", confettiEnabled ? "on" : "off");
    const btn = $("#confetti-toggle");
    btn.setAttribute("aria-checked", String(confettiEnabled));
    btn.classList.toggle("on", confettiEnabled);
    showToast(confettiEnabled ? "Confetti on" : "Confetti off");
  }

  function share() {
    const text = `My counter is at ${counter}. Count with me!`;
    if (navigator.share) {
      navigator.share({ title: "Counter", text }).catch(() => {});
    } else {
      copyValue();
      showToast(`Copied: ${counter}`);
    }
  }

  $("#export-history").addEventListener("click", exportCSV);
  $("#sound-toggle").addEventListener("click", toggleSound);
  $("#confetti-toggle").addEventListener("click", toggleConfetti);
  $("#share-btn").addEventListener("click", share);
  $("#bounds-toggle").addEventListener("click", toggleBounds);
  counterDisplay.addEventListener("dblclick", setValue);

  document.querySelectorAll(".step-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      step = Math.min(100, Math.max(1, getStep() * parseInt(btn.dataset.mult, 10)));
      stepInput.value = step;
      localStorage.setItem("step", String(step));
      showToast(`Step \u00d7${btn.dataset.mult}`);
    });
  });

  $("#step-down").addEventListener("click", () => {
    step = Math.max(1, getStep() - 1);
    stepInput.value = step;
    localStorage.setItem("step", String(step));
  });

  $("#step-up").addEventListener("click", () => {
    step = Math.min(100, getStep() + 1);
    stepInput.value = step;
    localStorage.setItem("step", String(step));
  });

  stepInput.addEventListener("input", () => {
    step = getStep();
    localStorage.setItem("step", String(step));
  });

  minInput.addEventListener("input", () => {
    minBound = parseInt(minInput.value, 10) || -Infinity;
    if (counter < minBound) {
      counter = minBound;
      updateDisplay();
    }
  });

  maxInput.addEventListener("input", () => {
    maxBound = parseInt(maxInput.value, 10) || Infinity;
    if (counter > maxBound) {
      counter = maxBound;
      updateDisplay();
    }
  });

  function resetAll() {
    if (!confirm("Reset counter, history, stats, and saved preferences?")) return;
    counter = 0;
    step = 1;
    history.length = 0;
    undoStack.length = 0;
    stats.inc = 0;
    stats.dec = 0;
    stats.reset = 0;
    stats.peak = 0;
    stats.low = 0;
    stats.total = 0;
    localStorage.clear();
    stepInput.value = 1;
    showToast("All data reset");
    updateDisplay();
    renderHistory();
    updateStats();
  }

  $("#reset-all").addEventListener("click", resetAll);

  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      historyFilter = chip.dataset.filter;
      renderHistory();
    });
  });

  $("#clear-history").addEventListener("click", () => {
    history.length = 0;
    undoStack.length = 0;
    renderHistory();
    showToast("History cleared");
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    switch (e.key) {
      case "+":
      case "=":
        increment();
        break;
      case "-":
        decrement();
        break;
      case "0":
        reset();
        break;
      case "d":
      case "D":
        toggleDarkTheme();
        break;
      case "u":
      case "U":
        undo();
        break;
      case "h":
      case "H":
      case "?":
        openHelp();
        break;
      case "Escape":
        if (!$("#modal-overlay").hidden) closeHelp();
        break;
      case "c":
      case "C":
        copyValue();
        break;
      case "e":
      case "E":
        exportCSV();
        break;
      case "ArrowUp":
        e.preventDefault();
        increment();
        break;
      case "ArrowDown":
        e.preventDefault();
        decrement();
        break;
      case "ArrowRight":
        if (e.shiftKey) {
          e.preventDefault();
          step = Math.min(100, getStep() + 1);
          stepInput.value = step;
          localStorage.setItem("step", String(step));
        }
        break;
      case "ArrowLeft":
        if (e.shiftKey) {
          e.preventDefault();
          step = Math.max(1, getStep() - 1);
          stepInput.value = step;
          localStorage.setItem("step", String(step));
        }
        break;
    }
  });

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    $("#theme-toggle").textContent = "\u2600";
  }

  stepInput.value = step;
  const soundBtn = $("#sound-toggle");
  soundBtn.setAttribute("aria-checked", String(soundEnabled));
  soundBtn.classList.toggle("on", soundEnabled);
  const confettiBtn = $("#confetti-toggle");
  confettiBtn.setAttribute("aria-checked", String(confettiEnabled));
  confettiBtn.classList.toggle("on", confettiEnabled);
  if (boundsEnabled) {
    boundsToggle.textContent = "Disable";
    boundsToggle.setAttribute("aria-expanded", "true");
    boundsContent.hidden = false;
    minInput.value = minBound === -Infinity ? "" : minBound;
    maxInput.value = maxBound === Infinity ? "" : maxBound;
    if (counter < minBound || counter > maxBound) {
      counter = Math.max(minBound, Math.min(maxBound, counter));
    }
  }

  updateDisplay();
  renderHistory();
  updateStats();
})();
