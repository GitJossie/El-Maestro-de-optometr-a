const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.get("/summary", authenticate, requireRole("administrador", "creador"), adminController.summary);

module.exports = router;
