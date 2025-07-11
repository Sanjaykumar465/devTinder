const express = require("express");
const { userAuth } = require("../middlewares/auth");

const profileRouter = express.Router();

profileRouter.get("/profile", userAuth, async (req, res) => {
  try {
    const user = req.user; // User is set by userAuth middleware

    res.send(user);
  } catch (err) {
    res.status(401).send("ERROR: " + err.message);
  }
});

module.exports = profileRouter;
