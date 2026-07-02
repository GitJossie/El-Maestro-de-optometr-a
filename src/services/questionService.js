const questionModel = require("../models/questionModel");

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getOrCreateCategory(name) {
  return questionModel.getOrCreateCategory(name);
}

function normalizeAnswers(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === "string") return JSON.parse(input);
  return [];
}

function createQuestion(payload, userId, mediaId = null) {
  const category = getOrCreateCategory(payload.category || payload.categoryName);
  const answers = normalizeAnswers(payload.answers);
  if (!payload.title || answers.length < 2) {
    throw new Error("La pregunta necesita enunciado y al menos dos respuestas.");
  }
  if (!answers.some((answer) => Boolean(answer.isCorrect))) {
    throw new Error("Debes marcar una respuesta correcta.");
  }

  const questionId = questionModel.insertQuestion(payload, category.id, answers, userId, mediaId);
  return getQuestion(questionId);
}

function updateQuestion(id, payload, mediaId = undefined) {
  const existing = getQuestion(id);
  if (!existing) throw new Error("La pregunta no existe.");

  const category = getOrCreateCategory(payload.category || payload.categoryName || existing.category);
  const imageId = mediaId === undefined ? existing.image_id : mediaId;
  const answers = normalizeAnswers(payload.answers);

  questionModel.updateQuestion(id, {
    title: payload.title || existing.title,
    description: payload.description || "",
    type: payload.type || existing.type,
    difficulty: payload.difficulty || existing.difficulty,
    points: payload.points || existing.points || 1,
    explanation: payload.explanation || "",
    bibliography: payload.bibliography || payload.reference || "",
    sourceUrl: payload.sourceUrl || payload.source_url || ""
  }, category.id, answers, imageId, existing.image_url);
  return getQuestion(id);
}

function getQuestion(id) {
  return questionModel.findById(id);
}

function listQuestions(filters = {}) {
  return questionModel.list(filters);
}

function deleteQuestion(id) {
  return questionModel.remove(id);
}

function createMedia(file, userId) {
  return questionModel.createMedia(file, userId);
}

function publicQuestion(question) {
  return {
    id: question.id,
    title: question.title,
    description: question.description,
    type: question.type,
    category: question.category,
    difficulty: question.difficulty,
    points: question.points,
    imagePath: question.image_path,
    imageUrl: question.image_url,
    answers: shuffle(question.answers).map((answer) => ({ id: answer.id, text: answer.text }))
  };
}

module.exports = {
  createQuestion,
  updateQuestion,
  getQuestion,
  listQuestions,
  deleteQuestion,
  createMedia,
  getOrCreateCategory,
  publicQuestion,
  shuffle
};
