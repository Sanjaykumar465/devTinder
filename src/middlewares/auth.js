const jwt = require("jsonwebtoken");
const User = require("../models/user");

const userAuth = async (req, res, next) => {
  try {
    const { token } = req.cookies;
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Please login to access this resource" 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, "DEV@tinder$3025");
    
    // Find user
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Attach user to request
    req.user = user;
    next();
    
  } catch (err) {
    // Handle different error cases
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }
    
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired, please login again"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = { userAuth };