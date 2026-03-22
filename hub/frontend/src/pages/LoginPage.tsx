/**
 * Login page component
 *
 * Handles both initial setup (first user registration) and login.
 * On first run (no users exist), shows registration form.
 * Otherwise, shows login form.
 */

import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Loader2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@state/authStore";
import { getAuthStatus, login, register } from "@api/client";
import type { UserRole } from "@state/authStore";

type PageMode = "loading" | "login" | "setup";

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, setAuth } = useAuthStore();

  // Page state
  const [mode, setMode] = useState<PageMode>("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/workflows", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Check if this is first-time setup
  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await getAuthStatus();
        setMode(status.initialized ? "login" : "setup");
      } catch {
        // Default to login if we can't check status
        setMode("login");
      }
    }
    checkStatus();
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await login({ username, password });
      setAuth(response.access_token, {
        id: response.user.id,
        username: response.user.username,
        role: response.user.role as UserRole,
      });
      navigate("/workflows", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await register({ username, password });
      setAuth(response.access_token, {
        id: response.user.id,
        username: response.user.username,
        role: response.user.role as UserRole,
      });
      navigate("/workflows", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sigilweaver Loom Hub</h1>
          <p className="mt-2 text-gray-600">
            {mode === "setup"
              ? "Create your admin account to get started"
              : "Sign in to continue"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
          {/* Title */}
          <div className="flex items-center gap-3 mb-6">
            {mode === "setup" ? (
              <>
                <div className="p-2 rounded-lg bg-brand-100">
                  <UserPlus className="h-5 w-5 text-brand-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Initial Setup
                </h2>
              </>
            ) : (
              <>
                <div className="p-2 rounded-lg bg-brand-100">
                  <LogIn className="h-5 w-5 text-brand-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Sign In</h2>
              </>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={mode === "setup" ? handleSetup : handleLogin}>
            {/* Username */}
            <div className="mb-4">
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                autoComplete="username"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Enter username"
              />
            </div>

            {/* Password */}
            <div className="mb-4">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "setup" ? 8 : 1}
                autoComplete={mode === "setup" ? "new-password" : "current-password"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder={mode === "setup" ? "Min 8 characters" : "Enter password"}
              />
            </div>

            {/* Confirm Password (setup only) */}
            {mode === "setup" && (
              <div className="mb-6">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Confirm password"
                />
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "setup" ? "Creating account..." : "Signing in..."}
                </>
              ) : mode === "setup" ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create Admin Account
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Setup notice */}
          {mode === "setup" && (
            <p className="mt-4 text-xs text-gray-500 text-center">
              This account will have full owner privileges.
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Sigilweaver Loom Hub - Workflow Orchestration Platform
        </p>
      </div>
    </div>
  );
}
