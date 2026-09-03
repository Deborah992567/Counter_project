(() => {
  let counter = 0;
  let step = 1;
  const history = [];

  const $ = (sel) => document.querySelector(sel);
  const counterDisplay = $("#counter-display");
  const historyList = $("#history-list");
  const stepInput = $("#step-input");

  function updateDisplay() {
    counterDisplay.textContent = counter;
    counterDisplay.className = "counter-display " + getColorClass(counter);
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

  function addHistory(action, value) {
    history.unshift({ action, value, time: new Date().toLocaleTimeString() });
    if (history.length > 20) history.pop();
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML =
        '<li class="history-empty">No changes yet</li>';
      return;
    }
    historyList.innerHTML = history
      .map(
        (h) =>
          `<li><span>${h.action}</span><span class="change ${
            h.value > 0 ? "positive" : h.value < 0 ? "negative" : ""
          }">${h.value > 0 ? "+" : ""}${h.value}</span><span>${h.time}</span></li>`
      )
      .join("");
  }

  function increment() {
    counter += step;
    updateDisplay();
    addHistory("Increment", step);
  }

  function decrement() {
    counter -= step;
    updateDisplay();
    addHistory("Decrement", -step);
  }

  function reset() {
    const prev = counter;
    counter = 0;
    updateDisplay();
    addHistory("Reset", prev);
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

  function getStep() {
    const val = parseInt(stepInput.value, 10);
    return isNaN(val) || val < 1 ? 1 : Math.min(val, 100);
  }

  function toggleTheme() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "" : "dark"
    );
    $("#theme-toggle").textContent = isDark ? "\u263E" : "\u2600";
    localStorage.setItem("theme", isDark ? "light" : "dark");
  }

  $("#increase").addEventListener("click", increment);
  $("#decrease").addEventListener("click", decrement);
  $("#reset").addEventListener("click", reset);
  $("#copy-btn").addEventListener("click", copyValue);
  $("#theme-toggle").addEventListener("click", toggleTheme);

  $("#step-down").addEventListener("click", () => {
    step = Math.max(1, getStep() - 1);
    stepInput.value = step;
  });

  $("#step-up").addEventListener("click", () => {
    step = Math.min(100, getStep() + 1);
    stepInput.value = step;
  });

  stepInput.addEventListener("input", () => {
    step = getStep();
  });

  $("#clear-history").addEventListener("click", () => {
    history.length = 0;
    renderHistory();
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
        toggleTheme();
        break;
    }
  });

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    $("#theme-toggle").textContent = "\u2600";
  }

  renderHistory();
})();
