
const pool = require("../config/db");

// Convert a PostgreSQL decimal price into integer paise.
// This avoids JavaScript floating-point calculation errors.
function toPaise(value) {
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);

  if (!match) {
    throw new Error("Invalid product price returned by database.");
  }

  const rupees = BigInt(match[1]);
  const paise = BigInt((match[2] || "").padEnd(2, "0"));

  return rupees * 100n + paise;
}

// Convert integer paise into a PostgreSQL decimal string.
function formatMoney(paise) {
  const rupees = paise / 100n;
  const remainingPaise = String(paise % 100n).padStart(2, "0");

  return `${rupees}.${remainingPaise}`;
}

async function createOrder(req, res, next) {
  let client;
  let transactionStarted = false;

  try {
    const { addressId, items, customerNote } = req.body;

    // ========================================
    // 1. VALIDATE REQUEST
    // ========================================

    if (
      !addressId ||
      !/^[1-9]\d*$/.test(String(addressId))
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid shipping address.",
      });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Your cart must contain between 1 and 50 items.",
      });
    }

    if (
      customerNote !== undefined &&
      (typeof customerNote !== "string" || customerNote.length > 500)
    ) {
      return res.status(400).json({
        success: false,
        message: "Customer note must not exceed 500 characters.",
      });
    }

    // Validate and combine duplicate product IDs.
    const itemMap = new Map();

    for (const item of items) {
      if (
        !item ||
        !/^[1-9]\d*$/.test(String(item.productId)) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "One or more cart items are invalid.",
        });
      }

      const productId = String(item.productId);
      const currentQuantity = itemMap.get(productId) || 0;
      const combinedQuantity = currentQuantity + item.quantity;

      if (combinedQuantity > 100) {
        return res.status(400).json({
          success: false,
          message: "Maximum quantity per product is 100.",
        });
      }

      itemMap.set(productId, combinedQuantity);
    }

    const normalizedItems = Array.from(
      itemMap,
      ([productId, quantity]) => ({
        productId,
        quantity,
      })
    );

    // ========================================
    // 2. START DATABASE TRANSACTION
    // ========================================

    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    // ========================================
    // 3. VERIFY CUSTOMER SHIPPING ADDRESS
    // ========================================

    const addressResult = await client.query(
      `SELECT
          full_name,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country
       FROM public.customer_addresses
       WHERE id = $1
         AND user_id = $2`,
      [addressId, req.user.id]
    );

    if (addressResult.rows.length === 0) {
      const error = new Error(
        "Shipping address not found. Please select a valid address."
      );
      error.status = 404;
      throw error;
    }

    const address = addressResult.rows[0];

    // ========================================
    // 4. LOCK PRODUCTS AND CHECK STOCK
    // ========================================

    const productIds = normalizedItems.map(
      (item) => item.productId
    );

    const productResult = await client.query(
      `SELECT
          id,
          name,
          price,
          stock,
          image_url
       FROM public.products
       WHERE id = ANY($1::bigint[])
       ORDER BY id
       FOR UPDATE`,
      [productIds]
    );

    if (productResult.rows.length !== normalizedItems.length) {
      const error = new Error(
        "One or more products are no longer available."
      );
      error.status = 400;
      throw error;
    }

    const productMap = new Map(
      productResult.rows.map((product) => [
        String(product.id),
        product,
      ])
    );

    // ========================================
    // 5. VALIDATE STOCK AND CALCULATE TOTALS
    // ========================================

    let subtotalPaise = 0n;
    const orderItems = [];

    for (const item of normalizedItems) {
      const product = productMap.get(item.productId);

      if (!product) {
        const error = new Error("Product not found.");
        error.status = 400;
        throw error;
      }

      if (product.stock < item.quantity) {
        const error = new Error(
          `Insufficient stock for ${product.name}. Available: ${product.stock}.`
        );
        error.status = 409;
        throw error;
      }

      const unitPricePaise = toPaise(product.price);
      const lineTotalPaise = unitPricePaise * BigInt(item.quantity);

      subtotalPaise += lineTotalPaise;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        productImageUrl: product.image_url,
        unitPrice: formatMoney(unitPricePaise),
        quantity: item.quantity,
        lineTotal: formatMoney(lineTotalPaise),
      });
    }

    // Initial checkout pricing.
    const shippingFeePaise = 0n;
    const taxPaise = 0n;
    const discountPaise = 0n;

    const totalPaise =
      subtotalPaise +
      shippingFeePaise +
      taxPaise -
      discountPaise;

    // ========================================
    // 6. CREATE ORDER
    // ========================================

    const orderResult = await client.query(
      `INSERT INTO public.orders (
          user_id,
          subtotal,
          shipping_fee,
          tax_amount,
          discount_amount,
          total_amount,
          currency,
          shipping_full_name,
          shipping_phone,
          shipping_address_line1,
          shipping_address_line2,
          shipping_city,
          shipping_state,
          shipping_postal_code,
          shipping_country,
          customer_note
       )
       VALUES (
          $1, $2, $3, $4, $5, $6, 'INR',
          $7, $8, $9, $10, $11, $12, $13, $14, $15
       )
       RETURNING
          id,
          order_reference,
          status,
          payment_status,
          total_amount,
          currency,
          created_at`,
      [
        req.user.id,
        formatMoney(subtotalPaise),
        formatMoney(shippingFeePaise),
        formatMoney(taxPaise),
        formatMoney(discountPaise),
        formatMoney(totalPaise),
        address.full_name,
        address.phone,
        address.address_line1,
        address.address_line2,
        address.city,
        address.state,
        address.postal_code,
        address.country,
        customerNote?.trim() || null,
      ]
    );

    const order = orderResult.rows[0];

    // ========================================
    // 7. CREATE ORDER ITEMS
    // ========================================

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO public.order_items (
            order_id,
            product_id,
            product_name,
            product_image_url,
            unit_price,
            quantity,
            line_total
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          item.productId,
          item.productName,
          item.productImageUrl,
          item.unitPrice,
          item.quantity,
          item.lineTotal,
        ]
      );
    }

    // ========================================
    // 8. DEDUCT PRODUCT STOCK
    // ========================================

    for (const item of normalizedItems) {
      const stockResult = await client.query(
        `UPDATE public.products
         SET stock = stock - $1
         WHERE id = $2
           AND stock >= $1
         RETURNING id`,
        [item.quantity, item.productId]
      );

      if (stockResult.rowCount !== 1) {
        const error = new Error(
          "Product stock changed. Please review your cart and try again."
        );
        error.status = 409;
        throw error;
      }
    }

    // ========================================
    // 9. COMMIT TRANSACTION
    // ========================================

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Your order has been placed successfully.",
      order: {
        ...order,
        items: orderItems,
      },
    });

  } catch (error) {
    // Undo all database changes if anything fails.
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Order rollback failed:", rollbackError.message);
      }

      transactionStarted = false;
    }

    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Order creation failed:", error.message);
    next(error);

  } finally {
    if (client) {
      client.release();
    }
  }
}

module.exports = {
  createOrder,
};
