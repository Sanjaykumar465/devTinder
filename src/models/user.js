const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      minLength: 4,
      maxLength: 50,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
      lowercase: true,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator: (value) => {
          return validator.isEmail(value);
        },
        message: "Invalid email format",
      },
    },
    password: {
      type: String,
      required: true,
      validate: {
        validator: (value) => {
          return validator.isStrongPassword(value);
        },
        message: "Invalid password format",
      },
    },
    age: {
      type: Number,
      min: 18,
    },
    gender: {
      type: String,
      validate: (value) => {
        if (!["male", "female", "others"].includes(value)) {
          throw new Error("Invalid gender value");
        }
      },
    },
    photoUrl: {
      type: String,
      default:
        "https://avatars.githubusercontent.com/u/107167050?v=4"
    },
    bio: {
      type: String,
      default: "Hello! I am using DevTinder",
    },
    skills: {
      type: [String],
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.getJWTToken = function () {
  const user = this;
  return jwt.sign({ _id: user._id }, "DEV@tinder$3025", {
    expiresIn: "1d",
  });
};

userSchema.methods.validatePassword = async function (passwordInputByUser) {
  const user = this;

  const passwordHash = user.password;

  const isPasswordValid = await bcrypt.compare(
    passwordInputByUser,
    passwordHash
  );
  return isPasswordValid;
};

const User = mongoose.model("User", userSchema);
module.exports = User;
