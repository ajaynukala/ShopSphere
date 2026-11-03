
const express = require("express");
const cors = require("cors");
const multer = require("multer");

require("dotenv").config();

const productRoutes = require("./routes/productRoutes");
const imageRoutes = require("./routes/imageRoutes");

const app = express();

// CORS configuration
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "E-commerce API is running!",
  });
});

// API routes
app.use("/api/products", productRoutes);
app.use("/api/images", imageRoutes);

// Global error handler
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Image must not exceed 5 MB."
          : "Image upload failed validation.",
    });
  }

  if (
    error.message ===
    "Only JPEG, PNG and WebP images are allowed."
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Unhandled application error:", error.message);

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});

module.exports = app;
