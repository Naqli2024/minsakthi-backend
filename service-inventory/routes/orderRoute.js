const express = require("express");
const router = express.Router();
const { upload } = require("../middleware/uploadToGCS");
const {
  createOrder,
  getAllOrders,
  findOrdersByCustomer,
  findOrderByOrderId,
  deleteOrderByOrderId,
  getAllDeletedOrder,
  rateOrder,
  editOrderByOrderId,
  assignTechnicianToOrder,
  scheduleVisit,
  generateArrivalOTP,
  verifyArrivalOTP,
  initialObservationReport,
  technicianReportReview,
  generateBOM
} = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");
const technicianAuthMiddleware = require("../middleware/technicianAuthMiddleware");

router.post(
  "/create-order",
  authMiddleware,
  upload.fields([
    { name: "pictureOfTheIssue", maxCount: 1 },
    { name: "voiceRecordOfTheIssue", maxCount: 1 },
  ]),
  createOrder
);
router.get("/orders", authMiddleware, getAllOrders);
router.get("/orders/customer/:id", authMiddleware, findOrdersByCustomer);
router.get("/find-order/:orderId", authMiddleware, findOrderByOrderId);
router.delete("/orders/:orderId", authMiddleware, deleteOrderByOrderId);
router.delete(
  "/find-order-deleted/:customerId",
  authMiddleware,
  getAllDeletedOrder
);
router.post("/order-rating", authMiddleware, rateOrder);
router.put("/orders/:orderId/updateProcess", editOrderByOrderId);
// Assign technician
router.put("/orders/:orderId/assign-technician", authMiddleware, assignTechnicianToOrder);
// Schedule technician site visit
router.post("/order/:orderId/schedule-visit", authMiddleware, scheduleVisit);
// Technician arrival confirmation
router.post("/order/:orderId/generate-otp", technicianAuthMiddleware, generateArrivalOTP);
router.post("/order/:orderId/verify-otp", technicianAuthMiddleware, verifyArrivalOTP);
// Technician Initial Observation
router.post("/order/:orderId/initial-observation", technicianAuthMiddleware, initialObservationReport);
// Admin Review
router.post("/order/:orderId/admin-review", authMiddleware, technicianReportReview);
// Generate BOM
router.post("/order/:orderId/generateBOM", authMiddleware, generateBOM);

module.exports = router;
