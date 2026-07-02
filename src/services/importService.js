const XLSX = require("xlsx");
const { createQuestion } = require("./questionService");

function readRows(filePath) {
  const workbook = XLSX.readFile(filePath);
  const firstSheet = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
}

function importQuestions(filePath, userId) {
  const rows = readRows(filePath);
  const created = [];
  const errors = [];

  rows.forEach((row, index) => {
    try {
      const correct = String(row["Respuesta Correcta"] || "").trim().toUpperCase();
      const answers = ["A", "B", "C", "D"]
        .map((letter) => ({
          text: row[`Respuesta ${letter}`],
          isCorrect: correct === letter || String(row[`Respuesta ${letter}`]).trim() === correct
        }))
        .filter((answer) => answer.text);

      const question = createQuestion({
        category: row.Categoria || row["Categoría"] || "General",
        title: row.Pregunta,
        description: row.Descripcion || row["Descripción"] || "",
        type: row.Tipo || "multiple_choice",
        difficulty: row.Dificultad || "media",
        points: row.Valor || 1,
        answers,
        explanation: row["Explicacion"] || row["Explicación"] || "",
        bibliography: row.Referencia || "",
        imageUrl: row.Imagen || ""
      }, userId);
      created.push(question.id);
    } catch (error) {
      errors.push({ row: index + 2, message: error.message });
    }
  });

  return { created: created.length, errors };
}

module.exports = { importQuestions };
