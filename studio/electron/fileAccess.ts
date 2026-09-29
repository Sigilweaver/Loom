/**
 * File access grants for the Electron main process.
 *
 * The renderer is untrusted: a compromised page must not be able to read or
 * write arbitrary files. Instead of accepting any path over IPC, the main
 * process only honours paths the user picked in a native open/save dialog
 * during this session ("grants"). Paths are canonicalised (absolute, `..`
 * collapsed, symlinks resolved) both when granted and when used, so a symlink
 * swapped in after the dialog cannot redirect an operation to another file.
 *
 * Grants live in main-process memory only. They are never persisted and the
 * renderer cannot create them except by completing a native dialog.
 */

import { promises as fs } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

/** Upper bound for a single workflow read or write (bytes). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Resolve `.`/`..` and symlinks. The final component may not exist yet. */
export async function canonicalizePath(input: string): Promise<string> {
  if (typeof input !== "string" || input.length === 0 || input.includes("\0")) {
    throw new Error("Invalid file path");
  }
  if (!isAbsolute(input)) {
    throw new Error("File path must be absolute");
  }
  const full = resolve(input);
  try {
    return await fs.realpath(full);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Not there yet (save dialog for a new file): canonicalise the directory
  // and re-attach the file name. A dangling symlink is rejected because
  // writing through it would create a file elsewhere.
  try {
    const entry = await fs.lstat(full);
    if (entry.isSymbolicLink()) {
      throw new Error("Refusing to follow a dangling symbolic link");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const parent = await fs.realpath(dirname(full));
  return join(parent, basename(full));
}

/** Case-insensitive file systems are the default on Windows and macOS. */
function grantKey(canonical: string, platform: NodeJS.Platform): string {
  return platform === "win32" || platform === "darwin"
    ? canonical.toLowerCase()
    : canonical;
}

export class FileGrants {
  private readonly granted = new Set<string>();

  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  /** Record a path the user just chose in a native dialog. */
  async grant(path: string): Promise<string> {
    const canonical = await canonicalizePath(path);
    this.granted.add(grantKey(canonical, this.platform));
    return canonical;
  }

  /** Return the canonical path if it was granted, otherwise throw. */
  async require(path: string): Promise<string> {
    const canonical = await canonicalizePath(path);
    if (!this.granted.has(grantKey(canonical, this.platform))) {
      throw new Error(
        "Access denied: the file was not selected through an open or save dialog"
      );
    }
    return canonical;
  }

  get size(): number {
    return this.granted.size;
  }
}

/** Read a granted file as UTF-8 text, refusing oversized files. */
export async function readGrantedFile(
  grants: FileGrants,
  path: string
): Promise<string> {
  const canonical = await grants.require(path);
  const info = await fs.stat(canonical);
  if (!info.isFile()) {
    throw new Error("Not a regular file");
  }
  if (info.size > MAX_FILE_BYTES) {
    throw new Error("File is too large to open");
  }
  return fs.readFile(canonical, "utf8");
}

/** Write UTF-8 text to a granted file. */
export async function writeGrantedFile(
  grants: FileGrants,
  path: string,
  content: string
): Promise<string> {
  if (typeof content !== "string") {
    throw new Error("File content must be a string");
  }
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw new Error("Content is too large to save");
  }
  const canonical = await grants.require(path);
  await fs.writeFile(canonical, content, "utf8");
  return canonical;
}
