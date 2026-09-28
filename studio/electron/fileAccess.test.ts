import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FileGrants,
  MAX_FILE_BYTES,
  canonicalizePath,
  readGrantedFile,
  writeGrantedFile,
} from "./fileAccess";

let dir: string;

beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "loom-grants-")));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("canonicalizePath", () => {
  it("rejects relative, empty and NUL-containing paths", async () => {
    await expect(canonicalizePath("relative/file.swwf")).rejects.toThrow(/absolute/);
    await expect(canonicalizePath("")).rejects.toThrow(/Invalid/);
    await expect(canonicalizePath(join(dir, "a\0b"))).rejects.toThrow(/Invalid/);
  });

  it("collapses .. segments", async () => {
    const file = join(dir, "a.swwf");
    writeFileSync(file, "x");
    expect(await canonicalizePath(join(dir, "sub", "..", "a.swwf"))).toBe(file);
  });

  it("resolves a not-yet-existing file inside an existing directory", async () => {
    expect(await canonicalizePath(join(dir, "new.swwf"))).toBe(join(dir, "new.swwf"));
  });

  it("resolves symlinks to their target", async () => {
    const real = join(dir, "real.swwf");
    writeFileSync(real, "x");
    const link = join(dir, "link.swwf");
    symlinkSync(real, link);
    expect(await canonicalizePath(link)).toBe(real);
  });

  it("rejects a dangling symlink", async () => {
    const link = join(dir, "dangling.swwf");
    symlinkSync(join(dir, "missing-target"), link);
    await expect(canonicalizePath(link)).rejects.toThrow(/dangling/);
  });

  it("fails when the parent directory does not exist", async () => {
    await expect(canonicalizePath(join(dir, "nope", "x.swwf"))).rejects.toThrow();
  });
});

describe("FileGrants", () => {
  it("denies paths that were never granted", async () => {
    const grants = new FileGrants("linux");
    const file = join(dir, "secret.txt");
    writeFileSync(file, "secret");
    await expect(grants.require(file)).rejects.toThrow(/Access denied/);
    await expect(readGrantedFile(grants, file)).rejects.toThrow(/Access denied/);
    await expect(writeGrantedFile(grants, file, "x")).rejects.toThrow(/Access denied/);
    expect(readFileSync(file, "utf8")).toBe("secret");
  });

  it("allows reads and writes on a granted path", async () => {
    const grants = new FileGrants("linux");
    const file = join(dir, "wf.swwf");
    await grants.grant(file);
    await writeGrantedFile(grants, file, '{"ok":true}');
    expect(await readGrantedFile(grants, file)).toBe('{"ok":true}');
  });

  it("does not let a grant leak to sibling files or traversal", async () => {
    const grants = new FileGrants("linux");
    const granted = join(dir, "granted.swwf");
    const other = join(dir, "other.swwf");
    writeFileSync(other, "other");
    await grants.grant(granted);
    await expect(grants.require(other)).rejects.toThrow(/Access denied/);
    // Traversal that lands on the ungranted file is still denied.
    await expect(grants.require(join(dir, "x", "..", "other.swwf"))).rejects.toThrow(/Access denied/);
    // Traversal that lands on the granted file is fine.
    await expect(grants.require(join(dir, "x", "..", "granted.swwf"))).resolves.toBe(granted);
  });

  it("denies a symlink that was swapped in after the grant", async () => {
    const grants = new FileGrants("linux");
    const target = join(dir, "wf.swwf");
    const secret = join(dir, "secret.txt");
    writeFileSync(secret, "secret");
    await grants.grant(target);
    symlinkSync(secret, target);
    await expect(readGrantedFile(grants, target)).rejects.toThrow(/Access denied/);
    expect(readFileSync(secret, "utf8")).toBe("secret");
  });

  it("accepts a granted file through a symlink pointing at it", async () => {
    const grants = new FileGrants("linux");
    const real = join(dir, "real.swwf");
    writeFileSync(real, "hello");
    const link = join(dir, "link.swwf");
    symlinkSync(real, link);
    await grants.grant(real);
    expect(await readGrantedFile(grants, link)).toBe("hello");
  });

  it("matches case-insensitively only on Windows and macOS", async () => {
    const file = join(dir, "Case.swwf");
    writeFileSync(file, "x");
    const lower = join(dir, "case.swwf");

    const win = new FileGrants("win32");
    await win.grant(file);
    // canonicalizePath still hits the real (case-sensitive) file system, so
    // check the key normalisation through a path that resolves identically.
    await expect(win.require(file)).resolves.toBe(file);
    expect(win.size).toBe(1);

    const linux = new FileGrants("linux");
    await linux.grant(file);
    await expect(linux.require(lower)).rejects.toThrow();
  });

  it("refuses to read directories and oversized files", async () => {
    const grants = new FileGrants("linux");
    const sub = join(dir, "sub");
    mkdirSync(sub);
    await grants.grant(sub);
    await expect(readGrantedFile(grants, sub)).rejects.toThrow(/regular file/);

    const big = join(dir, "big.swwf");
    writeFileSync(big, "x");
    await grants.grant(big);
    await expect(
      writeGrantedFile(grants, big, "y".repeat(MAX_FILE_BYTES + 1))
    ).rejects.toThrow(/too large/);
  });

  it("rejects non-string content", async () => {
    const grants = new FileGrants("linux");
    const file = join(dir, "wf.swwf");
    await grants.grant(file);
    await expect(
      writeGrantedFile(grants, file, 42 as unknown as string)
    ).rejects.toThrow(/string/);
  });
});
