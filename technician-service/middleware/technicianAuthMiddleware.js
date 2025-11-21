const jwt = require("jsonwebtoken");
const axios = require("axios");

const technicianAuthMiddleware = async (req, res, next) => {
  try {
    // Validate Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing or invalid",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JSON_WEB_TOKEN);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const userId = decoded.technicianId || decoded._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Token payload missing technicianId",
      });
    }

    // Validate Microservice URL
    const technicianServiceURL = process.env.TECHNICIAN_SERVICE_URL;
    if (!technicianServiceURL) {
      return res.status(500).json({
        success: false,
        message: "TECHNICIAN_SERVICE_URL not configured",
      });
    }

    // Fetch Technician Details from Technician-Service
    let userResponse;
    try {
      userResponse = await axios.get(
        `${technicianServiceURL}/api/technician/${userId}`
      );
    } catch (apiErr) {
      return res.status(503).json({
        success: false,
        message: "Unable to reach Technician Service",
        error: apiErr.message,
      });
    }

    // Validate technician-service response
    if (!userResponse.data || !userResponse.data.data) {
      return res.status(401).json({
        success: false,
        message: "Technician not found or unauthorized",
      });
    }

    // Attach technician to req.user
    req.user = userResponse.data.data;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized access",
      error: err.message,
    });
  }
};

module.exports = technicianAuthMiddleware;
