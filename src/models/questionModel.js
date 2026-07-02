const { db } = require("../database/db");

function getOrCreateCategory(name) {
  const cleanName = (name || "General").trim();
  db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)").run(cleanName);
  return db.prepare("SELECT id, name FROM categories WHERE name = ?").get(cleanName);
}

function createMedia(file, userId) {
  if (!file) return null;
  const result = db.prepare(`
    INSERT INTO media_files (original_name, file_name, mime_type, path, uploaded_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(file.originalname, file.filename, file.mimetype, `/uploads/${file.filename}`, userId);
  return result.lastInsertRowid;
}

function insertQuestion(payload, categoryId, answers, userId, mediaId = null) {
  return db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO questions
      (title, description, type, category_id, difficulty, points, explanation, bibliography, source_url, image_id, image_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.title,
      payload.description || "",
      payload.type || "multiple_choice",
      categoryId,
      payload.difficulty || "media",
      Number(payload.points || 1),
      payload.explanation || "",
      payload.bibliography || payload.reference || "",
      payload.sourceUrl || payload.source_url || "",
      mediaId,
      payload.imageUrl || "",
      userId
    );

    replaceAnswers(result.lastInsertRowid, answers);
    return result.lastInsertRowid;
  })();
}

function updateQuestion(id, payload, categoryId, answers, imageId, fallbackImageUrl = "") {
  db.transaction(() => {
    db.prepare(`
      UPDATE questions
      SET title = ?, description = ?, type = ?, category_id = ?, difficulty = ?, points = ?,
          explanation = ?, bibliography = ?, source_url = ?, image_id = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      payload.title,
      payload.description || "",
      payload.type,
      categoryId,
      payload.difficulty || "media",
      Number(payload.points || 1),
      payload.explanation || "",
      payload.bibliography || payload.reference || "",
      payload.sourceUrl || payload.source_url || "",
      imageId,
      payload.imageUrl || fallbackImageUrl || "",
      id
    );

    if (answers.length) replaceAnswers(id, answers);
  })();
}

function replaceAnswers(questionId, answers) {
  db.prepare("DELETE FROM answers WHERE question_id = ?").run(questionId);
  const insertAnswer = db.prepare("INSERT INTO answers (question_id, text, is_correct, position) VALUES (?, ?, ?, ?)");
  answers.forEach((answer, index) => {
    if ((answer.text || "").trim()) {
      insertAnswer.run(questionId, answer.text.trim(), answer.isCorrect ? 1 : 0, index);
    }
  });
}

function findById(id) {
  const question = db.prepare(`
    SELECT q.*, c.name AS category, m.path AS image_path
    FROM questions q
    LEFT JOIN categories c ON c.id = q.category_id
    LEFT JOIN media_files m ON m.id = q.image_id
    WHERE q.id = ?
  `).get(id);
  if (!question) return null;
  question.answers = db.prepare("SELECT id, text, is_correct AS isCorrect, position FROM answers WHERE question_id = ? ORDER BY position").all(id);
  return question;
}

function list(filters = {}) {
  const clauses = [];
  const params = {};
  if (filters.search) {
    clauses.push("(q.title LIKE @search OR q.description LIKE @search OR q.explanation LIKE @search)");
    params.search = `%${filters.search}%`;
  }
  if (filters.category) {
    clauses.push("c.name = @category");
    params.category = filters.category;
  }
  if (filters.difficulty) {
    clauses.push("q.difficulty = @difficulty");
    params.difficulty = filters.difficulty;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`
    SELECT q.id, q.title, q.type, q.difficulty, q.points, q.created_at, c.name AS category,
           COUNT(a.id) AS answer_count
    FROM questions q
    LEFT JOIN categories c ON c.id = q.category_id
    LEFT JOIN answers a ON a.question_id = q.id
    ${where}
    GROUP BY q.id
    ORDER BY q.updated_at DESC, q.id DESC
  `).all(params);
}

function remove(id) {
  return db.prepare("DELETE FROM questions WHERE id = ?").run(id);
}

module.exports = {
  getOrCreateCategory,
  createMedia,
  insertQuestion,
  updateQuestion,
  findById,
  list,
  remove
};
