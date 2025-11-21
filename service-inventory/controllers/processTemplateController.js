const ProcessTemplate = require("../models/processTemplateSchema");

// Get all process templates
exports.getAllProcessTemplates = async (req, res) => {
  try {
    const lang = req.query.lang || "en"; // default: En
    const templates = await ProcessTemplate.find();

    // If user requested Tamil, transform the response
    const formattedTemplates = templates.map((tpl) => ({
      _id: tpl._id,
      processName: tpl.processName[lang] || tpl.processName.en,
      description: tpl.description[lang] || tpl.description.en,
      defaultSubProcesses: tpl.defaultSubProcesses.map((sp) => ({
        name: sp.name[lang] || sp.name.en,
        description: sp.description[lang] || sp.description.en,
      })),
    }));

    res.status(200).json({ success: true, language: lang, data: formattedTemplates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single process template by ID
exports.getProcessTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await ProcessTemplate.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Process template not found",
      });
    }

    res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Get Template By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch process template",
      error: error.message,
    });
  }
};

// Add new process template (with sub-processes)
exports.createProcessTemplate = async (req, res) => {
  try {
    const { processName, processDescription, defaultSubProcesses } = req.body;

    if (!processName) {
      return res.status(400).json({
        success: false,
        message: "processName is required",
      });
    }

    const newTemplate = new ProcessTemplate({
      processName,
      processDescription,
      defaultSubProcesses,
    });

    await newTemplate.save();

    res.status(201).json({
      success: true,
      message: "Process template created successfully",
      data: newTemplate,
    });
  } catch (error) {
    console.error("Create Process Template Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create process template",
      error: error.message,
    });
  }
};

// Update process template (add/edit sub-processes)
exports.updateProcessTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedTemplate = await ProcessTemplate.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedTemplate) {
      return res.status(404).json({
        success: false,
        message: "Process template not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Process template updated successfully",
      data: updatedTemplate,
    });
  } catch (error) {
    console.error("Update Process Template Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update process template",
      error: error.message,
    });
  }
};

// Delete process template
exports.deleteProcessTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ProcessTemplate.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Process template not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Process template deleted successfully",
    });
  } catch (error) {
    console.error("Delete Process Template Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete process template",
      error: error.message,
    });
  }
};