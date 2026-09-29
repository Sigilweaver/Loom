/** Hub health. */

import { request } from "./http";

export function getHealth(): Promise<{ status: string; version: string }> {
  return request("/health", { auth: false });
}
