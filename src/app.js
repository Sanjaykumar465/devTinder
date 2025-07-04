const express = require("express");

const app = express();

app.use("/test", (req, res) => {
  res.send("hello worlld from  to server!!!!");
});

app.listen(7777, () => {
  console.log("server is running on port 7777");
});
