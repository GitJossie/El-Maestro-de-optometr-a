const resultModel = require("../models/resultModel");

function mine(req, res) {
  res.json(resultModel.listByUser(req.user.id));
}

function list(_req, res) {
  res.json(resultModel.listAll());
}

module.exports = { mine, list };
