const mongoose = require("mongoose");

const deletedOrderSchema = new mongoose.Schema(
  {
    originalOrderId: { type: String, required: true }, // Ex: ORD-2025-02
    serviceId: { type: String },
    category: { type: String },
    serviceName: { type: String },

    orderType: { type: String, enum: ["Repair/Maintenance", "EB Complaints", "New Installation", "Contract"] },
    serviceType: { type: String, enum: ["general", "fixed", "custom"] },
    serviceScope: { type: String, enum: ["Home", "Industry"] },
    serviceRequiredDate: { type: Date },

    issueLocation: { type: String },
    servicePrice: { type: Number },
    discount: { type: Number },
    tax: { type: Number },

    issueDescription: { type: String },
    pictureOfTheIssue: { type: String },
    voiceRecordOfTheIssue: { type: String },
    materialRequired: {type: Boolean, default: false},

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    deletedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("deletedOrder", deletedOrderSchema);