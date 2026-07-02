const { db } = require("../database/db");

function findRandomQuestionIds({ amount, category, difficulty }) {
  const clauses = ["1 = 1"];
  const params = {};
  if (category) {
    clauses.push("c.name = @category");
    params.category = category;
  }
  if (difficulty) {
    clauses.push("q.difficulty = @difficulty");
    params.difficulty = difficulty;
  }

  return db.prepare(`
    SELECT q.id
    FROM questions q
    LEFT JOIN categories c ON c.id = q.category_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY RANDOM()
    LIMIT @amount
  `).all({ ...params, amount });
}

function createExam(userId, requestedCount, questionIds) {
  return db.transaction(() => {
    const exam = db.prepare("INSERT INTO exams (user_id, requested_count) VALUES (?, ?)").run(userId, requestedCount);
    const insertExamQuestion = db.prepare("INSERT INTO exam_questions (exam_id, question_id, position) VALUES (?, ?, ?)");
    questionIds.forEach((question, index) => insertExamQuestion.run(exam.lastInsertRowid, question.id, index));
    return exam.lastInsertRowid;
  })();
}

function findStartedExamForUser(examId, userId) {
  return db.prepare("SELECT * FROM exams WHERE id = ? AND user_id = ?").get(examId, userId);
}

function listExamQuestionIds(examId) {
  return db.prepare(`
    SELECT q.id
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.position
  `).all(examId);
}

function saveResult({ examId, userId, correctCount, incorrectCount, totalQuestions, totalPoints, earnedPoints, percentage, finalGrade, details, submitted }) {
  return db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO results
      (exam_id, user_id, correct_count, incorrect_count, total_questions, total_points, earned_points, percentage, final_grade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(examId, userId, correctCount, incorrectCount, totalQuestions, totalPoints, earnedPoints, percentage, finalGrade);

    const insertAnswer = db.prepare(`
      INSERT INTO result_answers (result_id, question_id, answer_id, is_correct, earned_points)
      VALUES (?, ?, ?, ?, ?)
    `);
    details.forEach((detail) => {
      insertAnswer.run(
        result.lastInsertRowid,
        detail.questionId,
        submitted.get(detail.questionId) || null,
        detail.isCorrect ? 1 : 0,
        detail.isCorrect ? detail.points : 0
      );
    });
    db.prepare("UPDATE exams SET status = 'finished', finished_at = CURRENT_TIMESTAMP WHERE id = ?").run(examId);
    return result.lastInsertRowid;
  })();
}

module.exports = {
  findRandomQuestionIds,
  createExam,
  findStartedExamForUser,
  listExamQuestionIds,
  saveResult
};
