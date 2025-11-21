const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  createService,
  bulkUploadServices,
  getAllServices,
  getServiceByServiceId,
  deleteService,
} = require("../controllers/serviceController");
const multer = require("multer");
const upload = multer();

// Create (Manual)
router.post("/create-service", authMiddleware, createService);

// Bulk Upload (Excel/CSV)
router.post("/bulk-upload", authMiddleware, upload.single("file"), bulkUploadServices);

// Get All Services
router.get("/getAllServices", authMiddleware, getAllServices);

// Get Service By ServiceId
router.get("/service/:serviceId", authMiddleware, getServiceByServiceId);

// Delete Services
router.delete("/delete-service/:id", authMiddleware, deleteService);

module.exports = router;