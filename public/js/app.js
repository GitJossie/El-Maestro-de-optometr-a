const state = {
  token: localStorage.getItem("token"),
  user: JSON.parse(localStorage.getItem("user") || "null"),
  categories: [],
  exam: null,
  currentQuestion: 0,
  answers: new Map()
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Error inesperado." }));
    throw new Error(error.message || "Error inesperado.");
  }
  if (response.status === 204) return null;
  return response.json();
}

function showMessage(text) {
  const message = $("#message");
  message.textContent = text;
  message.classList.remove("hidden");
  setTimeout(() => message.classList.add("hidden"), 4500);
}

function saveSession(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  state.token = null;
  state.user = null;
  $("#authView").classList.remove("hidden");
  $("#appView").classList.add("hidden");
  $("#mainNav").classList.add("hidden");
}

function canCreateQuestions() {
  return ["administrador", "creador"].includes(state.user?.role);
}

function switchView(name) {
  $$(".view").forEach((view) => view.classList.add("hidden"));
  $(`#${name}View`).classList.remove("hidden");
  if (name === "dashboard") loadDashboard();
  if (name === "questions") loadQuestions();
  if (name === "history") loadHistory();
}

async function boot() {
  bindEvents();
  if (!state.token) return;
  try {
    const data = await api("/api/auth/me");
    state.user = data.user;
    await enterApp();
  } catch (_error) {
    logout();
  }
}

function bindEvents() {
  $("[data-auth-tab='login']").addEventListener("click", () => setAuthTab("login"));
  $("[data-auth-tab='register']").addEventListener("click", () => setAuthTab("register"));
  $("#loginForm").addEventListener("submit", submitLogin);
  $("#registerForm").addEventListener("submit", submitRegister);
  $("#logoutBtn").addEventListener("click", logout);
  $$("#mainNav [data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $("#refreshQuestions").addEventListener("click", loadQuestions);
  $("#questionForm").addEventListener("submit", submitQuestion);
  $("#clearQuestionForm").addEventListener("click", clearQuestionForm);
  $("#bulkForm").addEventListener("submit", submitBulkImport);
  $("#examConfig").addEventListener("submit", startExam);
}

function setAuthTab(tab) {
  $$(".tabs button").forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
  $("#loginForm").classList.toggle("hidden", tab !== "login");
  $("#registerForm").classList.toggle("hidden", tab !== "register");
}

async function submitLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form))
    });
    saveSession(data);
    await enterApp();
  } catch (error) {
    alert(error.message);
  }
}

async function submitRegister(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form))
    });
    saveSession(data);
    await enterApp();
  } catch (error) {
    alert(error.message);
  }
}

async function enterApp() {
  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#mainNav").classList.remove("hidden");
  $("#creatorOnly").classList.toggle("hidden", !canCreateQuestions());
  $("#welcomeTitle").textContent = `Hola, ${state.user.name}`;
  await loadCategories();
  switchView("dashboard");
}

async function loadCategories() {
  state.categories = await api("/api/questions/categories");
  const options = [
    "<option value=''>Todas las categorias</option>",
    ...state.categories.map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`)
  ].join("");
  $("#filterCategory").innerHTML = options;
  $("#examCategory").innerHTML = options;
  $("#categoryList").innerHTML = state.categories.map((category) => `<option value="${escapeHtml(category.name)}"></option>`).join("");
}

async function loadDashboard() {
  if (!canCreateQuestions()) {
    const history = await api("/api/results/mine");
    $("#summaryGrid").innerHTML = [
      metric("Examenes", history.length),
      metric("Mejor porcentaje", history.length ? `${Math.max(...history.map((item) => item.percentage))}%` : "0%"),
      metric("Ultima nota", history[0]?.finalGrade || "0"),
      metric("Rol", state.user.role)
    ].join("");
    return;
  }
  const summary = await api("/api/admin/summary");
  $("#summaryGrid").innerHTML = [
    metric("Usuarios", summary.users),
    metric("Preguntas", summary.questions),
    metric("Examenes", summary.exams),
    metric("Resultados", summary.results)
  ].join("");
}

function metric(label, value) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`;
}

async function loadQuestions() {
  const params = new URLSearchParams();
  if ($("#searchQuestion").value) params.set("search", $("#searchQuestion").value);
  if ($("#filterCategory").value) params.set("category", $("#filterCategory").value);
  const questions = await api(`/api/questions?${params}`);
  $("#questionList").innerHTML = questions.map(renderQuestionItem).join("") || "<p>No hay preguntas con esos filtros.</p>";
  $$(".edit-question").forEach((button) => button.addEventListener("click", () => editQuestion(button.dataset.id)));
  $$(".delete-question").forEach((button) => button.addEventListener("click", () => deleteQuestion(button.dataset.id)));
}

function renderQuestionItem(question) {
  const actions = canCreateQuestions()
    ? `<div class="item-actions"><button class="edit-question" data-id="${question.id}">Editar</button><button class="delete-question danger" data-id="${question.id}">Eliminar</button></div>`
    : "";
  return `
    <article class="question-item">
      <div>
        <strong>${escapeHtml(question.title)}</strong>
        <div class="question-meta">
          <span>${escapeHtml(question.category || "General")}</span>
          <span>${escapeHtml(question.type)}</span>
          <span>${escapeHtml(question.difficulty)}</span>
          <span>${question.points} punto(s)</span>
          <span>${question.answer_count} opciones</span>
        </div>
      </div>
      ${actions}
    </article>
  `;
}

async function editQuestion(id) {
  const question = await api(`/api/questions/${id}`);
  const form = $("#questionForm");
  form.elements.id.value = question.id;
  form.elements.title.value = question.title;
  form.elements.description.value = question.description || "";
  form.elements.type.value = question.type;
  form.elements.category.value = question.category || "";
  form.elements.difficulty.value = question.difficulty;
  form.elements.points.value = question.points;
  form.elements.explanation.value = question.explanation || "";
  form.elements.bibliography.value = question.bibliography || "";
  form.elements.sourceUrl.value = question.source_url || "";
  $$("input[name='answer']").forEach((input, index) => {
    input.value = question.answers[index]?.text || "";
  });
  const correctIndex = question.answers.findIndex((answer) => answer.isCorrect);
  const correct = $(`input[name='correct'][value='${Math.max(correctIndex, 0)}']`);
  if (correct) correct.checked = true;
  showMessage("Pregunta cargada para edicion.");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteQuestion(id) {
  if (!confirm("¿Eliminar esta pregunta?")) return;
  await api(`/api/questions/${id}`, { method: "DELETE" });
  showMessage("Pregunta eliminada.");
  loadQuestions();
}

async function submitQuestion(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const answers = $$("input[name='answer']")
    .map((input, index) => ({ text: input.value.trim(), isCorrect: Number(data.get("correct")) === index }))
    .filter((answer) => answer.text);
  data.set("answers", JSON.stringify(answers));
  const id = data.get("id");
  if (!data.get("image").name) data.delete("image");
  data.delete("id");
  data.delete("answer");
  data.delete("correct");

  try {
    await api(id ? `/api/questions/${id}` : "/api/questions", {
      method: id ? "PUT" : "POST",
      body: data
    });
    clearQuestionForm();
    await loadCategories();
    await loadQuestions();
    showMessage("Pregunta guardada correctamente.");
  } catch (error) {
    alert(error.message);
  }
}

function clearQuestionForm() {
  $("#questionForm").reset();
  $("#questionForm").elements.id.value = "";
}

async function submitBulkImport(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    const result = await api("/api/questions/bulk-import", { method: "POST", body: data });
    await loadCategories();
    await loadQuestions();
    showMessage(`Importacion lista: ${result.created} preguntas creadas, ${result.errors.length} filas con error.`);
  } catch (error) {
    alert(error.message);
  }
}

async function startExam(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  try {
    state.exam = await api("/api/exams/start", { method: "POST", body: JSON.stringify(form) });
    state.currentQuestion = 0;
    state.answers = new Map();
    $("#examResult").classList.add("hidden");
    $("#examRunner").classList.remove("hidden");
    renderExamQuestion();
  } catch (error) {
    alert(error.message);
  }
}

function renderExamQuestion() {
  const question = state.exam.questions[state.currentQuestion];
  const selected = state.answers.get(question.id);
  $("#examRunner").innerHTML = `
    <div class="exam-question">
      <span class="progress-line">Pregunta ${state.currentQuestion + 1} de ${state.exam.questions.length}</span>
      <h3>${escapeHtml(question.title)}</h3>
      <p>${escapeHtml(question.description || "")}</p>
      ${question.imagePath ? `<img src="${question.imagePath}" alt="Imagen de la pregunta" style="max-width:100%;border-radius:8px">` : ""}
      ${question.imageUrl ? `<img src="${question.imageUrl}" alt="Imagen de la pregunta" style="max-width:100%;border-radius:8px">` : ""}
      <div>
        ${question.answers.map((answer) => `
          <label class="answer-option">
            <input type="radio" name="examAnswer" value="${answer.id}" ${selected === answer.id ? "checked" : ""}>
            <span>${escapeHtml(answer.text)}</span>
          </label>
        `).join("")}
      </div>
      <div class="form-actions">
        <button id="prevQuestion" type="button" ${state.currentQuestion === 0 ? "disabled" : ""}>Anterior</button>
        <button id="nextQuestion" class="primary" type="button">${state.currentQuestion === state.exam.questions.length - 1 ? "Finalizar" : "Siguiente"}</button>
      </div>
    </div>
  `;
  $$("input[name='examAnswer']").forEach((input) => {
    input.addEventListener("change", () => state.answers.set(question.id, Number(input.value)));
  });
  $("#prevQuestion").addEventListener("click", () => {
    state.currentQuestion -= 1;
    renderExamQuestion();
  });
  $("#nextQuestion").addEventListener("click", nextExamStep);
}

async function nextExamStep() {
  if (state.currentQuestion < state.exam.questions.length - 1) {
    state.currentQuestion += 1;
    renderExamQuestion();
    return;
  }
  const payload = {
    answers: [...state.answers.entries()].map(([questionId, answerId]) => ({ questionId, answerId }))
  };
  const result = await api(`/api/exams/${state.exam.examId}/submit`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  renderExamResult(result);
}

function renderExamResult(result) {
  $("#examRunner").classList.add("hidden");
  $("#examResult").classList.remove("hidden");
  $("#examResult").innerHTML = `
    <h3>Resultado final</h3>
    <div class="result-stats">
      ${metric("Correctas", result.correctCount)}
      ${metric("Incorrectas", result.incorrectCount)}
      ${metric("Porcentaje", `${result.percentage}%`)}
      ${metric("Nota final", result.finalGrade)}
    </div>
    ${result.details.map((detail) => `
      <article class="review-item">
        <strong>${detail.isCorrect ? "Correcta" : "Incorrecta"}: ${escapeHtml(detail.title)}</strong>
        <p>Tu respuesta: ${escapeHtml(detail.selectedAnswer)}</p>
        <p>Respuesta correcta: ${escapeHtml(detail.correctAnswer)}</p>
        <p>${escapeHtml(detail.explanation || "")}</p>
        <small>${escapeHtml(detail.bibliography || "")}</small>
      </article>
    `).join("")}
  `;
  loadDashboard();
}

async function loadHistory() {
  const path = state.user.role === "administrador" ? "/api/results" : "/api/results/mine";
  const results = await api(path);
  $("#historyList").innerHTML = results.map((result) => `
    <article class="history-item">
      <strong>${result.userName ? `${escapeHtml(result.userName)} - ` : ""}${result.percentage}%</strong>
      <span>${result.correctCount} correctas, ${result.incorrectCount} incorrectas, nota ${result.finalGrade}, ${new Date(result.createdAt).toLocaleString()}</span>
    </article>
  `).join("") || "<p>Aun no hay resultados.</p>";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

boot();
