const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/mailer");
const { generateOtp } = require("../utils/generateOtp");

// Register new admin
exports.register = async (req, res) => {
  const {
    fullName,
    emailAddress,
    password,
    confirmPassword,
    phoneNumber,
    dob,
    address,
  } = req.body;
  try {
    let existingUser = await User.findOne({ emailAddress });
    if (existingUser)
      return res
        .status(400)
        .json({ message: `Email ${emailAddress} already exists` });

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      emailAddress,
      password: hashedPassword,
      phoneNumber,
      dob,
      address,
    });

    await newUser.save();

    // ADD NOTIFICATION AFTER USER CREATED
    await User.findByIdAndUpdate(newUser._id, {
      $push: {
        notifications: {
          title: "Account Created",
          message: `Welcome ${fullName}! Your account has been registered successfully.`,
          createdAt: new Date(),
          isRead: false,
        },
      },
    });

    // Create verification token
    const token = jwt.sign(
      { userId: newUser._id, emailAddress: newUser.emailAddress },
      process.env.JSON_WEB_TOKEN,
      {
        expiresIn: "24h",
      }
    );

    // Send email
    await sendVerificationEmail(newUser.emailAddress, token);

    res.status(201).json({
      message: `Account created. Please verify your email ${newUser.emailAddress}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Verify registered email
exports.verifyEmail = async (req, res) => {
  try {
    const { token, emailAddress } = req.query;

    if (!token || !emailAddress) {
      return res.status(400).json({
        success: false,
        message: "Verification token or email is missing.",
      });
    }

    // Decode and validate token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JSON_WEB_TOKEN);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired verification link.",
      });
    }

    // Ensure the token payload matches the email
    if (decoded.emailAddress !== emailAddress) {
      return res.status(400).json({
        success: false,
        message: "Token does not match the email.",
      });
    }

    // Find the admin by email
    const user = await User.findOne({ emailAddress });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        message: "Email is already verified.",
      });
    }

    // Generate OTP
    const { otp, expiry } = generateOtp();
    user.resetOtp = otp;
    user.otpExpiry = expiry;

    // Don't mark verified yet
    await user.save();

    res.status(200).json({
      success: true,
      message:
        "Email verified. Please enter the OTP sent to your registered number.",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during email verification.",
      error: error.message,
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { emailAddress, otp } = req.body;
    const user = await User.findOne({ emailAddress });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (!user.resetOtp || !user.otpExpiry) {
      return res
        .status(400)
        .json({ success: false, message: "No OTP generated." });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ success: false, message: "OTP expired." });
    }

    if (user.resetOtp !== otp) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect OTP." });
    }

    // Mark as verified
    user.isVerified = true;
    user.resetOtp = null;
    user.otpExpiry = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "OTP verified successfully. Account activated.",
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Resend OTP when expired or on user request
exports.resendOtp = async (req, res) => {
  try {
    const { emailAddress } = req.body;

    if (!emailAddress) {
      return res.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    const user = await User.findOne({ emailAddress });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account is already verified.",
      });
    }

    // Generate new OTP (valid for 30 seconds)
    const { otp, expiry } = generateOtp();

    user.resetOtp = otp;
    user.otpExpiry = expiry;
    await user.save();

    res.status(200).json({
      success: true,
      message: "New OTP has been sent successfully.",
      data: {
        emailAddress: user.emailAddress,
        otpExpiry: user.otpExpiry,
      },
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resending OTP.",
      error: error.message,
    });
  }
};

// user login
exports.login = async (req, res) => {
  try {
    const { emailAddress, password } = req.body;

    if (!emailAddress || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password required." });
    }

    const normalizedEmail = emailAddress.trim().toLowerCase();

    const user = await User.findOne({ emailAddress: normalizedEmail });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email not found." });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ success: false, message: "Email not verified yet." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect password." });
    }

    const token = jwt.sign(
      { userId: user._id, emailAddress: user.emailAddress },
      process.env.JSON_WEB_TOKEN,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { emailAddress } = req.body;
    if (!emailAddress) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ emailAddress });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "No user found with this email" });
    }

    // Generate short-lived token (15 min)
    const token = jwt.sign(
      { userId: user._id, emailAddress },
      process.env.JSON_WEB_TOKEN,
      { expiresIn: "15m" }
    );

    await sendPasswordResetEmail(emailAddress, token);

    res.status(200).json({
      success: true,
      message: `Password reset link sent to ${emailAddress}`,
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token, emailAddress, newPassword, confirmNewPassword } = req.body;

    if (!token || !emailAddress || !newPassword || !confirmNewPassword) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    if (newPassword !== confirmNewPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JSON_WEB_TOKEN);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
    }

    // Ensure the token email matches the provided one
    if (decoded.emailAddress !== emailAddress) {
      return res
        .status(400)
        .json({ success: false, message: "Token does not match email" });
    }

    // Find user
    const user = await User.findOne({ emailAddress });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // ADD NOTIFICATION
    await User.findByIdAndUpdate(user._id, {
      $push: {
        notifications: {
          title: "Password Reset Successful",
          message: "Your account password has been changed successfully.",
          createdAt: new Date(),
          isRead: false
        }
      }
    });

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
