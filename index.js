const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const methodOverride = require("method-override");

require("dotenv").config();

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(methodOverride("_method"));

const mongoURI = process.env.URI;
const password = process.env.PASSWORD;

const conn = mongoose.createConnection(mongoURI);

let gfs;

conn.once("open", function () {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("logo");
});

const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      if (req.body.password === password) {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString("hex") + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: "logo",
          };
          resolve(fileInfo);
        });
      } else {
        reject("Unauthorized!");
      }
    });
  },
  fileDelete: (req) => req.body,
});
const uploadDelete = multer({ storage });

app.get("/", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    if (!files || files.length === 0) {
      res.render("index", { files: false });
    } else {
      res.render("index", { files: files });
    }
  });
});

app.post("/upload", uploadDelete.single("file"), (req, res) => {
  res.redirect("/");
});

app.post("/files/:id", uploadDelete.single("fileDelete"), (req, res) => {
  if (req.body.password === password) {
    gfs.remove({ _id: req.params.id, root: "logo" }, (err, gridStore) => {
      if (err) {
        res.status(404).json({
          error: err,
        });
      }
      res.redirect("/");
    });
  }else{
    res.send("Unauthorized!")
  }
});

app.get("/files", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    if (!files || files.length === 0) {
      return res.status(404).json({
        error: "File Not Found!",
      });
    }
    return res.json(files);
  });
});

app.get("/image/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({
        error: "File Not Found!",
      });
    }
    if (
      file.contentType === "image/svg+xml" ||
      file.contentType === "image/jpeg" ||
      file.contentType === "image/png"
    ) {
      const readstream = gfs.createReadStream(file.filename); // Gives Error For Mongoose Version Greater than ^5.13.7
      readstream.pipe(res);
    } else {
      res.json({
        error: "404 Not Found!",
      });
    }
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server is listening on port ${port}`));
