const Technician = require("../models/technician");
const { uploadFileToGCS } = require("../middleware/uploadToGCS.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Email regex for validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Generate random 4-digit OTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

// add notification helper function
const addNotification = async (technicianId, title, message) => {
  await Technician.findByIdAndUpdate(
    technicianId,
    {
      $push: {
        notifications: {
          title,
          message,
          createdAt: new Date(),
          isRead: false,
        },
      },
    },
    { new: true }
  );
};

// Step 1 - Register Technician (Individual or Organization)

exports.registerTechnician = async (req, res) => {
  try {
    const data = req.body;
    const { technicianType } = data;

    if (!technicianType) {
      return res.status(400).json({
        message: "technicianType is required (Individual or Organization)",
      });
    }

    const otpCode = generateOTP();

    // ============= INDIVIDUAL TECHNICIAN FLOW =============
    if (technicianType === "Individual") {
      const { firstName, mobileNumber, email } = data;

      if (!firstName || !mobileNumber || !email)
        return res.status(400).json({ message: "Missing mandatory fields" });

      if (!emailRegex.test(email))
        return res.status(400).json({ message: "Invalid email format" });

      const existing = await Technician.findOne({
        $or: [{ email }, { mobileNumber }],
      });
      if (existing)
        return res.status(400).json({
          message: "Technician already exists with same email or mobile",
        });

      // ===== File uploads =====
      const profilePhoto = await uploadFileToGCS(req.files?.profilePhoto?.[0]);
      const idProofDocument = await uploadFileToGCS(
        req.files?.idProofDocument?.[0]
      );
      const licenseFile = await uploadFileToGCS(req.files?.licenseFile?.[0]);

      // ===== Safely parse nested JSON fields =====
      const address =
        typeof data.address === "string"
          ? JSON.parse(data.address)
          : data.address || {};
      const licenseDetails =
        typeof data.licenseDetails === "string"
          ? JSON.parse(data.licenseDetails)
          : data.licenseDetails || {};
      const certificationDetails =
        typeof data.certificationDetails === "string"
          ? JSON.parse(data.certificationDetails)
          : data.certificationDetails || [];
      const bankDetails =
        typeof data.bankDetails === "string"
          ? JSON.parse(data.bankDetails)
          : data.bankDetails || {};

      // ===== Improved Certification Handling (matches file + metadata) =====
      const certifications = [];
      if (req.files?.certifications?.length) {
        for (let i = 0; i < req.files.certifications.length; i++) {
          const file = req.files.certifications[i];
          const url = await uploadFileToGCS(file);

          const detail = certificationDetails[i] || {}; // match index
          certifications.push({
            certificationName: detail.certificationName || "N/A",
            issuedBy: detail.issuedBy || "N/A",
            issueDate: detail.issueDate || null,
            certificateFile: url,
          });
        }
      }

      // ===== Create new Technician document =====
      const newTech = new Technician({
        ...data,
        profilePhoto,
        idProofDocument,
        address,
        licenseDetails: { ...licenseDetails, documentFile: licenseFile },
        certifications,
        bankDetails,
        isVerified: false,
        isAdminApproved: false,
        otpCode,
      });

      await newTech.save();

      // ADD NOTIFICATION
      await addNotification(
        newTech._id,
        "Registration Successful",
        "Your technician account has been created successfully and OTP has been sent."
      );

      return res.status(201).json({
        message: "Technician registered successfully. OTP sent to mobile.",
      });
    }

    // ============= ORGANIZATION FLOW =============
    else if (technicianType === "Organization") {
      const org =
        typeof data.organizationDetails === "string"
          ? JSON.parse(data.organizationDetails)
          : data.organizationDetails;

      if (!org)
        return res
          .status(400)
          .json({ message: "organizationDetails required" });

      const { organizationName, ownerName, email, mobileNumber } = org;
      if (!organizationName || !ownerName || !email || !mobileNumber)
        return res.status(400).json({ message: "Missing organization fields" });

      if (!emailRegex.test(email))
        return res.status(400).json({ message: "Invalid organization email" });

      const existingOrg = await Technician.findOne({
        $or: [
          { "organizationDetails.email": email },
          { "organizationDetails.mobileNumber": mobileNumber },
        ],
      });

      if (existingOrg)
        return res.status(400).json({
          message: "Organization already exists with this email or number",
        });

      // ===================== Upload Organization-Level Files =====================

      // Organization Logo
      const organizationLogo = await uploadFileToGCS(
        req.files?.organizationLogo?.[0]
      );

      // Upload Organisation Documents
      const orgDocs = [];
      if (req.files?.organisationDocuments?.length) {
        for (let file of req.files.organisationDocuments) {
          const url = await uploadFileToGCS(file);
          orgDocs.push({ docType: "General", docFile: url });
        }
      }

      // Commercial License Document
      const licenseDoc = await uploadFileToGCS(
        req.files?.commercialLicenseFile?.[0]
      );

      // ===================== Upload Sub-Technician Profile Photos =====================
      const technicianPhotos = [];

      if (req.files?.technicianProfilePhotos?.length) {
        for (let file of req.files.technicianProfilePhotos) {
          const url = await uploadFileToGCS(file);
          technicianPhotos.push(url);
        }
      }

      // Attach photos to technicians by index order
      if (Array.isArray(org.technicians)) {
        org.technicians = org.technicians.map((tech, idx) => ({
          ...tech,
          technicianProfilePhotos: technicianPhotos[idx] || null, // <— technician profile photo
        }));
      }

      // ===================== Final Organization Object =====================
      org.organisationDocuments = orgDocs;
      org.organizationLogo = organizationLogo || null;
      org.commercialLicense = {
        ...org.commercialLicense,
        documentFile: licenseDoc,
      };

      const newOrg = new Technician({
        technicianType: "Organization",
        organizationDetails: org,
        isVerified: false,
        isAdminApproved: false,
        otpCode,
      });

      await newOrg.save();

      // ADD NOTIFICATION
      await addNotification(
        newOrg._id,
        "Organization Registration Successful",
        "Your organization technician account has been created successfully and OTP has been sent."
      );

      return res.status(201).json({
        message: "Organization registered successfully. OTP sent to mobile.",
      });
    }

    return res.status(400).json({ message: "Invalid technicianType" });
  } catch (error) {
    console.error("Register Technician Error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Verify OTP
exports.verifyTechnicianOTP = async (req, res) => {
  try {
    const { email, mobileNumber, otpCode } = req.body;

    if (!otpCode || (!email && !mobileNumber)) {
      return res.status(400).json({
        message: "Please provide otpCode and either email or mobileNumber.",
      });
    }

    // Build search conditions dynamically (avoid empty values)
    const conditions = [];
    if (email) {
      conditions.push({ email });
      conditions.push({ "organizationDetails.email": email });
    }
    if (mobileNumber) {
      conditions.push({ mobileNumber });
      conditions.push({ "organizationDetails.mobileNumber": mobileNumber });
    }

    // Find technician safely
    const technician = await Technician.findOne({ $or: conditions });
    if (!technician) {
      return res.status(404).json({
        message: "Technician not found with provided email or mobile number.",
      });
    }

    // Compare OTP
    if (String(technician.otpCode).trim() !== String(otpCode).trim()) {
      return res
        .status(400)
        .json({ message: "Invalid OTP. Please try again." });
    }

    // OTP matched
    technician.isVerified = true;
    technician.otpCode = null;
    await technician.save();

    // send notification
    await addNotification(
      technician._id,
      "OTP Verified",
      "Your OTP has been verified successfully. Please wait for admin approval."
    );

    return res.status(200).json({
      message:
        "OTP verified successfully. Please wait until admin verification.",
      technicianId: technician._id,
      technicianType: technician.technicianType,
      email: technician.email || technician.organizationDetails?.email,
      mobileNumber:
        technician.mobileNumber || technician.organizationDetails?.mobileNumber,
      isVerified: technician.isVerified,
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Approve or Reject Technician by Admin
exports.approveTechnicianByAdmin = async (req, res) => {
  try {
    const { technicianId, action } = req.body; // action: "approve" or "reject"

    // Validate inputs
    if (!technicianId || !action) {
      return res.status(400).json({
        message: "technicianId and action are required.",
      });
    }

    // Check if user is admin
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        message: "Access denied. Only admins can perform this action.",
      });
    }

    // Fetch technician
    const technician = await Technician.findById(technicianId);
    if (!technician) {
      return res.status(404).json({
        message: "Technician not found.",
      });
    }

    // Ensure technician completed OTP verification
    if (!technician.isVerified) {
      return res.status(400).json({
        message: "Technician has not completed OTP verification yet.",
      });
    }

    // Perform action: Approve or Reject
    if (action === "approve") {
      technician.verifiedByAdmin = true;
      technician.status = "Active";
    } else if (action === "reject") {
      technician.verifiedByAdmin = false;
      technician.status = "Rejected";
    } else {
      return res.status(400).json({
        message: "Invalid action. Use 'approve' or 'reject'.",
      });
    }

    await technician.save();

    // Add Notification
    await addNotification(
      technicianId,
      "Account Approved",
      "Your technician account has been approved by admin. You can now access all services."
    );

    // Success Response
    return res.status(200).json({
      message:
        action === "approve"
          ? "Technician approved successfully."
          : "Technician rejected successfully.",
      technicianId: technician._id,
      technicianType: technician.technicianType,
      email: technician.email || technician.organizationDetails?.email || null,
      mobileNumber:
        technician.mobileNumber ||
        technician.organizationDetails?.mobileNumber ||
        null,
    });
  } catch (error) {
    console.error("Admin Approval Error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// set technician password
exports.setTechnicianPassword = async (req, res) => {
  try {
    const { emailOrMobile, createPassword, confirmPassword } = req.body;

    // Validate input
    if (!emailOrMobile || !createPassword || !confirmPassword) {
      return res.status(400).json({
        message:
          "emailOrMobile, createPassword, and confirmPassword are required.",
      });
    }

    if (createPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match.",
      });
    }

    // Find technician (check for both Individual and Organization)
    const technician = await Technician.findOne({
      $or: [
        { email: emailOrMobile },
        { mobileNumber: emailOrMobile },
        { "organizationDetails.email": emailOrMobile },
        { "organizationDetails.mobileNumber": emailOrMobile },
      ],
    });

    if (!technician) {
      return res.status(404).json({
        message:
          "No technician found with the provided email or mobile number.",
      });
    }

    // If password already exists, block recreation
    if (technician.password) {
      return res.status(400).json({
        message: "Password already created. Please log in instead.",
      });
    }

    // Ensure OTP verified and admin approved
    if (!technician.isVerified) {
      return res.status(400).json({
        message: "Technician has not completed OTP verification yet.",
      });
    }

    if (!technician.verifiedByAdmin) {
      return res.status(400).json({
        message: "Technician has not been approved by admin yet.",
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(createPassword, salt);

    // Save the password (store in `password` field)
    technician.password = hashedPassword;
    await technician.save();

    // add notifications
    await addNotification(
      technician._id,
      "Password Created",
      "Your technician account password has been successfully created. You can now log in."
    );

    // Respond success
    return res.status(200).json({
      message: "Password created successfully. You can now log in.",
      technicianId: technician._id,
      technicianType: technician.technicianType,
      email: technician.email || technician.organizationDetails?.email,
      mobileNumber:
        technician.mobileNumber || technician.organizationDetails?.mobileNumber,
    });
  } catch (error) {
    console.error("Set Technician Password Error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// technician login
exports.loginTechnician = async (req, res) => {
  try {
    const { emailOrMobile, password } = req.body;

    if (!emailOrMobile) {
      return res.status(400).json({
        message: "email or Mobile number and password are required.",
      });
    }

    // Find technician by any possible field
    const technician = await Technician.findOne({
      $or: [
        { email: emailOrMobile },
        { mobileNumber: emailOrMobile },
        { "organizationDetails.email": emailOrMobile },
        { "organizationDetails.mobileNumber": emailOrMobile },
      ],
    });

    if (!technician) {
      return res.status(404).json({
        message: "No technician found with given email or mobile number.",
      });
    }

    // Check OTP verified
    if (!technician.isVerified) {
      return res.status(400).json({
        message: "OTP verification not completed.",
      });
    }

    // Check Admin approval
    if (!technician.verifiedByAdmin) {
      return res.status(400).json({
        message: "Technician not yet approved by admin.",
      });
    }

    // Check password exists
    if (!technician.password) {
      return res.status(400).json({
        message:
          "You haven't created a password yet. Please create one to log in.",
      });
    }

    // Compare password
    const validPassword = await bcrypt.compare(password, technician.password);
    if (!validPassword) {
      return res.status(400).json({
        message: "Invalid password.",
      });
    }

    // Prepare login email for token
    const loginEmail =
      technician.email || technician.organizationDetails?.email;

    // Generate JWT Token
    const token = jwt.sign(
      {
        technicianId: technician._id,
        email: loginEmail,
      },
      process.env.JSON_WEB_TOKEN,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    // Convert Mongoose document to plain object
    const technicianData = technician.toObject();

    // Remove password before sending response
    delete technicianData.password;

    // Success Response
    return res.status(200).json({
      message: "Login successful.",
      token,
      technician: technicianData,
    });
  } catch (error) {
    console.error("Login Technician Error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Request OTP for Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;

    if (!emailOrMobile) {
      return res
        .status(400)
        .json({ message: "Email or mobile number is required." });
    }

    // Find technician (Individual or Organization)
    const technician = await Technician.findOne({
      $or: [
        { email: emailOrMobile },
        { mobileNumber: emailOrMobile },
        { "organizationDetails.email": emailOrMobile },
        { "organizationDetails.mobileNumber": emailOrMobile },
      ],
    });

    if (!technician) {
      return res.status(404).json({
        message: "Technician not found with provided email or mobile number.",
      });
    }

    // Generate OTP
    const otpCode = generateOTP();
    technician.otpCode = otpCode;
    technician.isVerified = false;
    await technician.save();

    return res.status(200).json({
      message: "OTP has been sent successfully to your registered contact.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// Verify OTP and Reset Password
exports.verifyOTPAndResetPassword = async (req, res) => {
  try {
    const { emailOrMobile, otpCode, newPassword, confirmPassword } = req.body;

    if (!emailOrMobile || !otpCode || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Find technician
    const technician = await Technician.findOne({
      $or: [
        { email: emailOrMobile },
        { mobileNumber: emailOrMobile },
        { "organizationDetails.email": emailOrMobile },
        { "organizationDetails.mobileNumber": emailOrMobile },
      ],
    });

    if (!technician) {
      return res.status(404).json({ message: "Technician not found." });
    }

    // Check OTP
    if (technician.otpCode !== otpCode) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    // Validate passwords
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    technician.password = hashedPassword;
    technician.otpCode = null;
    technician.isVerified = true;
    await technician.save();

    // Add Notification
    await addNotification(
      technician._id,
      "Password Reset Successful",
      "Your password has been reset successfully. You can now login with your new password."
    );

    return res.status(200).json({
      message:
        "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;

    if (!emailOrMobile) {
      return res.status(400).json({
        message: "Please provide email or mobile number.",
      });
    }

    // Find technician (Individual + Organization)
    const technician = await Technician.findOne({
      $or: [
        { email: emailOrMobile },
        { mobileNumber: emailOrMobile },
        { "organizationDetails.email": emailOrMobile },
        { "organizationDetails.mobileNumber": emailOrMobile },
      ],
    });

    if (!technician) {
      return res.status(404).json({
        message: "Technician not found with provided email or mobile number.",
      });
    }

    // Generate new OTP
    const newOTP = generateOTP();
    technician.otpCode = newOTP;
    technician.isVerified = false;
    await technician.save();

    return res.status(200).json({
      message: "New OTP has been sent successfully.",
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get All Technicians
exports.getAllTechnicians = async (req, res) => {
  try {
    // Fetch all technicians excluding password & otpCode
    const technicians = await Technician.find(
      {},
      { password: 0, otpCode: 0 }
    ).sort({ createdAt: -1 });

    if (!technicians || technicians.length === 0) {
      return res.status(404).json({
        message: "No technicians found.",
        data: [],
      });
    }

    return res.status(200).json({
      message: "Technicians fetched successfully.",
      total: technicians.length,
      data: technicians,
    });
  } catch (error) {
    console.error("Get All Technicians Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get Technician by ID
exports.getTechnicianById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id) {
      return res.status(400).json({
        message: "Technician ID is required.",
      });
    }

    // Find technician by ID
    const technician = await Technician.findById(id, {
      password: 0,
      otpCode: 0,
    });

    if (!technician) {
      return res.status(404).json({
        message: "Technician not found.",
      });
    }

    return res.status(200).json({
      message: "Technician fetched successfully.",
      data: technician,
    });
  } catch (error) {
    console.error("Get Technician by ID Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// updateTechnician
exports.updateTechnician = async (req, res) => {
  try {
    const { technicianId } = req.params;
    const { orderId, ...updateFields } = req.body;

    // Find technician
    const technician = await Technician.findById(technicianId);

    if (!technician) {
      return res.status(404).json({
        success: false,
        message: "Technician not found",
      });
    }

    // Apply all update fields (deep merge)
    Object.keys(updateFields).forEach((key) => {
      if (
        typeof updateFields[key] === "object" &&
        !Array.isArray(updateFields[key])
      ) {
        // Deep merge nested objects (address, bankDetails, etc.)
        technician[key] = {
          ...technician[key],
          ...updateFields[key],
        };
      } else {
        // Simple update
        technician[key] = updateFields[key];
      }
    });

    // Add orderId if provided
    if (orderId) {
      const alreadyExists = technician.orders.some(
        (o) => o.orderId === orderId
      );

      if (!alreadyExists) {
        technician.orders.push({ orderId });
      }
    }

    await technician.save();

    // Add Notification
    await addNotification(
      technician._id,
      "Profile Updated",
      "Your technician profile was updated successfully."
    );

    return res.status(200).json({
      success: true,
      message: "Technician updated successfully",
      data: technician,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating technician",
      error: error.message,
    });
  }
};

exports.addNotification = async (req, res) => {
  try {
    const { technicianId, title, message } = req.body;

    if (!technicianId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "technicianId, title, and message are required",
      });
    }

    const updatedTech = await Technician.findByIdAndUpdate(
      technicianId,
      {
        $push: {
          notifications: {
            title,
            message,
            createdAt: new Date(),
            isRead: false,
          },
        },
      },
      { new: true }
    );

    if (!updatedTech) {
      return res.status(404).json({
        success: false,
        message: "Technician not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification added successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding notification",
      error: error.message,
    });
  }
};


exports.updateTechnicianNotificationStatus = async (req, res) => {
  try {
    const { technicianId, notificationId } = req.params;
    const { isRead } = req.body;

    if (!technicianId || !notificationId) {
      return res.status(400).json({
        success: false,
        message: "technicianId and notificationId are required",
      });
    }

    if (isRead === undefined) {
      return res.status(400).json({
        success: false,
        message: "isRead value is required",
      });
    }

    const readStatus = isRead === true || isRead === "true";

    const result = await Technician.updateOne(
      {
        _id: technicianId,
        "notifications._id": notificationId,
      },
      {
        $set: {
          "notifications.$.isRead": readStatus,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Technician or notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification status updated successfully",
    });
  } catch (error) {
    console.error("Update Technician Notification Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};