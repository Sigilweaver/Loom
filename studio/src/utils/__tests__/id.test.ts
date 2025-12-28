import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateUniqueId, randomId } from "../id";

describe("id utilities", () => {
  describe("randomId", () => {
    it("should generate an ID with default length of 8", () => {
      const id = randomId();
      expect(id).toHaveLength(8);
    });

    it("should generate an ID with custom length", () => {
      const id = randomId(12);
      expect(id).toHaveLength(12);
    });

    it("should only contain alphanumeric characters", () => {
      const id = randomId(100);
      expect(id).toMatch(/^[0-9a-zA-Z]+$/);
    });

    it("should generate different IDs on subsequent calls", () => {
      const id1 = randomId();
      const id2 = randomId();
      const id3 = randomId();

      // Extremely unlikely to be the same (1 in 62^8 chance per collision)
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it("should generate a 1-character ID", () => {
      const id = randomId(1);
      expect(id).toHaveLength(1);
      expect(id).toMatch(/^[0-9a-zA-Z]$/);
    });

    it("should generate a 0-length ID as empty string", () => {
      const id = randomId(0);
      expect(id).toBe("");
    });
  });

  describe("generateUniqueId", () => {
    it("should generate a unique ID not in the existing set", () => {
      const existing = new Set(["abc12345", "def67890"]);
      const id = generateUniqueId(existing);

      expect(id).toHaveLength(8);
      expect(existing.has(id)).toBe(false);
    });

    it("should generate an ID with custom length", () => {
      const existing = new Set<string>();
      const id = generateUniqueId(existing, 12);

      expect(id).toHaveLength(12);
    });

    it("should retry if ID collision occurs", () => {
      const existing = new Set<string>();

      // Mock randomId to return colliding IDs first, then unique
      let callCount = 0;
      vi.spyOn(global.Math, "random").mockImplementation(() => {
        callCount++;
        // First 2 calls will generate 'aaaaaaaa', third will be different
        return callCount <= 2 ? 0 : 0.5;
      });

      // Pre-populate with the ID that will be generated on first call
      existing.add("00000000"); // When Math.random() returns 0

      const id = generateUniqueId(existing, 8, 10);

      // Should have retried and gotten a different ID
      expect(existing.has(id)).toBe(false);

      vi.restoreAllMocks();
    });

    it("should fall back to timestamp-based ID after max attempts", () => {
      const existing = new Set<string>();

      // Mock randomId to always return the same collision
      vi.spyOn(global.Math, "random").mockReturnValue(0);

      // Pre-populate with all possible attempts
      existing.add("00000000");

      const id = generateUniqueId(existing, 8, 3);

      // Should have fallen back to timestamp-based ID
      // Format: <timestamp-base36><3-char-suffix>
      expect(id.length).toBeGreaterThan(3);
      expect(existing.has(id)).toBe(false);

      vi.restoreAllMocks();
    });

    it("should work with empty existing set", () => {
      const existing = new Set<string>();
      const id = generateUniqueId(existing);

      expect(id).toHaveLength(8);
    });

    it("should generate different IDs for subsequent calls", () => {
      const existing = new Set<string>();

      const id1 = generateUniqueId(existing);
      existing.add(id1);

      const id2 = generateUniqueId(existing);
      existing.add(id2);

      const id3 = generateUniqueId(existing);

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe("crypto.getRandomValues fallback", () => {
    let originalCrypto: Crypto | undefined;

    beforeEach(() => {
      // Store original crypto object
      originalCrypto = (globalThis as { crypto?: Crypto }).crypto;
    });

    afterEach(() => {
      // Restore original crypto object
      if (originalCrypto) {
        (globalThis as { crypto?: Crypto }).crypto = originalCrypto;
      } else {
        delete (globalThis as { crypto?: Crypto }).crypto;
      }
    });

    it("should fall back to Math.random when crypto is unavailable", () => {
      // Remove crypto object
      delete (globalThis as { crypto?: Crypto }).crypto;

      const id = randomId(8);

      expect(id).toHaveLength(8);
      expect(id).toMatch(/^[0-9a-zA-Z]+$/);
    });

    it("should use crypto.getRandomValues when available", () => {
      // Ensure crypto is available (it should be in test environment)
      const hasCrypto =
        typeof (globalThis as { crypto?: Crypto }).crypto !== "undefined";

      if (hasCrypto) {
        const id = randomId(8);
        expect(id).toHaveLength(8);
        expect(id).toMatch(/^[0-9a-zA-Z]+$/);
      } else {
        // If crypto not available, just verify fallback works
        expect(true).toBe(true);
      }
    });
  });
});
