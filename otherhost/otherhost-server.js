const path = require("path");
const express = require("express");
const app = express();
const port = 4000;

// CORSを許可する
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(express.static(path.join(__dirname, "assets")));

app.get("/", (req, res) => {
  res.send("hello");
});

app.listen(port);
