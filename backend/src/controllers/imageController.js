
const crypto = require("crypto");
const supabase = require("../config/supabase");
const pool = require("../config/db");

async function uploadProductImage(req, res) {
  let uploadedFileName = null;

  try {
    const { productId } = req.body;

    // Validate the product ID.
    if (!/^[1-9]\d*$/.test(productId || "")) {
      return res.status(400).json({
        success: false,
        message: "A valid product ID is required.",
      });
    }

    // Validate the uploaded file.
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image to upload.",
      });
    }

    const allowedTypes = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const extension = allowedTypes[req.file.mimetype];

    if (!extension) {
      return res.status(400).json({
        success: false,
        message: "Only JPEG, PNG and WebP images are allowed.",
      });
    }

    // Check whether the product exists.
    const productResult = await pool.query(
      "SELECT id FROM public.products WHERE id = $1",
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // Generate a unique filename.
    uploadedFileName =
      `${crypto.randomUUID()}.${extension}`;

    // Upload image to Supabase Storage.
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(uploadedFileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError.message);

      return res.status(500).json({
        success: false,
        message: "Image upload failed.",
      });
    }

    // Generate public image URL.
    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(uploadedFileName);

    const imageUrl = data.publicUrl;

    // Update the product record.
    await pool.query(
      `UPDATE public.products
       SET image_url = $1
       WHERE id = $2`,
      [imageUrl, productId]
    );

    return res.status(200).json({
      success: true,
      message: "Product image uploaded and linked successfully.",
      productId: Number(productId),
      imageUrl,
    });

  } catch (error) {
    console.error("Product image upload error:", error.message);

    // Remove the uploaded file if database update fails.
    if (uploadedFileName) {
      const { error: cleanupError } = await supabase.storage
        .from("product-images")
        .remove([uploadedFileName]);

      if (cleanupError) {
        console.error(
          "Storage cleanup error:",
          cleanupError.message
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Unable to upload and link product image.",
    });
  }
}

module.exports = {
  uploadProductImage,
};
