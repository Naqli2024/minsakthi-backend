const Service = require("../models/serviceModel");
const axios = require("axios");
const XLSX = require("xlsx");
const fs = require("fs");

const generateServiceId = async () => {
  let uniqueId;
  let isUnique = false;

  while (!isUnique) {
    uniqueId = `S-${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await Service.findOne({ serviceId: uniqueId });
    if (!existing) {
      isUnique = true;
    }
  }

  return uniqueId;
};

exports.createService = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Unauthorized: user not attached" });
    }

    const userId = req.user._id || req.user.userId;
    if (!userId) return res.status(400).json({ message: "Invalid user ID" });

    const userServiceURL = process.env.USER_SERVICE_URL;
    const userResponse = await axios.get(
      `${userServiceURL}/api/getUserById/${userId}`
    );
    const user = userResponse.data.data || userResponse.data;

    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Only admins can add services" });
    }

    const {
      orderType, // <-- common for general + fixed
      serviceType,
      serviceScope,
      category,
      serviceName,
      servicePrice, // general
      steps, // general
      process: serviceProcess, // fixed
      imageUrl,
      sellingPrice, // fixed
      priceType,
      companyRevenuePercent,
      costToCompany,
      providerType,
      workingTime,
      status,
    } = req.body;

    if (!orderType && serviceType !== "custom") {
      return res.status(400).json({
        message: "orderType is required for general and fixed services",
      });
    }

    // Case-insensitive duplicate check
    const existingService = await Service.findOne({
      serviceName: { $regex: new RegExp(`^${serviceName}$`, "i") },
      serviceType,
    });
    if (existingService) {
      return res.status(400).json({
        message: `Service '${serviceName}' already exists for type '${serviceType}'`,
      });
    }

    const serviceData = {
      serviceId: await generateServiceId(),
      orderType,
      serviceType,
      serviceScope,
      category,
      serviceName,
      imageUrl,
      status: status || "Available",
      createdBy: userId,
    };

    if (serviceType === "general") {
      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res
          .status(400)
          .json({ message: "General service must have steps" });
      }
      serviceData.steps = steps;
      serviceData.servicePrice = servicePrice;
    } else if (serviceType === "fixed") {
      if (!Array.isArray(serviceProcess) || serviceProcess.length === 0) {
        return res
          .status(400)
          .json({ message: "Fixed service must have a process array" });
      }
      if (!sellingPrice || !companyRevenuePercent || !costToCompany) {
        return res
          .status(400)
          .json({ message: "Fixed service missing required price fields" });
      }
      serviceData.process = serviceProcess;
      serviceData.sellingPrice = sellingPrice;
      serviceData.priceType = priceType || "Fixed";
      serviceData.companyRevenuePercent = companyRevenuePercent;
      serviceData.costToCompany = costToCompany;
      serviceData.providerType = providerType;
      serviceData.workingTime = workingTime;
    } else if (serviceType === "custom") {
      // handle custom later
    } else {
      return res.status(400).json({ message: "Invalid serviceType" });
    }

    const service = new Service(serviceData);
    await service.save();

    res.status(201).json({ message: "Service created successfully", service });
  } catch (error) {
    console.error("createService error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Bulk Upload (from Excel/CSV)
exports.bulkUploadServices = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.isAdmin) {
      return res
        .status(403)
        .json({ message: "Only admins can upload services" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Fetch existing fixed services
    const existingFixed = await Service.find(
      { serviceType: "fixed" },
      "serviceName"
    );
    const existingNames = existingFixed.map((s) => s.serviceName.toLowerCase());

    // Filter new unique entries
    const uniqueEntries = sheetData.filter(
      (item) => !existingNames.includes(item.serviceName.toLowerCase())
    );

    if (uniqueEntries.length === 0) {
      return res.status(400).json({
        message: "All fixed services already exist. No new entries added.",
      });
    }

    const services = await Promise.all(
      uniqueEntries.map(async (item, i) => {
        if (
          !item.orderType ||
          !item.category ||
          !item.serviceName ||
          !item.process ||
          !item.sellingPrice ||
          !item.companyRevenuePercent ||
          !item.costToCompany
        ) {
          console.warn(`Skipping row ${i + 2} - missing required fields`);
          return null;
        }

        const processArray = String(item.process)
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);

        return {
          serviceId: await generateServiceId(),
          orderType: item.orderType,
          serviceType: "fixed",
          serviceScope: item.serviceScope || "Home",
          category: item.category,
          serviceName: item.serviceName,
          process: processArray,
          imageUrl: item.imageUrl || "",
          sellingPrice: Number(item.sellingPrice),
          priceType: item.priceType || "Fixed",
          companyRevenuePercent: Number(item.companyRevenuePercent),
          costToCompany: Number(item.costToCompany),
          providerType: item.providerType || "Internal",
          workingTime: item.workingTime || "",
          status: item.status || "Available",
          createdBy: user._id,
        };
      })
    );

    const validServices = services.filter(Boolean);
    if (validServices.length === 0) {
      return res.status(400).json({ message: "No valid services to upload" });
    }

    await Service.insertMany(validServices);

    res.status(201).json({
      message: "Bulk fixed services uploaded successfully",
      addedCount: validServices.length,
      skippedCount: sheetData.length - validServices.length,
    });
  } catch (error) {
    console.error("bulkUploadServices: Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get All Services
exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.find().populate();
    res.status(200).json(services);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching services", error: error.message });
  }
};

// get Service By ServiceId
exports.getServiceByServiceId = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const service = await Service.findOne({ serviceId });
    if (service.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        message: "No service found",
      });
    }
    return res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching services", error: error.message });
  }
};

// Delete Service
exports.deleteService = async (req, res) => {
  try {
    const user = req.user;
    if (!user.isAdmin) {
      return res
        .status(403)
        .json({ message: "Only admins can delete services" });
    }

    const { id } = req.params;
    const deleted = await Service.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.status(200).json({ message: "Service deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting service", error });
  }
};
