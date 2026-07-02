const express = require("express");
const { authenticate } = require("../middleware/auth");
const examController = require("../controllers/examController");

const router = express.Router();

router.post("/start", authenticate, examController.start);
router.post("/:id/submit", authenticate, examController.submit);

module.exports = router;
