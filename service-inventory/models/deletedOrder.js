const mongoose = require("mongoose");

const deletedOrderSchema = new mongoose.Schema(
  {
    originalOrderId: { type: String, required: true }, // Ex: ORD-2025-02
    serviceId: { type: String },
    category: { type: String },
    serviceName: { type: String },

    orderType: { type: String, enum: ["Repair/Maintenance", "EB Complaints", "New Installation", "Contract"] },
    serviceType: { type: String, enum: ["general", "fixed", "custom", "others"] },
    serviceScope: { type: String, enum: ["Home", "Industry"] },
    
    // Common (Non-contract orders)
    serviceRequiredDate: {
      type: Date,
      required: function () {
        return this.orderType !== "Contract";
      },
    },
    // Contract-only fields
    fromDate: {
      type: Date,
      required: function () {
        return this.orderType === "Contract";
      },
    },
    toDate: {
      type: Date,
      required: function () {
        return this.orderType === "Contract";
      },
    },

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

    // For contract order
    projectType: {
      type: String,
      enum: ["newConstruction", "renovation", "expansion"],
    },
    contractLength: { type: String },

    deletedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("deletedOrder", deletedOrderSchema);