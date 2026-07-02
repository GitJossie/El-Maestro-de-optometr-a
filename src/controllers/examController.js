const examModel = require("../models/examModel");
const { getQuestion, publicQuestion } = require("../services/questionService");

function start(req, res) {
  const amount = Math.max(1, Math.min(Number(req.body.amount || 5), 50));
  const questions = examModel.findRandomQuestionIds({
    amount,
    category: req.body.category,
    difficulty: req.body.difficulty
  });

  if (!questions.length) {
    return res.status(400).json({ message: "No hay preguntas disponibles con esos filtros." });
  }

  const examId = examModel.createExam(req.user.id, amount, questions);
  res.status(201).json({
    examId,
    questions: questions.map((question) => publicQuestion(getQuestion(question.id)))
  });
}

function submit(req, res) {
  const exam = examModel.findStartedExamForUser(req.params.id, req.user.id);
  if (!exam) return res.status(404).json({ message: "Examen no encontrado." });
  if (exam.status === "finished") return res.status(409).json({ message: "Este examen ya fue enviado." });

  const submitted = new Map((req.body.answers || []).map((item) => [Number(item.questionId), Number(item.answerId)]));
  const examQuestions = examModel.listExamQuestionIds(req.params.id);
  const details = [];
  let correctCount = 0;
  let totalPoints = 0;
  let earnedPoints = 0;

  examQuestions.forEach(({ id }) => {
    const question = getQuestion(id);
    const selectedAnswerId = submitted.get(id) || null;
    const correctAnswer = question.answers.find((answer) => answer.isCorrect);
    const selected = question.answers.find((answer) => answer.id === selectedAnswerId);
    const isCorrect = Boolean(selected && selected.isCorrect);
    const points = Number(question.points || 1);
    totalPoints += points;
    if (isCorrect) {
      correctCount += 1;
      earnedPoints += points;
    }
    details.push({
      questionId: question.id,
      title: question.title,
      selectedAnswer: selected ? selected.text : "Sin respuesta",
      correctAnswer: correctAnswer ? correctAnswer.text : "",
      isCorrect,
      points,
      explanation: question.explanation,
      bibliography: question.bibliography,
      sourceUrl: question.source_url
    });
  });

  const incorrectCount = examQuestions.length - correctCount;
  const percentage = totalPoints ? Number(((earnedPoints / totalPoints) * 100).toFixed(2)) : 0;
  const finalGrade = Number(((percentage / 100) * 5).toFixed(2));
  const resultId = examModel.saveResult({
    examId: req.params.id,
    userId: req.user.id,
    correctCount,
    incorrectCount,
    totalQuestions: examQuestions.length,
    totalPoints,
    earnedPoints,
    percentage,
    finalGrade,
    details,
    submitted
  });

  res.json({
    resultId,
    correctCount,
    incorrectCount,
    totalQuestions: examQuestions.length,
    totalPoints,
    earnedPoints,
    percentage,
    finalGrade,
    details
  });
}

module.exports = { start, submit };
