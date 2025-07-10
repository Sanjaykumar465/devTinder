const express = require("express");
const connectDB = require("./config/database");
const app = express();
const User = require("./models/user");
const { ValidateSignUpData } = require("./utils/Validation");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

app.use(express.json());
app.use(cookieParser());

app.post("/signup", async (req, res) => {
  try {
    // Validation of user data
    ValidateSignUpData(req);

    const { firstName, lastName, email, password } = req.body;

    // Encrypt the password
    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({
      firstName,
      lastName,
      email,
      password: passwordHash,
    });

    await user.save();
    res.send("User created successfully");
  } catch (err) {
    res.status(500).send("Error creating user: " + err.message);
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("Invalid Credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid Credentials");
    }

    const token = jwt.sign({ _id: user._id }, "DEV@tinder$3025");

    // ✅ Set token in cookie
    res.cookie("token", token, {});

    res.send("Login Successful");
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});
app.get("/profile", async (req, res) => {
  try {
    const cookies = req.cookies;
    const { token } = cookies;
    if (!token) {
      throw new Error("Invalid Token");
    }
    const decodedMessage = await jwt.verify(token, "DEV@tinder$3025");
    const { _id } = decodedMessage;
    console.log("Loged in user ID:", _id);

    const user = await User.findById(_id);
    if (!user) {
      throw new Error("User does not exist");
    }

    res.send(user);
  } catch (err) {
    res.status(401).send("ERROR: " + err.message);
  }
});

// app.get("/profile", async (req, res) => {
//   const { token } = req.cookies;

//   if (!token) {
//     return res.status(401).send("Access denied. No token provided.");
//   }

//   try {
//     const decoded = jwt.verify(token, "DEV@tinder$3025");
//     const { _id } = decoded;
//     console.log("Logged in user ID:", _id);
//     res.send("Token verified. Profile access granted.");
//   } catch (err) {
//     res.status(401).send("Invalid or expired token.");
//   }
// });

app.get("/feed", async (req, res) => {
  try {
    const user = await User.find({});
    res.send(user);
  } catch (err) {
    res.status(400).send("something went wrong");
  }
});

app.delete("/user", async (req, res) => {
  const userId = req.body.userId;
  try {
    const user = await User.findByIdAndDelete(userId);
    res.send("User deleted successfully");
  } catch (err) {
    res.status(400).send("something went wrong");
  }
});

app.patch("/user", async (req, res) => {
  const userId = req.body.userId;
  const data = req.body;
  console.log(data);

  // Only allow specific fields to be updated
  const ALLOWED_UPDATES = ["photoUrl", "bio", "gender", "age", "skills"];
  const isUpdateAllowed = Object.keys(data).every((key) =>
    ALLOWED_UPDATES.includes(key)
  );

  if (!isUpdateAllowed) {
    return res.status(400).send("Invalid update fields");
  }

  try {
    await User.findByIdAndUpdate(userId, data, { new: true });
    res.send("User updated successfully");
  } catch (err) {
    res.status(400).send("something went wrong");
  }
});

connectDB()
  .then(() => {
    console.log("Database connected successfully");
    app.listen(7777, () => {
      console.log("Server is running on port 7777");
    });
  })
  .catch((err) => {
    console.error("Database cannot be connected", err);
  });
