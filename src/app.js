const express = require("express");
const connectDB = require("./config/database");
const app = express();
const cors = require("cors");
const http = require("http");
const cookieParser = require("cookie-parser");

// CORS configuration
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "token"]
  })
);

// Middleware
app.use(express.json());
app.use(cookieParser());

// Routes
const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");
const chatRouter = require("./routes/chat"); // Add chat routes

app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", chatRouter); // Add this line

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const initializeSocket = require("./utils/socket");
const io = initializeSocket(server);

// Make io accessible to routes
app.set('io', io);

// Connect to database and start server
connectDB()
  .then(() => {
    console.log("Database connected successfully");
    server.listen(7777, () => {
      console.log("Server is running on port 7777");
      console.log("Socket.io initialized");
    });
  })
  .catch((err) => {
    console.error("Database cannot be connected", err);
  });