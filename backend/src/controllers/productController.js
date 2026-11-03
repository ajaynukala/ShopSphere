
const pool = require("../config/db");

async function getAllProducts(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, description, price, category, stock, image_url, created_at
       FROM public.products
       ORDER BY id ASC`
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
}

async function getProductById(req, res) {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id) || Number(id) < 1) {
      return res.status(400).json({
        success: false,
        message: "Product ID must be a positive integer",
      });
    }

    const result = await pool.query(
      `SELECT id, name, description, price, category, stock, image_url, created_at
       FROM public.products
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching product:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
}

module.exports = {
  getAllProducts,
  getProductById,
};

