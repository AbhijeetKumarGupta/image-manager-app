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
    });
  },
});
const upload = multer({ storage });

app.get("/", (req, res) => {
  //   res.json({
  //     message: "Welcome",
  //   });

  gfs.files.find().toArray((err, files) => {
    if (!files || files.length === 0) {
      res.render("index", { files: false });
    } else {
      res.render("index", { files: files });
    }
    //   res.json(files);
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  //   res.json({ file: req.file });
  res.redirect("/");
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
    // res.json(file);
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

app.delete("/files/:id", (req, res) => {
  gfs.remove({ _id: req.params.id, root: "logo" }, (err, gridStore) => {
    if (err) {
      res.status(404).json({
        error: err,
      });
    }
    res.redirect("/");
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server is listening on port ${port}`));
