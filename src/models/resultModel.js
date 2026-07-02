const { db } = require("../database/db");

function listByUser(userId) {
  return db.prepare(`
    SELECT id, correct_count AS correctCount, incorrect_count AS incorrectCount,
           total_questions AS totalQuestions, percentage, final_grade AS finalGrade, created_at AS createdAt
    FROM results
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);
}

function listAll() {
  return db.prepare(`
    SELECT r.id, u.name AS userName, u.email, r.correct_count AS correctCount,
           r.incorrect_count AS incorrectCount, r.total_questions AS totalQuestions,
           r.percentage, r.final_grade AS finalGrade, r.created_at AS createdAt
    FROM results r
    JOIN users u ON u.id = r.user_id
    ORDER BY r.created_at DESC
  `).all();
}

module.exports = { listByUser, listAll };
