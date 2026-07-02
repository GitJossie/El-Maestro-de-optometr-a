const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");
const bcrypt = require("bcryptjs");
const { databasePath } = require("../config/env");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

let database;
let SQL;
let transactionDepth = 0;

function persist() {
  if (!database || transactionDepth > 0) return;
  fs.writeFileSync(databasePath, Buffer.from(database.export()));
}

function toBindParams(args) {
  if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
    const named = {};
    Object.entries(args[0]).forEach(([key, value]) => {
      named[key] = value;
      named[`@${key}`] = value;
      named[`:${key}`] = value;
      named[`$${key}`] = value;
    });
    return named;
  }
  return args;
}

function rowsFromStatement(statement) {
  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  return rows;
}

const db = {
  pragma() {
    return null;
  },

  exec(sql) {
    database.exec(sql);
    persist();
  },

  prepare(sql) {
    return {
      run(...args) {
        const statement = database.prepare(sql);
        statement.bind(toBindParams(args));
        while (statement.step()) {
          // SQL.js requires stepping through the statement to finish execution.
        }
        statement.free();
        const lastInsertRowid = database.exec("SELECT last_insert_rowid() AS id")[0]?.values[0]?.[0] || 0;
        const changes = database.getRowsModified();
        persist();
        return { lastInsertRowid, changes };
      },

      get(...args) {
        const statement = database.prepare(sql);
        statement.bind(toBindParams(args));
        const row = statement.step() ? statement.getAsObject() : undefined;
        statement.free();
        return row;
      },

      all(...args) {
        const statement = database.prepare(sql);
        statement.bind(toBindParams(args));
        const rows = rowsFromStatement(statement);
        statement.free();
        return rows;
      }
    };
  },

  transaction(fn) {
    return (...args) => {
      database.exec("BEGIN");
      transactionDepth += 1;
      try {
        const result = fn(...args);
        transactionDepth -= 1;
        database.exec("COMMIT");
        persist();
        return result;
      } catch (error) {
        transactionDepth -= 1;
        database.exec("ROLLBACK");
        throw error;
      }
    };
  }
};

async function loadDatabase() {
  SQL = await initSqlJs({
    locateFile: (file) => path.resolve(__dirname, "..", "..", "node_modules", "sql.js", "dist", file)
  });

  if (fs.existsSync(databasePath)) {
    database = new SQL.Database(fs.readFileSync(databasePath));
  } else {
    database = new SQL.Database();
  }
}

async function initDatabase() {
  await loadDatabase();
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS media_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      path TEXT NOT NULL,
      uploaded_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'multiple_choice',
      category_id INTEGER,
      difficulty TEXT NOT NULL DEFAULT 'media',
      points REAL NOT NULL DEFAULT 1,
      explanation TEXT,
      bibliography TEXT,
      source_url TEXT,
      image_id INTEGER,
      image_url TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (image_id) REFERENCES media_files(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'started',
      requested_count INTEGER NOT NULL,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS exam_questions (
      exam_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (exam_id, question_id),
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      incorrect_count INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      total_points REAL NOT NULL,
      earned_points REAL NOT NULL,
      percentage REAL NOT NULL,
      final_grade REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_id) REFERENCES exams(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS result_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      result_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      answer_id INTEGER,
      is_correct INTEGER NOT NULL,
      earned_points REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (result_id) REFERENCES results(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (answer_id) REFERENCES answers(id)
    );
  `);

  seedBaseData();
  persist();
}

function seedBaseData() {
  const roleInsert = db.prepare("INSERT OR IGNORE INTO roles (name) VALUES (?)");
  ["administrador", "creador", "evaluado"].forEach((role) => roleInsert.run(role));

  const categoryInsert = db.prepare("INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)");
  [
    ["Refraccion", "Optica, ametropias y refraccion clinica."],
    ["Patologia ocular", "Signos clinicos, diagnostico y conducta."],
    ["Lentes de contacto", "Adaptacion, materiales y complicaciones."],
    ["Optometria pediatrica", "Evaluacion visual en poblacion infantil."]
  ].forEach((category) => categoryInsert.run(...category));

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (!userCount) {
    const roleStatement = db.prepare("SELECT id FROM roles WHERE name = ?");
    const insertUser = db.prepare("INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)");
    [
      ["Administrador", "admin@optometria.local", "admin123", "administrador"],
      ["Creador de preguntas", "creador@optometria.local", "creador123", "creador"],
      ["Usuario evaluado", "usuario@optometria.local", "usuario123", "evaluado"]
    ].forEach(([name, email, password, roleName]) => {
      insertUser.run(name, email, bcrypt.hashSync(password, 10), roleStatement.get(roleName).id);
    });
  }

  const questionCount = db.prepare("SELECT COUNT(*) AS count FROM questions").get().count;
  if (!questionCount) {
    createSeedQuestions();
  }
}

function createSeedQuestions() {
  const admin = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@optometria.local");
  const categoryStatement = db.prepare("SELECT id FROM categories WHERE name = ?");
  const insertQuestion = db.prepare(`
    INSERT INTO questions
    (title, description, type, category_id, difficulty, points, explanation, bibliography, source_url, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAnswer = db.prepare("INSERT INTO answers (question_id, text, is_correct, position) VALUES (?, ?, ?, ?)");

  const samples = [
    {
      title: "¿Que defecto refractivo se corrige con lentes negativos?",
      description: "Pregunta basica sobre ametropias y potencia correctiva.",
      type: "multiple_choice",
      category: "Refraccion",
      difficulty: "facil",
      points: 1,
      explanation: "La miopia enfoca la imagen por delante de la retina y se corrige con lentes divergentes o negativos.",
      bibliography: "Borish's Clinical Refraction.",
      answers: [["Miopia", 1], ["Hipermetropia", 0], ["Presbicia", 0], ["Afaquia", 0]]
    },
    {
      title: "El queratocono produce adelgazamiento y protrusion corneal.",
      description: "Verdadero o falso sobre una ectasia corneal frecuente.",
      type: "true_false",
      category: "Patologia ocular",
      difficulty: "facil",
      points: 1,
      explanation: "El queratocono es una ectasia progresiva con protrusion corneal y astigmatismo irregular.",
      bibliography: "Kanski, Oftalmologia clinica.",
      answers: [["Verdadero", 1], ["Falso", 0]]
    },
    {
      title: "Paciente con vision borrosa cercana a los 45 anos",
      description: "Un paciente de 45 anos refiere dificultad para leer de cerca que mejora al alejar el texto. ¿Cual es la causa mas probable?",
      type: "clinical_case",
      category: "Optometria pediatrica",
      difficulty: "media",
      points: 2,
      explanation: "La presbicia se asocia a perdida progresiva de acomodacion, tipicamente desde la cuarta decada.",
      bibliography: "Primary Care Optometry.",
      answers: [["Presbicia", 1], ["Ambliopia", 0], ["Catarata congenita", 0], ["Estrabismo acomodativo", 0]]
    }
  ];

  samples.forEach((item) => {
    const info = insertQuestion.run(
      item.title,
      item.description,
      item.type,
      categoryStatement.get(item.category).id,
      item.difficulty,
      item.points,
      item.explanation,
      item.bibliography,
      "",
      admin.id
    );
    item.answers.forEach(([text, isCorrect], index) => insertAnswer.run(info.lastInsertRowid, text, isCorrect, index));
  });
}

module.exports = { db, initDatabase };
