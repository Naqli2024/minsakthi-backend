const mongoose = require("mongoose");
const { Schema } = mongoose;

// Bank Details Schema (Shared)
const bankDetailsSchema = new Schema({
  accountHolderName: { type: String, required: true },
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifscOrSwiftCode: { type: String },
});

// Certification Schema (for individuals or sub-technicians)
const certificationSchema = new Schema({
  name: String,
  issuedBy: String,
  issueDate: Date,
  certificateFile: String,
});

// License Schema
const licenseSchema = new Schema({
  licenseNo: String,
  expiryDate: Date,
  documentFile: String,
});

// Sub-Technician Schema (for Organization’s internal technicians)
const subTechnicianSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String },
  mobileNumber: { type: String, required: true },
  email: { type: String },
  specialization: [String],
  skills: [String],
  experienceYears: Number,
  licenseDetails: licenseSchema,
  availabilityStatus: {
    type: String,
    enum: ["Available", "Busy", "Offline"],
    default: "Available",
  },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
});

// Organization Details Schema
const organizationDetailsSchema = new Schema({
  organizationName: { type: String, required: true },
  ownerName: { type: String, required: true },
  email: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  officeAddress: {
    street: String,
    city: String,
    region: String,
    country: String,
    pincode: String,
  },
  commercialLicense: {
    licenseNo: String,
    expiryDate: Date,
    documentFile: String,
  },
  taxNumber: String,
  organisationDocuments: [
    {
      docType: String,
      docFile: String,
    },
  ],
  bankDetails: bankDetailsSchema,
  technicians: [subTechnicianSchema], // embedded sub-technicians
});

// Technician (Main Schema)
const technicianSchema = new Schema(
  {
    technicianType: {
      type: String,
      enum: ["Individual", "Organization"],
      required: true,
    },

    // Common
    profilePhoto: { type: String },
    walletBalance: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    password: { type: String },

    // Individual Technician Fields
    firstName: String,
    lastName: String,
    mobileNumber: String,
    email: String,
    gender: String,
    dateOfBirth: Date,
    address: {
      street: String,
      city: String,
      region: String,
      country: String,
      pincode: String,
    },
    idProofType: String,
    idProofNumber: String,
    idProofDocument: String,
    specialization: [String],
    skills: [String],
    experienceYears: Number,
    certifications: [certificationSchema],
    licenseDetails: licenseSchema,
    availabilityStatus: {
      type: String,
      enum: ["Available", "Busy", "Offline"],
      default: "Available",
    },
    bankDetails: bankDetailsSchema,

    // Organization Details (Only if technicianType = "Organization")
    organizationDetails: organizationDetailsSchema,
    verifiedByAdmin: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String },
    orders: [{ orderId: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Technician", technicianSchema);
