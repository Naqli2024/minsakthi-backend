const mongoose = require("mongoose");

const SubProcessSchema = new mongoose.Schema({
  name: {
    en: { type: String, required: true },
    ta: { type: String },
  },
  description: {
    en: { type: String },
    ta: { type: String },
  },
});

const ProcessTemplateSchema = new mongoose.Schema({
  order: Number,
  processName: {
    en: { type: String, required: true },
    ta: { type: String },
  },
  description: {
    en: { type: String },
    ta: { type: String },
  },
  defaultSubProcesses: [SubProcessSchema],
});

module.exports = mongoose.model("ProcessTemplate", ProcessTemplateSchema);
