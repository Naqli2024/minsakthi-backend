const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
});

// Send verification email
const sendVerificationEmail = async (emailAddress, token) => {
  try {
    const verificationLink = `${
      process.env.FRONTEND_URL
    }/verify-otp?token=${token}&email=${encodeURIComponent(emailAddress)}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emailAddress,
      subject: "Verify Your Email",
      html: `
        <h2>Click below to verify your email:</h2>
        <a href="${verificationLink}" target="_blank">${verificationLink}</a>
        <p>This link will expire in 24 hours.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Verification email sent to", emailAddress);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Failed to send verification email");
  }
};

// Send password reset email
const sendPasswordResetEmail = async (emailAddress, token) => {
  try {
    const resetLink = `${
      process.env.FRONTEND_URL
    }/reset-password?token=${token}&emailAddress=${encodeURIComponent(
      emailAddress
    )}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emailAddress,
      subject: "Password Reset Request",
      html: `
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}" target="_blank">${resetLink}</a>
        <p>This link will expire in 15 minutes.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Password reset email sent to", emailAddress);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };