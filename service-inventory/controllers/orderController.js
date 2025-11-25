const Order = require("../models/orders");
const Service = require("../models/serviceModel");
const generateOrderId = require("../utils/orderIdGenerator");
const { uploadFileToGCS } = require("../middleware/uploadToGCS");
const DeletedOrder = require("../models/deletedOrder");
const ProcessTemplate = require("../models/processTemplateSchema");
const axios = require("axios");

// Create new order
exports.createOrder = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user not found",
      });
    }

    const {
      serviceType,
      orderType,
      serviceScope,
      category,
      serviceName,
      serviceRequiredDate,
      servicePrice,
      discount,
      tax,
      issueDescription,
      expectedBudget,
      issueLocation,
      materialRequired,
    } = req.body;

    // Step 1: Robust normalization helper
    const normalizeText = (text = "") =>
      text
        .replace(/\u00A0/g, " ") // non-breaking space
        .replace(/\u202F/g, " ") // narrow non-breaking space
        .replace(/\s+/g, " ") // collapse spaces
        .replace(/[–—−]/g, "-") // convert all dash variants
        .replace(/[“”]/g, '"') // smart quotes
        .replace(/[‘’]/g, "'") // smart single quotes
        .trim();

    const normalizedServiceName = normalizeText(serviceName);
    const normalizedOrderType = normalizeText(orderType);
    const normalizedServiceScope = normalizeText(serviceScope);
    const normalizedServiceType = normalizeText(serviceType);

    // Step 2: Generate unique OrderID
    let orderId;
    let isDuplicate = true;
    while (isDuplicate) {
      orderId = generateOrderId();
      const existingOrder = await Order.findOne({ orderId });
      if (!existingOrder) isDuplicate = false;
    }

    // Step 3: Upload optional files
    const imageUrl = await uploadFileToGCS(
      req.files?.pictureOfTheIssue?.[0],
      orderId
    );
    const audioUrl = await uploadFileToGCS(
      req.files?.voiceRecordOfTheIssue?.[0],
      orderId
    );

    let service = null;

    // Step 4: Find service for general/fixed types using normalized + regex
    if (["general", "fixed"].includes(normalizedServiceType.toLowerCase())) {
      service = await Service.findOne({
        serviceType: { $regex: new RegExp(`^${normalizedServiceType}$`, "i") },
        orderType: { $regex: new RegExp(`^${normalizedOrderType}$`, "i") },
        serviceScope: {
          $regex: new RegExp(`^${normalizedServiceScope}$`, "i"),
        },
        serviceName: { $regex: new RegExp(`^${normalizedServiceName}$`, "i") },
      });

      if (!service) {
        console.log("DEBUG NOT FOUND:", {
          serviceType: normalizedServiceType,
          orderType: normalizedOrderType,
          serviceScope: normalizedServiceScope,
          serviceName: normalizedServiceName,
        });

        const allServices = await Service.find(
          {},
          "serviceType orderType serviceScope serviceName"
        );
        console.log("AVAILABLE SERVICES:", allServices);

        return res.status(400).json({
          success: false,
          message: `This ${serviceType} service is not available now`,
        });
      }
    }

    // Step 5: Build order object
    const orderData = {
      orderId,
      serviceType: normalizedServiceType,
      orderType: normalizedOrderType,
      serviceScope: normalizedServiceScope,
      category,
      serviceName: normalizedServiceName,
      serviceRequiredDate,
      issueDescription,
      issueLocation,
      pictureOfTheIssue: imageUrl,
      voiceRecordOfTheIssue: audioUrl,
      customer: user._id,
    };

    if (normalizedServiceType.toLowerCase() === "custom") {
      orderData.expectedBudget = expectedBudget;
      orderData.materialRequired = materialRequired;
    } else {
      orderData.serviceId = service.serviceId;
      orderData.servicePrice =
        servicePrice || service.sellingPrice || service.servicePrice || 0;
      orderData.discount = discount || 0;
      orderData.tax = tax || 0;
    }

    // Step 6: Save order
    const newOrder = new Order(orderData);
    await newOrder.save();

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: newOrder,
    });
  } catch (error) {
    console.error("createOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating order",
      error: error.message,
    });
  }
};

// Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate();
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
};

// Get orders by customer ID
exports.findOrdersByCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    const orders = await Order.find({ customer: customerId });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this customer",
      });
    }

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching customer orders",
      error: error.message,
    });
  }
};

// get order by orderId
exports.findOrderByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (order.length === 0) {
      return res.status(404).json({
        success: true,
        message: "No order found",
      });
    }
    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching order",
      error: error.message,
    });
  }
};

// Delete order by orderId
exports.deleteOrderByOrderId = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Find the order first
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Save it into DeletedOrder collection
    const archivedOrder = new DeletedOrder({
      originalOrderId: order.orderId,
      serviceId: order.serviceId,
      category: order.category,
      serviceName: order.serviceName,

      orderType: order.orderType,
      serviceType: order.serviceType,
      serviceRequiredDate: order.serviceRequiredDate,

      issueLocation: order.issueLocation,
      expectedBudget: order.expectedBudget,
      materialRequired: order.materialRequired,
      servicePrice: order.servicePrice,
      discount: order.discount,
      tax: order.tax,

      issueDescription: order.issueDescription,
      pictureOfTheIssue: order.pictureOfTheIssue,
      voiceRecordOfTheIssue: order.voiceRecordOfTheIssue,
      customer: order.customer,
    });

    await archivedOrder.save();

    // Remove from active orders
    await Order.deleteOne({ orderId });

    return res.status(200).json({
      success: true,
      message: `Order ${orderId} deleted successfully`,
      archivedData: archivedOrder,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting order",
      error: error.message,
    });
  }
};

// Get All Deleted Orders By Customer
exports.getAllDeletedOrder = async (req, res) => {
  try {
    const { customerId } = req.params;

    const deletedOrders = await DeletedOrder.find({ customer: customerId });
    if (!deletedOrders || deletedOrders.length === 0) {
      return res.status(404).json({
        success: false,
        data: [],
        message: "No Deleted Bookings Found",
      });
    }
    return res.status(200).json({
      success: true,
      data: deletedOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching deleting order",
      error: error.message,
    });
  }
};

// Order Rating
exports.rateOrder = async (req, res) => {
  try {
    const user = req.user;
    const { orderId, rating } = req.body;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user not found",
      });
    }

    if (!orderId || !rating) {
      return res.status(400).json({
        success: false,
        message: "Order ID and rating are required",
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Find the order
    const order = await Order.findOne({ orderId, customer: user._id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order is completed
    if (order.orderStatus !== "Completed") {
      return res.status(400).json({
        success: false,
        message: "You can rate this order only after it is completed",
      });
    }

    // Check if already rated
    if (order.review !== undefined && order.review !== null) {
      return res.status(400).json({
        success: false,
        message: "You have already rated this order",
      });
    }

    // Save rating
    order.review = rating;
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Thank you for your feedback!",
      data: { orderId: order.orderId, rating: order.review },
    });
  } catch (error) {
    console.error("rateOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Error while rating order",
      error: error.message,
    });
  }
};

// Update process or subprocess in an order
exports.editOrderByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      processName,
      processDescription,
      name,
      subProcessDescription,
      updateData,
    } = req.body;

    // Find order
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Find or create process
    let process = order.processes.find((p) => p.processName === processName);

    if (!process) {
      const template = await ProcessTemplate.findOne({
        $or: [
          { "processName.en": processName },
          { "processName.ta": processName },
        ],
      });
      process = {
        processName,
        processDescription: processDescription || "",
        order: template ? template.order : null,
        subProcesses: [],
        status: "Pending",
        startedAt: new Date(),
      };

      order.processes.push(process);
      process = order.processes[order.processes.length - 1]; // reference updated object
    }

    // If subProcess name exists → create/update subProcess
    if (name) {
      let subProcess = process.subProcesses.find((sp) => sp.name === name);

      // Create new subProcess if not present
      if (!subProcess) {
        subProcess = {
          name,
          subProcessDescription: subProcessDescription || "",
          ...updateData,
        };

        process.subProcesses.push(subProcess);
      } else {
        // Update existing subProcess fields
        Object.keys(updateData).forEach((key) => {
          subProcess[key] = updateData[key];
        });

        if (subProcessDescription) {
          subProcess.subProcessDescription = subProcessDescription;
        }
      }

      // Auto-complete process if ALL subProcesses are completed
      const allCompleted =
        process.subProcesses.length > 0 &&
        process.subProcesses.every((sp) => sp.isCompleted === true);

      if (allCompleted) {
        process.status = "Completed";
        process.completedAt = new Date();
      }
    }

    // Save the order
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating order",
      error: error.message,
    });
  }
};

/********************************************************
                 SERVICE OF PROCESS STEPS
********************************************************/

// step 1 - assign technician
exports.assignTechnicianToOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { technicianIds } = req.body;

    if (
      !technicianIds ||
      !Array.isArray(technicianIds) ||
      technicianIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "technicianIds array is required",
      });
    }

    const TECHNICIAN_SERVICE_URL = process.env.TECHNICIAN_SERVICE_URL;

    // Fetch Order
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Find main process
    let orderProcess = order.processes.find(
      (p) =>
        p.processName === "Technician Allocation" ||
        p.processName === "தொழில்நுட்ப நிபுணர் ஒதுக்கல்"
    );

    if (!orderProcess) {
      return res.status(400).json({
        success: false,
        message: "Technician Allocation process not found",
      });
    }

    // Find subprocess
    let subProcess = orderProcess.subProcesses.find(
      (sp) =>
        sp.name === "Assign Technician" ||
        sp.name === "தொழில்நுட்ப நிபுணரை ஒதுக்குதல்"
    );

    if (!subProcess) {
      return res.status(400).json({
        success: false,
        message: "Assign Technician subprocess not found",
      });
    }

    if (!Array.isArray(subProcess.assignedTechnicians)) {
      subProcess.assignedTechnicians = [];
    }

    // LOOP TECHNICIAN IDs
    for (let technicianId of technicianIds) {
      let tech;
      try {
        const url = `${TECHNICIAN_SERVICE_URL}/api/technician/${technicianId}`;
        const response = await axios.get(url);
        tech = response.data;

        if (!tech || !tech.data) {
          return res.status(404).json({
            success: false,
            message: `Technician not found: ${technicianId}`,
          });
        }
      } catch (err) {
        return res.status(404).json({
          success: false,
          message: `Technician not found`,
        });
      }

      // CHECK IF TECHNICIAN IS BUSY
      if (tech.data.availabilityStatus === "Busy") {
        let name;

        if (tech.data.technicianType === "Individual") {
          name = `${tech.data.firstName || ""} ${
            tech.data.lastName || ""
          }`.trim();
        } else if (tech.data.technicianType === "Organization") {
          name =
            tech.data.organizationDetails?.organizationName || "Organization";
        }

        return res.status(400).json({
          success: false,
          message: `Technician ${name} is already busy with another order`,
        });
      }

      // DUPLICATE CHECK
      if (subProcess.assignedTechnicians.includes(technicianId)) {
        continue;
      }

      subProcess.assignedTechnicians.push(technicianId);

      // UPDATE TECHNICIAN STATUS
      try {
        const updateUrl = `${TECHNICIAN_SERVICE_URL}/api/technician/${technicianId}/update`;

        const updateResponse = await axios.put(updateUrl, {
          availabilityStatus: "Busy",
          orderId: orderId,
        });
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: `Failed to update technician status in microservice: ${technicianId}`,
        });
      }
    }

    // Mark subprocess as completed
    subProcess.isCompleted = true;
    subProcess.completedAt = new Date();

    // Update main process
    const allCompleted = orderProcess.subProcesses.every(
      (sp) => sp.isCompleted
    );
    orderProcess.status = allCompleted ? "Completed" : "In Progress";
    if (allCompleted) orderProcess.completedAt = new Date();

    // Save order
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Technicians assigned successfully",
      data: order,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error assigning technicians",
      error: err.message,
    });
  }
};

// step 2 - Site Visit -> i) schedule visit
exports.scheduleVisit = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { scheduledDate, scheduledTime } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Find main process "Site Visit"
    const siteVisit = order.processes.find(
      (p) => p.processName === "Site Visit" || p.processName === "தளப் பார்வை"
    );
    if (!siteVisit) {
      return res
        .status(400)
        .json({ success: false, message: "Site Visit process not found" });
    }

    // Find subProcess "Schedule Visit"
    const scheduleProcess = siteVisit.subProcesses.find(
      (s) => s.name === "Schedule Visit" || s.name === "பார்வையை திட்டமிடுதல்"
    );
    if (!scheduleProcess) {
      return res
        .status(400)
        .json({ success: false, message: "Schedule Visit subprocess missing" });
    }

    scheduleProcess.scheduledDate = scheduledDate;
    scheduleProcess.scheduledTime = scheduledTime;
    scheduleProcess.isCompleted = true;
    scheduleProcess.completedAt = new Date();

    siteVisit.status = "Completed";

    await order.save();

    res.status(200).json({
      success: true,
      message: "Visit scheduled successfully",
      scheduledData: scheduleProcess,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error scheduling visit",
      error: err.message,
    });
  }
};

// step 2 - Site Visit -> ii) Arrival confirmation
exports.generateArrivalOTP = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    const siteVisit = order.processes.find(
      (p) => p.processName === "Site Visit" || p.processName === "தளப் பார்வை"
    );
    const arrivalSub = siteVisit.subProcesses.find(
      (s) =>
        s.name === "Arrival Confirmation" || s.name === "வருகை உறுதிப்படுத்தல்"
    );

    const otp = Math.floor(1000 + Math.random() * 9000);

    arrivalSub.otp = otp;
    arrivalSub.isVerified = false;

    await order.save();

    res.status(200).json({
      success: true,
      message: "OTP generated successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Unable to generate OTP",
      error: err.message,
    });
  }
};

exports.verifyArrivalOTP = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    const siteVisit = order.processes.find(
      (p) => p.processName === "Site Visit" || p.processName === "தளப் பார்வை"
    );
    const arrivalSub = siteVisit.subProcesses.find(
      (s) =>
        s.name === "Arrival Confirmation" || s.name === "வருகை உறுதிப்படுத்தல்"
    );

    if (arrivalSub.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    arrivalSub.isVerified = true;
    arrivalSub.isCompleted = true;
    arrivalSub.completedAt = new Date();

    siteVisit.status = "Arrived";

    await order.save();

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Unable to verify OTP",
      error: err.message,
    });
  }
};

// step 3 - issue or Installation Analysis -> i) Technician Initial Observation Report
exports.initialObservationReport = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { technicianReport } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    const siteVisit = order.processes.find(
      (p) => p.processName === "Site Visit" || p.processName === "தளப் பார்வை"
    );

    if (!siteVisit) {
      return res.status(400).json({
        success: false,
        message: "Site Visit process not found",
      });
    }

    const arrivalSub = siteVisit.subProcesses.find(
      (s) =>
        s.name === "Arrival Confirmation" || s.name === "வருகை உறுதிப்படுத்தல்"
    );

    if (!arrivalSub) {
      return res.status(400).json({
        success: false,
        message: "Arrival Confirmation subprocess missing",
      });
    }

    // Block Initial Observation if Arrival OTP not verified
    if (!arrivalSub.isVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Technician arrival is not verified yet. OTP must be validated before continuing.",
      });
    }

    const issueAnalysis = order.processes.find(
      (p) =>
        p.processName === "Issue or Installation Analysis" ||
        p.processName === "பிரச்சினை அல்லது நிறுவல் பகுப்பாய்வு"
    );
    const initialObs = issueAnalysis.subProcesses.find(
      (s) =>
        s.name === "Initial Observation" || s.name === "ஆரம்பக் கண்காணிப்பு"
    );

    initialObs.technicianReport = technicianReport;
    initialObs.isCompleted = true;
    initialObs.completedAt = new Date();

    issueAnalysis.status = "Completed";

    await order.save();

    res.status(200).json({
      success: true,
      message: "Initial observation saved successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Unable to save observation",
      error: err.message,
    });
  }
};

// step - 4: Admin Review & BOM Calcultaion -> i) Receive Technician Report
exports.technicianReportReview = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    const adminReview = order.processes.find(
      (p) =>
        p.processName === "Admin Review & BOM Calculation" ||
        p.processName ===
          "நிர்வாகி மதிப்பாய்வு மற்றும் பொருள் பட்டியல் (BOM) கணக்கீடு"
    );
    if (!adminReview) {
      return res
        .status(404)
        .json({ success: false, message: "Admin review process not found" });
    }
    const technicianReport = adminReview.subProcesses.find(
      (s) =>
        s.name === "Receive Technician Report" ||
        s.name === "தொழில்நுட்ப நிபுணர் அறிக்கை பெறுதல்"
    );
    technicianReport.isCompleted = true;
    technicianReport.completedAt = new Date();

    // save order
    await order.save();

    return res
      .status(200)
      .json({ success: true, message: "Technician Report Recieved" });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Unable to save observation",
      error: err.message,
    });
  }
};

// step - 4: Admin Review & BOM Calcultaion -> ii) BOM Preparation
exports.generateBOM = async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      serviceType,
      materialItems = [],
      serviceCharge = 0,
      additionalCharges = 0,
      taxPercentage = 18
    } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // -------------------------
    // STEP 1: Validate initial observation
    // -------------------------
    const issueAnalysis = order.processes.find(
      (p) =>
        p.processName === "Issue or Installation Analysis" ||
        p.processName === "பிரச்சினை அல்லது நிறுவல் பகுப்பாய்வு"
    );

    if (!issueAnalysis) {
      return res.status(400).json({
        success: false,
        message: "Issue analysis process not found",
      });
    }

    const initialObs = issueAnalysis.subProcesses.find(
      (s) =>
        s.name === "Initial Observation" ||
        s.name === "ஆரம்பக் கண்காணிப்பு"
    );

    if (!initialObs || !initialObs.isCompleted) {
      return res.status(400).json({
        success: false,
        message: "Initial Observation not completed. BOM cannot be generated.",
      });
    }

    // -------------------------
    // STEP 2: Find BOM Preparation process
    // -------------------------
    const adminReviewProcess = order.processes.find(
      (p) =>
        p.processName === "Admin Review & BOM Calculation" ||
        p.processName === "நிர்வாகி மதிப்பாய்வு மற்றும் பொருள் பட்டியல் (BOM) கணக்கீடு"
    );

    if (!adminReviewProcess) {
      return res.status(400).json({
        success: false,
        message: "Admin Review & BOM Calculation process not found",
      });
    }

    const bomPreparation = adminReviewProcess.subProcesses.find(
      (s) =>
        s.name === "BOM Preparation" ||
        s.name === "பொருள் பட்டியல் தயாரித்தல்"
    );

    if (!bomPreparation) {
      return res.status(400).json({
        success: false,
        message: "BOM Preparation step missing in order",
      });
    }

    // -------------------------
    // STEP 3: Generate BOM (General or Custom)
    // -------------------------
    let materialCost = 0;

    if (serviceType === "general") {

      const fixedPrice = order.generalServicePrice || 0;
      const taxAmount = (fixedPrice * taxPercentage) / 100;
      const totalPayable = fixedPrice + taxAmount;

      order.billOfMaterial = {
        serviceType: "general",
        materialItems: [],
        materialCost: 0,
        serviceCharge: fixedPrice,
        additionalCharges: 0,
        subtotal: fixedPrice,
        taxPercentage,
        taxAmount,
        totalPayable,
        generatedAt: new Date(),
        bomStatus: "Pending"
      };

    } else if (serviceType === "custom") {

      materialCost = materialItems.reduce(
        (sum, item) => sum + item.qty * item.unitPrice,
        0
      );

      const subtotal = materialCost + serviceCharge + additionalCharges;
      const taxAmount = (subtotal * taxPercentage) / 100;
      const totalPayable = subtotal + taxAmount;

      order.billOfMaterial = {
        serviceType: "custom",
        materialItems,
        materialCost,
        serviceCharge,
        additionalCharges,
        subtotal,
        taxPercentage,
        taxAmount,
        totalPayable,
        generatedAt: new Date(),
        bomStatus: "Pending"
      };

    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid serviceType. Allowed: custom | general",
      });
    }

    // -------------------------
    // STEP 4: Mark BOM Preparation as completed
    // -------------------------
    bomPreparation.isCompleted = true;
    bomPreparation.completedAt = new Date();

    // You can update main process status if needed:
    adminReviewProcess.status = "Completed";

    // -------------------------
    // STEP 5: Save order
    // -------------------------
    await order.save();

    return res.status(200).json({
      success: true,
      message: "BOM generated successfully",
      bom: order.billOfMaterial,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Unable to generate BOM",
      error: err.message,
    });
  }
};

// BOM accepted/rejected
exports.updateBOMStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, rejectionReason } = req.body;
    const userId = req.user?._id;

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed: Approved | Rejected"
      });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (!order.billOfMaterial) {
      return res.status(400).json({
        success: false,
        message: "No existing BOM found"
      });
    }

    // -------------------------
    // UPDATE BOM STATUS
    // -------------------------
    order.billOfMaterial.bomStatus = status;

    if (status === "Approved") {
      order.billOfMaterial.bomApprovedAt = new Date();
      order.billOfMaterial.bomApprovedBy = userId;
      order.billOfMaterial.rejectionReason = null;
    }

    if (status === "Rejected") {
      order.billOfMaterial.rejectionReason = rejectionReason || "No reason provided";
      order.billOfMaterial.bomApprovedAt = null;
      order.billOfMaterial.bomApprovedBy = null;
    }

    // -----------------------------------------------------
    // UPDATE PROCESS → "Quotation & Client Approval"
    // SUBPROCESS → "Approval Confirmation"
    // -----------------------------------------------------
    const quotationProcess = order.processes.find(
      (p) =>
        p.processName === "Quotation & Client Approval" ||
        p.processName === "மதிப்பீடு மற்றும் வாடிக்கையாளர் ஒப்புதல்"
    );

    if (!quotationProcess) {
      return res.status(400).json({
        success: false,
        message: "Quotation & Client Approval process not found"
      });
    }

    const approvalSubProcess = quotationProcess.subProcesses.find(
      (s) =>
        s.name === "Approval Confirmation" ||
        s.name === "ஒப்புதல் உறுதிப்படுத்தல்"
    );

    if (!approvalSubProcess) {
      return res.status(400).json({
        success: false,
        message: "Approval Confirmation sub-process not found"
      });
    }

    // Mark sub-process as completed
    approvalSubProcess.isCompleted = true;
    approvalSubProcess.completedAt = new Date();

    // (Optional) Mark whole process completed if all sub-processes done
    const allCompleted = quotationProcess.subProcesses.every((sp) => sp.isCompleted);
    if (allCompleted) {
      quotationProcess.status = "Completed";
      quotationProcess.completedAt = new Date();
    }

    // -------------------------
    // SAVE ORDER
    // -------------------------
    await order.save();

    return res.status(200).json({
      success: true,
      message: `BOM status updated to ${status}`,
      bom: order.billOfMaterial
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Unable to update BOM status",
      error: err.message
    });
  }
};

// edit BOM
exports.editBOM = async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      serviceType,
      materialItems = [],
      serviceCharge = 0,
      additionalCharges = 0,
      taxPercentage = 18,
    } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!order.billOfMaterial) {
      return res.status(400).json({ success: false, message: "BOM does not exist" });
    }

    // BLOCK EDITING if user has already approved quotation
    const quotationProcess = order.processes.find(
      (p) =>
        p.processName === "Quotation & Client Approval" ||
        p.processName === "மதிப்பீடு மற்றும் வாடிக்கையாளர் ஒப்புதல்"
    );

    if (quotationProcess) {
      const approvalStep = quotationProcess.subProcesses.find(
        (s) =>
          s.name === "Approval Confirmation" ||
          s.name === "ஒப்புதல் உறுதிப்படுத்தல்"
      );

      if (approvalStep && approvalStep.isCompleted === true) {
        return res.status(403).json({
          success: false,
          message:
            "BOM cannot be edited because the client has already approved the quotation",
        });
      }
    }

    // RESET APPROVAL STATUS (When editing BOM)
    order.billOfMaterial.bomStatus = "Pending";
    order.billOfMaterial.bomApprovedAt = null;
    order.billOfMaterial.bomApprovedBy = null;


    // CASE 1: GENERAL SERVICE BOM
    if (serviceType === "general") {
      const fixedPrice = order.generalServicePrice || 0;

      const taxAmount = (fixedPrice * taxPercentage) / 100;
      const totalPayable = fixedPrice + taxAmount;

      order.billOfMaterial = {
        serviceType: "general",
        materialItems: [],
        materialCost: 0,
        serviceCharge: fixedPrice,
        additionalCharges: 0,
        subtotal: fixedPrice,
        taxPercentage,
        taxAmount,
        totalPayable,
        generatedAt: new Date(),
        bomStatus: "Pending",
      };

      await order.save();

      return res.status(200).json({
        success: true,
        message: "General BOM updated successfully",
        bom: order.billOfMaterial,
      });
    }

    // CASE 2: CUSTOM SERVICE BOM
    if (serviceType === "custom") {
      const materialCost = materialItems.reduce(
        (sum, item) => sum + item.qty * item.unitPrice,
        0
      );

      const subtotal = materialCost + serviceCharge + additionalCharges;
      const taxAmount = (subtotal * taxPercentage) / 100;
      const totalPayable = subtotal + taxAmount;

      order.billOfMaterial = {
        serviceType: "custom",
        materialItems,
        materialCost,
        serviceCharge,
        additionalCharges,
        subtotal,
        taxPercentage,
        taxAmount,
        totalPayable,
        generatedAt: new Date(),
        bomStatus: "Pending",
      };

      await order.save();

      return res.status(200).json({
        success: true,
        message: "Custom BOM updated successfully",
        bom: order.billOfMaterial,
      });
    }

    // INVALID TYPE
    return res.status(400).json({
      success: false,
      message: "Invalid serviceType",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Unable to edit BOM",
      error: err.message,
    });
  }
};

// delete BOM
exports.deleteBOM = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (!order.billOfMaterial) {
      return res.status(400).json({
        success: false,
        message: "No BOM found to delete"
      });
    }

    // ------------------------------------------
    // BLOCK DELETE IF USER HAS APPROVED QUOTATION
    // ------------------------------------------
    const quotationProcess = order.processes.find(
      (p) =>
        p.processName === "Quotation & Client Approval" ||
        p.processName === "மதிப்பீடு மற்றும் வாடிக்கையாளர் ஒப்புதல்"
    );

    if (quotationProcess) {
      const approvalStep = quotationProcess.subProcesses.find(
        (s) =>
          s.name === "Approval Confirmation" ||
          s.name === "ஒப்புதல் உறுதிப்படுத்தல்"
      );

      if (approvalStep && approvalStep.isCompleted === true) {
        return res.status(403).json({
          success: false,
          message: "BOM cannot be deleted because user has already approved the quotation"
        });
      }
    }

    // -----------------------------
    // DELETE THE BOM
    // -----------------------------
    order.billOfMaterial = null;

    // --------------------------------------------
    // RESET "BOM Preparation" isCompleted = false
    // --------------------------------------------
    const adminReviewProcess = order.processes.find(
      (p) =>
        p.processName === "Admin Review & BOM Calculation" ||
        p.processName === "நிர்வாகி மதிப்பாய்வு மற்றும் பொருள் பட்டியல் (BOM) கணக்கீடு"
    );

    if (adminReviewProcess) {
      const bomPrep = adminReviewProcess.subProcesses.find(
        (s) =>
          s.name === "BOM Preparation" ||
          s.name === "பொருள் பட்டியல் தயாரித்தல்"
      );

      if (bomPrep) {
        bomPrep.isCompleted = false;
        bomPrep.completedAt = null;
      }
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: "BOM deleted successfully and process updated"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Unable to delete BOM",
      error: err.message
    });
  }
};

// get BOM by orderId
exports.getBOMByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!order.billOfMaterial) {
      return res.status(404).json({
        success: false,
        message: "No BOM generated yet for this order",
      });
    }

    return res.status(200).json({
      success: true,
      bom: order.billOfMaterial,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch BOM",
      error: err.message,
    });
  }
};
