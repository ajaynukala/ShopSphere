
import { useState } from "react";
import { supabase } from "../config/supabase";

function Register({ onBack }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleRegister(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: registrationError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
            },
          },
        });

      if (registrationError) {
        throw registrationError;
      }

      if (data.user && data.session) {
        setMessage("Registration successful! You are signed in.");
      } else {
        setMessage(
          "Registration successful! Please check your email to verify your account."
        );
      }

      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (registrationError) {
      setError(
        registrationError.message ||
          "Registration failed. Please try again."
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
        <p className="eyebrow">JOIN SHOPSPHERE</p>

        <h1>Create your account</h1>

        <p className="auth-description">
          Create an account to get started with ShopSphere.
        </p>

        <form onSubmit={handleRegister}>
          <div className="auth-field">
            <label htmlFor="register-name">Full name</label>
            <input
              id="register-name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter your full name"
              autoComplete="name"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">Email address</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Enter your password again"
              autoComplete="new-password"
              required
            />
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="auth-message" role="status">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="add-to-cart-button"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Register;
