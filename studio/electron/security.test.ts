import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { DEV_SERVER_ORIGIN, isAppUrl, isSafeExternalUrl, PRODUCTION_CSP } from "./security";

describe("isSafeExternalUrl", () => {
  it("allows web and mail links", () => {
    expect(isSafeExternalUrl("https://docs.pola.rs/api")).toBe(true);
    expect(isSafeExternalUrl("http://example.com")).toBe(true);
    expect(isSafeExternalUrl("mailto:someone@example.com")).toBe(true);
  });

  it("blocks schemes that can run code or leak files", () => {
    expect(isSafeExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeExternalUrl("smb://host/share")).toBe(false);
    expect(isSafeExternalUrl("ms-msdt:/id PCWDiagnostic")).toBe(false);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,<script>1</script>")).toBe(false);
  });

  it("blocks garbage", () => {
    expect(isSafeExternalUrl("")).toBe(false);
    expect(isSafeExternalUrl("not a url")).toBe(false);
  });
});

describe("isAppUrl", () => {
  const distDir = "/opt/app/dist";
  const dev = { isDev: true, distDir };
  const prod = { isDev: false, distDir };

  it("accepts only the dev server origin in development", () => {
    expect(isAppUrl(`${DEV_SERVER_ORIGIN}/`, dev)).toBe(true);
    expect(isAppUrl(`${DEV_SERVER_ORIGIN}/some/route?x=1`, dev)).toBe(true);
    expect(isAppUrl("http://localhost:25811/", dev)).toBe(false);
    expect(isAppUrl("http://localhost:25810.evil.com/", dev)).toBe(false);
    expect(isAppUrl("https://example.com/", dev)).toBe(false);
    expect(isAppUrl(pathToFileURL("/opt/app/dist/index.html").href, dev)).toBe(false);
  });

  it("accepts only files inside the built renderer in production", () => {
    expect(isAppUrl(pathToFileURL("/opt/app/dist/index.html").href, prod)).toBe(true);
    expect(isAppUrl(pathToFileURL("/opt/app/dist/assets/a.js").href, prod)).toBe(true);
    expect(isAppUrl(pathToFileURL("/opt/app/dist-electron/main.js").href, prod)).toBe(false);
    expect(isAppUrl(pathToFileURL("/opt/app/distillery/index.html").href, prod)).toBe(false);
    expect(isAppUrl(pathToFileURL("/etc/passwd").href, prod)).toBe(false);
    expect(isAppUrl(`${DEV_SERVER_ORIGIN}/`, prod)).toBe(false);
    expect(isAppUrl("https://example.com/", prod)).toBe(false);
  });

  it("rejects unparsable input", () => {
    expect(isAppUrl("", prod)).toBe(false);
    expect(isAppUrl("::", dev)).toBe(false);
  });
});

describe("PRODUCTION_CSP", () => {
  it("forbids plugins, framing and inline scripts", () => {
    expect(PRODUCTION_CSP).toContain("object-src 'none'");
    expect(PRODUCTION_CSP).toContain("frame-src 'none'");
    expect(PRODUCTION_CSP).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(PRODUCTION_CSP).not.toMatch(/script-src[^;]*'unsafe-eval'/);
  });
});
