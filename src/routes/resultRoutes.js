const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const resultController = require("../controllers/resultController");

const router = express.Router();

router.get("/mine", authenticate, resultController.mine);
router.get("/", authenticate, requireRole("administrador"), resultController.list);

module.exports = router;
