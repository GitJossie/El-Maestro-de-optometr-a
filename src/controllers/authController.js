const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const userModel = require("../models/userModel");

function signUser(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: "8h" }
  );
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function register(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Nombre, correo y contrasena son obligatorios." });
  }

  const role = userModel.findRoleByName("evaluado");
  try {
    const user = userModel.createUser({
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      roleId: role.id
    });
    res.status(201).json({ user: publicUser(user), token: signUser(user) });
  } catch (error) {
    res.status(409).json({ message: "Ese correo ya esta registrado." });
  }
}

function login(req, res) {
  const { email, password } = req.body;
  const user = userModel.findByEmail(email);

  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ message: "Correo o contrasena incorrectos." });
  }

  res.json({ user: publicUser(user), token: signUser(user) });
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, me };
