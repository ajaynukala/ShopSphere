const express = require("express");

const authenticateCustomer = require("../middleware/authMiddleware");
const { createOrder } = require("../controllers/orderController");

const router = express.Router();

// Create a new customer order
router.post("/", authenticateCustomer, createOrder);

module.exports = router;