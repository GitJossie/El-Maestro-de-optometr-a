const { db } = require("../database/db");

function getSummary() {
  return {
    users: db.prepare("SELECT COUNT(*) AS total FROM users").get().total,
    questions: db.prepare("SELECT COUNT(*) AS total FROM questions").get().total,
    exams: db.prepare("SELECT COUNT(*) AS total FROM exams").get().total,
    results: db.prepare("SELECT COUNT(*) AS total FROM results").get().total
  };
}

module.exports = { getSummary };
