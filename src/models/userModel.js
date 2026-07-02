const { db } = require("../database/db");

function findByEmail(email) {
  return db.prepare(`
    SELECT u.id, u.name, u.email, u.password_hash, r.name AS role
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.email = ?
  `).get(String(email || "").toLowerCase());
}

function findRoleByName(name) {
  return db.prepare("SELECT id, name FROM roles WHERE name = ?").get(name);
}

function createUser({ name, email, passwordHash, roleId }) {
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role_id)
    VALUES (?, ?, ?, ?)
  `).run(name, email.toLowerCase(), passwordHash, roleId);
  return findPublicById(result.lastInsertRowid);
}

function findPublicById(id) {
  return db.prepare(`
    SELECT u.id, u.name, u.email, r.name AS role
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
  `).get(id);
}

module.exports = {
  findByEmail,
  findRoleByName,
  createUser,
  findPublicById
};
