const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const userAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing or invalid" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JSON_WEB_TOKEN);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await User.findById(decoded.userId).select("emailAddress isVerified");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized User" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth Error:", err.message);
    return res.status(401).json({ message: "Unauthorized access" });
  }
};

module.exports = userAuthMiddleware;