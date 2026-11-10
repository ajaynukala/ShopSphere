
const supabase = require("../config/supabase");

async function authenticateCustomer(req, res, next) {
  try {
    // Read the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    // Extract the access token
    const accessToken = authHeader.substring(7).trim();

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    // Verify the token with Supabase Auth
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "Your session is invalid or expired. Please log in again.",
      });
    }

    // Attach verified customer information to the request
    req.user = {
      id: user.id,
      email: user.email,
    };

    // Continue to the protected route
    next();
  } catch (error) {
    console.error("Authentication error:", error.message);
    next(error);
  }
}

module.exports = authenticateCustomer;
