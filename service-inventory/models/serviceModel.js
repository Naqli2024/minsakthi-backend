const mongoose = require("mongoose");

const stepSchema = new mongoose.Schema({
  title: { type: String, required: true },
  details: { type: String, required: true },
});

const serviceSchema = new mongoose.Schema(
  {
    serviceId: { type: String, required: true, unique: true },
    serviceType: { type: String, enum: ["general", "fixed", "custom"], required: true },

    // Common fields
    orderType: {
      type: String,
      enum: ["Repair/Maintenance", "EB Complaints", "New Installation", "Contract"],
      required: function () {
        return this.serviceType !== "custom"; // required for general & fixed
      },
    },
    serviceScope: { type: String, enum: ["Home", "Industry"], required: true },
    category: { type: String, required: true },
    serviceName: { type: String, required: true },
    imageUrl: { type: String },

    // General service only
    steps: { type: [stepSchema], default: [] },
    servicePrice: { type: Number },

    // Fixed service only
    process: { type: [String], default: [] },
    sellingPrice: { type: Number },
    priceType: {
      type: String,
      enum: ["Fixed", "Variable", "BOM Based"],
      default: "Fixed",
    },
    companyRevenuePercent: { type: Number },
    costToCompany: { type: Number },
    providerType: { type: String, enum: ["Internal", "External"] },
    workingTime: { type: String },

    status: {
      type: String,
      enum: ["Available", "Inactive"],
      default: "Available",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Service", serviceSchema);
