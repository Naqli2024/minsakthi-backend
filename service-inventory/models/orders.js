const mongoose = require("mongoose");

// BOM Schema
const bomSchema = new mongoose.Schema(
  {
    serviceType: {
      type: String,
      enum: ["general", "custom"],
      required: true,
    },
    materialItems: [
      {
        itemName: { type: String },
        qty: { type: Number, default: 0 },
        unitPrice: { type: Number, default: 0 },
      },
    ],
    materialCost: { type: Number, default: 0 },
    serviceCharge: { type: Number, default: 0 },
    additionalCharges: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    taxPercentage: { type: Number, default: 18 },
    taxAmount: { type: Number, default: 0 },
    totalPayable: { type: Number, default: 0 },
    generatedAt: { type: Date, default: null },
  },
  { _id: false } 
);


const subProcessSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subProcessDescription: { type: String },
  scheduledDate: { type: String },
  scheduledTime: { type: String },
  otp: { type: String },
  isVerified: { type: Boolean },
  photoOfTheIssue: { type: String },
  technicianReport: { type: String },
  materialEstimation: { type: Number },
  billOfTheSummary: { type: Number },
  quotation: { type: String },
  quotationConfirmation: { type: Boolean },
  assignedTechnicians: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Technician",
  }],
  materialProcurement: { type: String, enum: ["not yet", "completed"] },
  jobExecution: {
    type: String,
    enum: ["not yet started", "processing", "completed"],
  },
  workVerified: { type: Boolean },
  isCompleted: { type: Boolean },
  clientFeedback: { type: String },
  orderCompleted: { type: Boolean },
  completedAt: { type: Date },
});

const processSchema = new mongoose.Schema({
  order: { type: Number },
  processName: { type: String, required: true },
  processDescription: { type: String },
  timeLine: { type: String },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Completed", "Arrived"],
    default: "Pending",
  },
  // assignedPerson: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  subProcesses: [subProcessSchema],
  startedAt: { type: Date },
  completedAt: { type: Date },
});

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    serviceId: { type: String }, // only for general/fixed services
    serviceType: {
      type: String,
      enum: ["general", "fixed", "custom"],
      required: true,
    },
    orderType: {
      type: String,
      enum: [
        "Repair/Maintenance",
        "EB Complaints",
        "New Installation",
        "Contract",
      ],
    },
    serviceScope: { type: String, enum: ["Home", "Industry"], required: true },
    category: { type: String, required: true },
    serviceName: { type: String, required: true },

    // Common fields
    serviceRequiredDate: { type: Date, required: true },
    issueDescription: { type: String },
    pictureOfTheIssue: { type: String },
    voiceRecordOfTheIssue: { type: String },

    // Price / billing
    servicePrice: { type: Number },
    discount: { type: Number },
    tax: { type: Number },

    // Custom order fields
    expectedBudget: { type: Number },
    issueLocation: { type: String, required: true },
    materialRequired: { type: Boolean, default: false },

    orderStatus: {
      type: String,
      enum: ["Confirmed", "Completed", "Cancelled"],
      default: "Confirmed",
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    review: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    // SOP flow
    processes: [processSchema],
    billOfMaterial: bomSchema
  },
  { timestamps: true }
);

module.exports = mongoose.model("orders", orderSchema);
