const express = require("express");
const router = express.Router();
const { register, verifyEmail, verifyOtp, forgotPassword, resetPassword, login, resendOtp } = require("../controller/authController");

router.post("/register", register);
router.get("/verify-email", verifyEmail);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;