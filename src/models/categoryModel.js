const { db } = require("../database/db");

function listCategories() {
  return db.prepare("SELECT id, name, description FROM categories ORDER BY name").all();
}

module.exports = { listCategories };
