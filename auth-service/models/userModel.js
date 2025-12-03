const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    emailAddress: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phoneNumber: { type: Number, required: true },
    alternateNumber: { type: Number, required: false },
    dob: { type: Date, required: true },
    address: { type: String, required: true },
    resetOtp: { type: String },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
    profile: {
      imageUrl: { type: String },
      fileName: { type: String },
      uploadedAt: { type: Date, default: Date.now },
    },
    isAdmin: { type: Boolean, default: false },
    notifications: [
      {
        title: String,
        message: String,
        createdAt: { type: Date, default: Date.now },
        isRead: { type: Boolean, default: false }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
