const path = require("path");
require("dotenv").config();

const root = path.resolve(__dirname, "..", "..");

module.exports = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || "desarrollo_optometria_secret",
  databasePath: path.resolve(root, process.env.DATABASE_PATH || "src/database/optometria.sqlite"),
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || "uploads")
};
