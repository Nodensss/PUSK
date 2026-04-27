const ALGORITHM = {
  kind: "start",
  title: "Алгоритм пуска",
  fullTitle: "АЛГОРИТМ ПУСКА",
  subtitle: "12 этапов · 03.2026",
  accent: "#f5a623",
  icon: "▶",
  dataUrl: "/data/start-algorithm.json",
};

const app = document.querySelector("#app");
const state = {
  data: {},
  checked: {},
  search: {},
  questionIndex: 0,
  trainerAnswers: [],
  lockedAnswer: null,
};

init();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

async function init() {
  await loadAlgorithm(ALGORITHM);
  window.addEventListener("popstate", render);
  window.addEventListener("hashchange", render);
  document.addEventListener("click", onNavigate);
  render();
}

async function loadAlgorithm(meta) {
  if (window.ALGORITHM_DATA?.[meta.kind]) {
    state.data[meta.kind] = window.ALGORITHM_DATA[meta.kind];
    return;
  }
  const response = await fetch(meta.dataUrl);
  state.data[meta.kind] = await response.json();
}

function onNavigate(event) {
  const link = event.target.closest("a[data-link]");
  if (!link) return;
  event.preventDefault();
  const href = link.getAttribute("href");
  if (href.startsWith("#/")) {
    location.hash = href;
  } else if (location.protocol === "file:") {
    location.hash = href;
  } else {
    history.pushState(null, "", href);
  }
  state.questionIndex = 0;
  state.trainerAnswers = [];
  state.lockedAnswer = null;
  render();
}

function render() {
  const path = currentPath();
  const legacy = {
    "/start": "/",
    "/start/checklist": "/checklist",
    "/start/view": "/view",
    "/start/view/critical-rules": "/view/critical-rules",
    "/start/trainer": "/trainer",
    "/start/trainer/history": "/trainer/history",
  };
  if (legacy[path]) {
    if (location.protocol === "file:") location.hash = legacy[path];
    else history.replaceState(null, "", legacy[path]);
    return render();
  }

  if (path === "/") return renderModeMenu();
  const [, page, extra] = path.split("/");
  if (page === "checklist") return renderChecklist();
  if (page === "view" && extra === "critical-rules") return renderCriticalRules();
  if (page === "view") return renderView();
  if (page === "trainer" && extra === "history") return renderHistory();
  if (page === "trainer") return renderTrainer();
  notFound();
}

function pageShell(content, active = "") {
  const meta = ALGORITHM;
  app.className = "app";
  app.style.setProperty("--accent", meta.accent);
  app.innerHTML = `
    <div class="top-strip"></div>
    <main class="shell">
      <header class="header">
        <div>
          <a class="back" href="#/" data-link>← К меню пуска</a>
          <div class="eyebrow">${meta.subtitle}</div>
          <h1 class="page-title">${meta.title}</h1>
        </div>
        <nav class="tabs">
          <a class="tab ${active === "checklist" ? "active" : ""}" href="#/checklist" data-link>☑ Чек-лист</a>
          <a class="tab ${active === "view" ? "active" : ""}" href="#/view" data-link>☰ Просмотр</a>
          <a class="tab ${active === "trainer" ? "active" : ""}" href="#/trainer" data-link>◉ Тренажёр</a>
        </nav>
      </header>
      ${content}
    </main>
  `;
}

function renderModeMenu() {
  const modes = [
    ["☑", "Чек-лист", "Отмечайте выполненные пункты и ищите позиции.", "#/checklist"],
    ["☰", "Просмотр", "Читайте этапы, правила, особые ситуации и приложения.", "#/view"],
    ["◉", "Тренажёр", "Проверьте знание алгоритма по вопросам из JSON.", "#/trainer"],
  ];
  pageShell(`
    <section class="hero-panel">
      <div>
        <div class="eyebrow">Линия УПЭ</div>
        <h2>${ALGORITHM.fullTitle}</h2>
        <p class="muted">Пуск технологической линии · данные из start-algorithm.json</p>
      </div>
      <span class="algorithm-mark">${ALGORITHM.icon}</span>
    </section>
    <section class="mode-grid">
      ${modes.map(([icon, title, text, href]) => `
        <a class="mode-card" href="${href}" data-link>
          <span class="algorithm-mark">${icon}</span>
          <span>
            <strong>${title}</strong>
            <span class="muted">${text}</span>
          </span>
        </a>
      `).join("")}
    </section>
  `);
}

function renderChecklist() {
  const kind = ALGORITHM.kind;
  const data = state.data[kind];
  const checked = getChecked(kind);
  const allChecks = data.phases.flatMap((phase) => phase.checks.map((check) => `${phase.id}:${check.id}`));
  const done = allChecks.filter((id) => checked[id]).length;
  const query = state.search[kind] ?? new URLSearchParams(location.search).get("q") ?? "";
  const phases = filterPhases(data.phases, query);

  pageShell(`
    <div class="toolbar">
      <input class="search" placeholder="Поиск по позициям, этапам и пунктам" value="${escapeHtml(query)}" />
      <div class="progress">
        <strong>${done} / ${allChecks.length}</strong>
        <span class="muted">пунктов выполнено</span>
        <div class="progress-track"><div class="progress-fill" style="--progress:${allChecks.length ? (done / allChecks.length) * 100 : 0}%"></div></div>
      </div>
    </div>
    ${renderPhases(kind, phases, true)}
  `, "checklist");

  app.querySelector(".search").addEventListener("input", (event) => {
    if (location.protocol === "file:") {
      state.search[kind] = event.target.value;
      renderChecklist(kind);
      return;
    }
    const url = new URL(location.href);
    if (event.target.value) url.searchParams.set("q", event.target.value);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url.pathname + url.search);
    renderChecklist(kind);
  });

  app.querySelectorAll("[data-check]").forEach((box) => {
    box.addEventListener("change", () => {
      checked[box.dataset.check] = box.checked;
      localStorage.setItem(storageKey(kind, "checked"), JSON.stringify(checked));
      renderChecklist(kind);
    });
  });
}

function renderView() {
  const kind = ALGORITHM.kind;
  const data = state.data[kind];
  pageShell(`
    <div class="header-actions">
      <a class="primary" href="#/view/critical-rules" data-link>⚠ Критические правила</a>
    </div>
    ${renderPhases(kind, data.phases, false)}
    ${renderSpecial(data)}
    ${renderAppendix(data)}
  `, "view");
}

function renderCriticalRules() {
  const kind = ALGORITHM.kind;
  const data = state.data[kind];
  pageShell(`
    <a class="back" href="#/view" data-link>← К просмотру</a>
    <h2 class="section-title">Критические правила</h2>
    <div class="phase-list">
      ${(data.criticalRules || []).map((rule) => `
        <article class="phase-card">
          <div class="phase-head">
            <div class="phase-num">!</div>
            <div>
              <h3>${escapeHtml(rule.title)}</h3>
              <p class="desc">${escapeHtml(rule.rule)}</p>
              ${rule.consequence ? `<div class="warning">${escapeHtml(rule.consequence)}</div>` : ""}
            </div>
          </div>
        </article>
      `).join("") || `<div class="panel muted">Для этого алгоритма критические правила не добавлены.</div>`}
    </div>
  `, "view");
}

function renderTrainer() {
  const kind = ALGORITHM.kind;
  const questions = state.data[kind].trainerQuestions || [];
  const question = questions[state.questionIndex];
  if (!question) {
    const score = state.trainerAnswers.filter(Boolean).length;
    saveAttempt(kind, score, questions.length);
    pageShell(`
      <section class="question">
        <div class="eyebrow">Результат</div>
        <h2 class="page-title">${score} / ${questions.length}</h2>
        <p class="answer-note">Попытка сохранена в истории выбранного алгоритма.</p>
        <div class="header-actions" style="margin-top:18px">
          <button class="primary" id="restart">↻ Повторить</button>
          <a class="ghost" href="#/trainer/history" data-link>◷ История</a>
        </div>
      </section>
    `, "trainer");
    app.querySelector("#restart").addEventListener("click", () => {
      state.questionIndex = 0;
      state.trainerAnswers = [];
      state.lockedAnswer = null;
      renderTrainer(kind);
    });
    return;
  }

  const answered = state.lockedAnswer !== null;
    pageShell(`
    <section class="question">
      <div class="eyebrow">Вопрос ${state.questionIndex + 1} / ${questions.length}</div>
      <h2>${escapeHtml(question.question)}</h2>
      <div class="options">
        ${question.options.map((option, index) => {
          const mark = answered && index === question.correct ? "correct" : answered && index === state.lockedAnswer ? "wrong" : "";
          return `<button class="ghost option ${mark}" data-option="${index}">${escapeHtml(option)}</button>`;
        }).join("")}
      </div>
      ${answered ? `<p class="answer-note">${escapeHtml(question.explanation || "")}</p><button class="primary" id="next">Дальше →</button>` : ""}
      <div class="header-actions" style="margin-top:18px">
        <a class="ghost" href="#/trainer/history" data-link>◷ История</a>
      </div>
    </section>
  `, "trainer");

  app.querySelectorAll("[data-option]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.lockedAnswer !== null) return;
      const answer = Number(button.dataset.option);
      state.lockedAnswer = answer;
      state.trainerAnswers.push(answer === question.correct);
      renderTrainer(kind);
    });
  });

  const next = app.querySelector("#next");
  if (next) {
    next.addEventListener("click", () => {
      state.questionIndex += 1;
      state.lockedAnswer = null;
      renderTrainer(kind);
    });
  }
}

function renderHistory() {
  const kind = ALGORITHM.kind;
  const attempts = getAttempts(kind);
  pageShell(`
    <a class="back" href="#/trainer" data-link>← К тренажёру</a>
    <h2 class="section-title">История попыток</h2>
    <div class="history-list">
      ${attempts.map((item) => `
        <div class="history-item">
          <strong>${item.score} / ${item.total}</strong>
          <span class="muted">${new Date(item.date).toLocaleString("ru-RU")}</span>
        </div>
      `).join("") || `<div class="panel muted">История пока пустая.</div>`}
    </div>
  `, "trainer");
}

function renderPhases(kind, phases, interactive) {
  const checked = getChecked(kind);
  const grouped = groupBy(phases, (phase) => phase.section || "Этапы");
  return Object.entries(grouped).map(([section, items]) => `
    <h2 class="section-title">${escapeHtml(section)}</h2>
    <div class="phase-list">
      ${items.map((phase) => `
        <article class="phase-card">
          <div class="phase-head">
            <div class="phase-num">${phase.id}</div>
            <div>
              <div class="muted">${escapeHtml(phase.subtitle || "")}</div>
              <h3>${escapeHtml(phase.title)}</h3>
              ${phase.description ? `<p class="desc">${escapeHtml(phase.description)}</p>` : ""}
            </div>
          </div>
          <div class="checks">
            ${phase.checks.map((check) => {
              const id = `${phase.id}:${check.id}`;
              return `
                <label class="check-row">
                  ${interactive ? `<input type="checkbox" data-check="${id}" ${checked[id] ? "checked" : ""}>` : `<span class="muted">${escapeHtml(check.id)}</span>`}
                  <span>${escapeHtml(check.text)}</span>
                  ${check.param ? `<span class="param">${escapeHtml(check.param)}</span>` : ""}
                </label>
              `;
            }).join("")}
          </div>
          ${(phase.warnings || []).map((warning) => `<div class="warning"><strong>${escapeHtml(warning.title)}</strong><br>${escapeHtml(warning.text)}</div>`).join("")}
          ${phase.positions?.length ? `<div class="chips">${phase.positions.map((pos) => `<span class="chip">${escapeHtml(pos)}</span>`).join("")}</div>` : ""}
        </article>
      `).join("")}
    </div>
  `).join("");
}

function renderSpecial(data) {
  if (!data.specialSituations?.length) return "";
  return `
    <h2 class="section-title">Особые ситуации</h2>
    <div class="special-grid">
      ${data.specialSituations.map((item) => `
        <article class="phase-card special">
          <h3>${escapeHtml(item.title)}</h3>
          <div class="checks" style="margin-top:12px">
            ${(item.checks || item.actions || []).map((check, index) => `
              <div class="check-row"><span class="muted">${index + 1}</span><span>${escapeHtml(check.text || check)}</span></div>
            `).join("")}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderAppendix(data) {
  if (!data.appendix) return "";
  const rows = data.appendix.rows || data.appendix.table || [];
  return `
    <section class="panel">
      <h2>${escapeHtml(data.appendix.title || "Приложение")}</h2>
      ${rows.length ? `
        <table>
          <tbody>
            ${rows.map((row) => `<tr>${Object.values(row).map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      ` : `<p class="answer-note">${escapeHtml(data.appendix.text || "")}</p>`}
    </section>
  `;
}

function filterPhases(phases, query) {
  const text = query.trim().toLowerCase();
  if (!text) return phases;
  return phases.filter((phase) => [
    phase.title,
    phase.subtitle,
    phase.section,
    ...(phase.positions || []),
    ...phase.checks.map((check) => `${check.text} ${check.param || ""}`),
  ].join(" ").toLowerCase().includes(text));
}

function getChecked(kind) {
  if (!state.checked[kind]) {
    state.checked[kind] = JSON.parse(localStorage.getItem(storageKey(kind, "checked")) || "{}");
  }
  return state.checked[kind];
}

function saveAttempt(kind, score, total) {
  const key = storageKey(kind, "attempts");
  const attempts = JSON.parse(localStorage.getItem(key) || "[]");
  const last = attempts[0];
  if (!last || Date.now() - new Date(last.date).getTime() > 1000) {
    attempts.unshift({ score, total, date: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(attempts.slice(0, 20)));
  }
}

function getAttempts(kind) {
  return JSON.parse(localStorage.getItem(storageKey(kind, "attempts")) || "[]");
}

function storageKey(kind, suffix) {
  return `upe:${kind}:${suffix}`;
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function notFound() {
  app.innerHTML = `<main class="shell"><h1 class="page-title">Страница не найдена</h1><a class="back" href="#/" data-link>← На главную</a></main>`;
}

function currentPath() {
  if (location.hash.startsWith("#/")) {
    return location.hash.slice(1).replace(/\/+$/, "") || "/";
  }
  if (location.protocol === "file:") return "/";
  return location.pathname.replace(/\/+$/, "") || "/";
}
