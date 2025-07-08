const mongoose = require("mongoose");

const connectDB = async () => {
  await mongoose.connect(
    "mongodb+srv://sanjaykumar:Sanjay2025@cluster0.mavy3sh.mongodb.net/devTinder"
  );
};

module.exports = connectDB;

