const jwt = require("jsonwebtoken");
const User = require("../models/user");

const userAuth = async (req, res, next) => {
  try {
    const { token } = req.cookies;
    if (!token) {
      throw new Error("token is not valid.....");
    }
    const decodeobj = jwt.verify(token, "DEV@tinder$3025");
    const { _id } = decodeobj;
    const user = await User.findById(_id); // <-- FIXED HERE
    if (!user) {
      throw new Error("User not found");
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).send("ERROR: " + err.message);
  }
};

module.exports = {
  userAuth,
};
