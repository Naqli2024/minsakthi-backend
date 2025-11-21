const express = require("express");
const router = express.Router();
const {
  getAllProcessTemplates,
  getProcessTemplateById,
  createProcessTemplate,
  updateProcessTemplate,
  deleteProcessTemplate,
} = require("../controllers/processTemplateController");

router.get("/process-templates", getAllProcessTemplates);
router.get("/process-templates/:id", getProcessTemplateById);
router.post("/create-process-templates", createProcessTemplate);
router.put("/process-edit-templates/:id", updateProcessTemplate);
router.delete("/process-delete-templates/:id", deleteProcessTemplate);

module.exports = router;