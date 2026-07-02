const path = require("path");
const categoryModel = require("../models/categoryModel");
const {
  createQuestion,
  updateQuestion,
  getQuestion,
  listQuestions,
  deleteQuestion,
  createMedia
} = require("../services/questionService");
const { importQuestions } = require("../services/importService");

function listCategories(_req, res) {
  res.json(categoryModel.listCategories());
}

function list(req, res) {
  res.json(listQuestions(req.query));
}

function detail(req, res) {
  const question = getQuestion(req.params.id);
  if (!question) return res.status(404).json({ message: "Pregunta no encontrada." });
  res.json(question);
}

function create(req, res) {
  try {
    const mediaId = createMedia(req.file, req.user.id);
    const question = createQuestion(req.body, req.user.id, mediaId);
    res.status(201).json(question);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

function update(req, res) {
  try {
    const mediaId = req.file ? createMedia(req.file, req.user.id) : undefined;
    res.json(updateQuestion(req.params.id, req.body, mediaId));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

function remove(req, res) {
  deleteQuestion(req.params.id);
  res.status(204).end();
}

function bulkImport(req, res) {
  if (!req.file) return res.status(400).json({ message: "Debes adjuntar un archivo CSV o Excel." });
  const extension = path.extname(req.file.originalname).toLowerCase();
  if (![".csv", ".xlsx", ".xls"].includes(extension)) {
    return res.status(400).json({ message: "Formato no soportado. Usa CSV, XLS o XLSX." });
  }
  res.json(importQuestions(req.file.path, req.user.id));
}

module.exports = {
  listCategories,
  list,
  detail,
  create,
  update,
  remove,
  bulkImport
};
