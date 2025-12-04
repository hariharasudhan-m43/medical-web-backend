import express from "express";
import axios from "axios";
import FormData from "form-data";
import multer from "multer";
import fs from "fs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/predict", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;

    const fd = new FormData();
    fd.append("file", fs.createReadStream(filePath));

    const flaskRes = await axios.post(
      "http://localhost:8000/predict",
      fd,
      { headers: fd.getHeaders() }
    );

    fs.unlinkSync(filePath); // delete temp file

    return res.json(flaskRes.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
