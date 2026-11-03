
const pool = require("./db");

async function testConnection() {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time, version() AS database_version"
    );

    console.log("Connected to Supabase PostgreSQL!");
    console.log("Database time:", result.rows[0].current_time);
    console.log("Database version:", result.rows[0].database_version);
  } catch (error) {
    console.error("Database connection failed:", error.message);
  } finally {
    await pool.end();
  }
}

testConnection();

