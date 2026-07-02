const express = require("express");
const multer = require("multer");
const { uploadDir } = require("../config/env");
const { authenticate, requireRole } = require("../middleware/auth");
const questionController = require("../controllers/questionController");

const router = express.Router();
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});
const upload = multer({ storage });
const canManage = requireRole("administrador", "creador");

router.get("/categories", authenticate, questionController.listCategories);
router.post("/bulk-import", authenticate, canManage, upload.single("file"), questionController.bulkImport);
router.get("/", authenticate, questionController.list);
router.get("/:id", authenticate, questionController.detail);
router.post("/", authenticate, canManage, upload.single("image"), questionController.create);
router.put("/:id", authenticate, canManage, upload.single("image"), questionController.update);
router.delete("/:id", authenticate, canManage, questionController.remove);

module.exports = router;
