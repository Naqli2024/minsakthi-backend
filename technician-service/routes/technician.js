const express = require("express");
const { upload } = require("../middleware/uploadToGCS");
const router = express.Router();
const {
  registerTechnician,
  verifyTechnicianOTP,
  approveTechnicianByAdmin,
  setTechnicianPassword,
  loginTechnician,
  forgotPassword,
  verifyOTPAndResetPassword,
  resendOTP,
  getAllTechnicians,
  getTechnicianById,
  updateTechnician,
  addNotification
} = require("../controllers/technician");
const authMiddleware = require("../middleware/authMiddleware");
const technicianAuthMiddleware = require("../middleware/technicianAuthMiddleware");

router.post(
  "/create-account",
  upload.fields([
    // ===== Common Fields =====
    { name: "profilePhoto", maxCount: 1 },
    { name: "idProofDocument", maxCount: 1 },
    { name: "licenseFile", maxCount: 1 },
    { name: "certifications", maxCount: 10 },

    // ===== Organization Fields =====
    { name: "organizationProfilePhoto", maxCount: 1 },
    { name: "organisationDocuments", maxCount: 10 },
    { name: "commercialLicenseFile", maxCount: 1 },
    { name: "technicianProfilePhotos", maxCount: 10 },
  ]),
  registerTechnician
);
router.post("/verify-otp", verifyTechnicianOTP);
router.post("/approve-technician", authMiddleware, approveTechnicianByAdmin);
router.post("/set-password", setTechnicianPassword);
router.post("/login", loginTechnician);
router.post("/forget-password", forgotPassword);
router.post("/reset-password", verifyOTPAndResetPassword);
router.post("/resend-otp", resendOTP);
router.get("/all-technicians", getAllTechnicians);
router.get("/technician/:id", getTechnicianById);
router.put("/technician/:technicianId/update", updateTechnician);
router.post("/add-technician-notification", addNotification);

module.exports = router;
