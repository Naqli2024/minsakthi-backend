const jwt = require('jsonwebtoken');
const axios = require("axios");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing or invalid" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JSON_WEB_TOKEN);
    } catch (jwtErr) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const userId = decoded.userId || decoded._id;
    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload: missing userId" });
    }

    const userServiceURL = process.env.USER_SERVICE_URL;
    if (!userServiceURL) {
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const userResponse = await axios.get(`${userServiceURL}/api/getUserById/${userId}`);
    if (!userResponse.data || !userResponse.data.success) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = userResponse.data.data; // attach the user object

    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized access", error: err.message });
  }
};

module.exports = authMiddleware;