const fs = require("fs");
const express = require("express");
const cors = require("cors");
const path = require("path");
const { port, uploadDir } = require("./config/env");
const { initDatabase } = require("./database/db");
const authRoutes = require("./routes/authRoutes");
const questionRoutes = require("./routes/questionRoutes");
const examRoutes = require("./routes/examRoutes");
const resultRoutes = require("./routes/resultRoutes");
const adminRoutes = require("./routes/adminRoutes");

fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.resolve(__dirname, "..", "public")));

app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "El maestro de optometria" }));

app.use((_req, res) => {
  res.sendFile(path.resolve(__dirname, "..", "public", "index.html"));
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`El maestro de optometria esta listo en http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("No se pudo iniciar la base de datos:", error);
    process.exit(1);
  });
