import { ApiError } from "@api/http";

/**
 * Turn any thrown value into a message that is safe and useful to show users.
 *
 * - 401: the session ended (the route guard also sends the user to login)
 * - 403: names the missing permission, with the server's reason when it gave one
 * - 409 / 422: the server's message, which describes the conflict or bad field
 * - 5xx without a reason: a generic "unexpected error" instead of raw HTTP text
 * - network failures: the message ApiError already carries
 */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiError) {
    const reason = typeof error.detail === "string" && error.detail ? error.detail : null;

    if (error.isUnauthorized) return "Your session has expired. Please sign in again.";
    if (error.isForbidden) {
      return reason
        ? `You do not have permission to do this. ${reason}`
        : "You do not have permission to do this.";
    }
    if (error.status >= 500 && !reason) {
      return "The Hub hit an unexpected error. Try again, and check the Hub logs if it keeps happening.";
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Field-level message for a form input from a validation (422) error, if any. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.fieldErrors[field] : undefined;
}
