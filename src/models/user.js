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
        "data:image/webp;base64,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",
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
