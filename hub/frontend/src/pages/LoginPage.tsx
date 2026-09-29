/**
 * Login page
 *
 * Handles both first-run setup (no users yet: create the owner account) and
 * regular sign-in. After signing in the user returns to the page they were
 * trying to open, or to their home area.
 */

import { useState, useEffect, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import { useAuthStore, type UserRole } from "@state/authStore";
import { getAuthStatus, login, register, type LoginResponse } from "@api";
import { errorMessage, fieldError } from "@utils/errors";
import { Alert, Button, Card, Field, Input, LoadingState } from "@components/ui";

type PageMode = "loading" | "login" | "setup";

const MIN_PASSWORD_LENGTH = 8;

/** Where to go after signing in: the page that required login, else the role-based home. */
function destinationAfterLogin(state: unknown): string {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from;
  if (from?.pathname && from.pathname !== "/login") return `${from.pathname}${from.search ?? ""}`;
  return "/";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, sessionExpired, setAuth } = useAuthStore();

  const [mode, setMode] = useState<PageMode>("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Sign in - Loom Hub";
  }, []);

  // First run: no users exist yet, so this instance still needs its owner account.
  useEffect(() => {
    let cancelled = false;
    getAuthStatus()
      .then((status) => !cancelled && setMode(status.initialized ? "login" : "setup"))
      // If the status check fails, fall back to sign-in; login errors will explain the rest.
      .catch(() => !cancelled && setMode("login"));
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAuthenticated) {
    return <Navigate to={destinationAfterLogin(location.state)} replace />;
  }

  const finish = (response: LoginResponse) => {
    setAuth(response.access_token, {
      id: response.user.id,
      username: response.user.username,
      role: response.user.role as UserRole,
    });
    navigate(destinationAfterLogin(location.state), { replace: true });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const isSetup = mode === "setup";
    if (isSetup) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setFieldErrors({ password: `Must be at least ${MIN_PASSWORD_LENGTH} characters` });
        return;
      }
      if (password !== confirmPassword) {
        setFieldErrors({ confirm: "Passwords do not match" });
        return;
      }
    }

    setSubmitting(true);
    try {
      finish(isSetup ? await register({ username, password }) : await login({ username, password }));
    } catch (err) {
      const next: Record<string, string> = {};
      for (const key of ["username", "password"]) {
        const message = fieldError(err, key);
        if (message) next[key] = message;
      }
      setFieldErrors(next);
      if (Object.keys(next).length === 0) {
        setError(errorMessage(err, isSetup ? "Setup failed" : "Login failed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-sunken">
        <LoadingState />
      </div>
    );
  }

  const isSetup = mode === "setup";
  const TitleIcon = isSetup ? UserPlus : LogIn;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-sunken px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/sigilweaver-logo.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-3xl font-bold text-ink">Loom Hub</h1>
          <p className="mt-2 text-ink-muted">
            {isSetup ? "Create the owner account to get started" : "Sign in to continue"}
          </p>
        </div>

        <Card className="shadow-sm sm:p-8">
          <h2 className="mb-6 flex items-center gap-3 text-xl font-semibold text-ink">
            <span className="rounded-lg bg-accent-soft p-2 text-accent-ink">
              <TitleIcon className="h-5 w-5" />
            </span>
            {isSetup ? "Initial setup" : "Sign in"}
          </h2>

          {sessionExpired && !error && (
            <Alert tone="warning" className="mb-4">
              Your session has expired. Please sign in again.
            </Alert>
          )}
          {error && <Alert className="mb-4">{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Username" error={fieldErrors.username}>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                autoComplete="username"
                autoFocus
                placeholder="Enter username"
              />
            </Field>

            <Field
              label="Password"
              error={fieldErrors.password}
              hint={isSetup ? `At least ${MIN_PASSWORD_LENGTH} characters` : undefined}
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isSetup ? MIN_PASSWORD_LENGTH : 1}
                autoComplete={isSetup ? "new-password" : "current-password"}
                placeholder={isSetup ? `Min ${MIN_PASSWORD_LENGTH} characters` : "Enter password"}
              />
            </Field>

            {isSetup && (
              <Field label="Confirm password" error={fieldErrors.confirm}>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Confirm password"
                />
              </Field>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              icon={<TitleIcon className="h-4 w-4" />}
              className="h-10 w-full"
            >
              {isSetup
                ? submitting
                  ? "Creating account..."
                  : "Create owner account"
                : submitting
                  ? "Signing in..."
                  : "Sign in"}
            </Button>
          </form>

          {isSetup && (
            <p className="mt-4 text-center text-xs text-ink-subtle">
              This account will have full owner privileges.
            </p>
          )}
        </Card>

        <p className="mt-6 text-center text-sm text-ink-subtle">
          Loom Hub - Workflow Orchestration Platform
        </p>
      </div>
    </main>
  );
}
