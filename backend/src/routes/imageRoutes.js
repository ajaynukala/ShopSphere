const express = require("express");
const multer = require("multer");

const {
  uploadProductImage,
} = require("../controllers/imageController");

const router = express.Router();

// Configure Multer to store uploaded images in memory.
const storage = multer.memoryStorage();

// Configure file size and file type restrictions.
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPEG, PNG and WebP images are allowed.")
      );
    }

    callback(null, true);
  },
});

// POST /api/images/upload
router.post(
  "/upload",
  upload.single("image"),
  uploadProductImage
);

module.exports = router;