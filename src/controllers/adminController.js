const adminModel = require("../models/adminModel");

function summary(_req, res) {
  res.json(adminModel.getSummary());
}

module.exports = { summary };
