
import { useState } from "react";
import { supabase } from "../config/supabase";

function Login({ onBack, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      if (!data.user) {
        throw new Error("Unable to retrieve your account.");
      }

      onLoginSuccess(data.user);
    } catch (loginError) {
      setError(
        loginError.message ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page">
      <button
        type="button"
        className="back-button"
        onClick={onBack}
      >
        ← Back to shopping
      </button>

      <div className="auth-card">
        <p className="eyebrow">WELCOME BACK</p>

        <h1>Sign in to ShopSphere</h1>

        <p className="auth-description">
          Sign in to access your ShopSphere account.
        </p>

        <form onSubmit={handleLogin}>
          <div className="auth-field">
            <label htmlFor="login-email">
              Email address
            </label>

            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">
              Password
            </label>

            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="add-to-cart-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Login;
