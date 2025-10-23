import { beforeEach, describe, expect, it } from "vitest";
import { HistoryManager } from "../HistoryManager";

describe("HistoryManager", () => {
  let manager: HistoryManager;

  beforeEach(() => {
    manager = new HistoryManager();
  });

  describe("initialization", () => {
    it("should create an empty manager", () => {
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
      expect(manager.size()).toEqual({ undo: 0, redo: 0 });
    });

    it("should initialize with initial workflow and label", () => {
      const mgr = new HistoryManager("<initial/>", "Start");

      expect(mgr.canUndo()).toBe(true);
      expect(mgr.size()).toEqual({ undo: 1, redo: 0 });
    });

    it("should initialize with initial workflow without label", () => {
      const mgr = new HistoryManager("<initial/>");

      expect(mgr.canUndo()).toBe(true);
      expect(mgr.size()).toEqual({ undo: 1, redo: 0 });
    });
  });

  describe("checkpoint", () => {
    it("should add a checkpoint to undo stack", () => {
      manager.checkpoint("<state1/>", "First checkpoint");

      expect(manager.canUndo()).toBe(true);
      expect(manager.size()).toEqual({ undo: 1, redo: 0 });
    });

    it("should clear redo stack on checkpoint", () => {
      manager.checkpoint("<state1/>");
      manager.checkpoint("<state2/>");

      const undone = manager.undo("<state2/>");
      expect(undone?.workflow).toBe("<state2/>");
      expect(manager.canRedo()).toBe(true);

      // New checkpoint should clear redo
      manager.checkpoint("<state3/>");
      expect(manager.canRedo()).toBe(false);
    });

    it("should add checkpoint without label", () => {
      manager.checkpoint("<state1/>");

      const undone = manager.undo("<current/>");
      expect(undone?.workflow).toBe("<state1/>");
      expect(undone?.label).toBeUndefined();
    });

    it("should add checkpoint with label", () => {
      manager.checkpoint("<state1/>", "MyLabel");

      const undone = manager.undo("<current/>");
      expect(undone?.label).toBe("MyLabel");
    });

    it("should add timestamp to checkpoint", () => {
      const before = Date.now();
      manager.checkpoint("<state1/>");
      const after = Date.now();

      const undone = manager.undo("<current/>");
      expect(undone?.ts).toBeGreaterThanOrEqual(before);
      expect(undone?.ts).toBeLessThanOrEqual(after);
    });
  });

  describe("begin/commit transaction", () => {
    it("should begin and commit a transaction", () => {
      manager.begin("<state1/>", "Before change");
      manager.commit("<state2/>", { label: "After change" });

      expect(manager.canUndo()).toBe(true);
      expect(manager.size()).toEqual({ undo: 1, redo: 0 });
    });

    it("should save the pre-change state on commit", () => {
      manager.begin("<original/>");
      manager.commit("<modified/>");

      const undone = manager.undo("<modified/>");
      expect(undone?.workflow).toBe("<original/>");
    });

    it("should clear redo stack on begin", () => {
      manager.checkpoint("<state1/>");
      manager.checkpoint("<state2/>");
      manager.undo("<state2/>"); // Creates redo entry

      expect(manager.canRedo()).toBe(true);

      manager.begin("<state3/>");
      expect(manager.canRedo()).toBe(false);
    });

    it("should handle commit without begin as checkpoint", () => {
      manager.commit("<state1/>", { label: "Direct commit" });

      expect(manager.canUndo()).toBe(true);
      const undone = manager.undo("<current/>");
      expect(undone?.workflow).toBe("<state1/>");
      expect(undone?.label).toBe("Direct commit");
    });

    it("should handle multiple begin/commit cycles", () => {
      manager.begin("<state1/>");
      manager.commit("<state2/>");

      manager.begin("<state2/>");
      manager.commit("<state3/>");

      expect(manager.size()).toEqual({ undo: 2, redo: 0 });

      const undo1 = manager.undo("<state3/>");
      expect(undo1?.workflow).toBe("<state2/>");

      const undo2 = manager.undo("<state2/>");
      expect(undo2?.workflow).toBe("<state1/>");
    });

    it("should preserve label from begin in committed entry", () => {
      manager.begin("<original/>", "Pre-modification");
      manager.commit("<modified/>");

      const undone = manager.undo("<modified/>");
      expect(undone?.label).toBe("Pre-modification");
    });

    it("should add timestamp to begin entry", () => {
      const before = Date.now();
      manager.begin("<state/>");
      manager.commit("<newstate/>");
      const after = Date.now();

      const undone = manager.undo("<newstate/>");
      expect(undone?.ts).toBeGreaterThanOrEqual(before);
      expect(undone?.ts).toBeLessThanOrEqual(after);
    });
  });

  describe("undo", () => {
    it("should return null when nothing to undo", () => {
      const result = manager.undo("<current/>");
      expect(result).toBeNull();
    });

    it("should undo to previous checkpoint", () => {
      manager.checkpoint("<state1/>");
      manager.checkpoint("<state2/>");

      const undone = manager.undo("<state2/>");
      expect(undone?.workflow).toBe("<state2/>");
    });

    it("should add current state to redo stack", () => {
      manager.checkpoint("<state1/>");

      expect(manager.canRedo()).toBe(false);
      manager.undo("<current/>");
      expect(manager.canRedo()).toBe(true);
    });

    it("should cancel pending transaction on undo", () => {
      manager.begin("<state1/>");

      manager.checkpoint("<state2/>");
      manager.undo("<state2/>"); // Pops state2 from undo stack, undo stack now empty

      // After undo, pendingBegin is cancelled, so commit acts as checkpoint
      manager.commit("<state3/>");
      expect(manager.size().undo).toBe(1); // Just state3 from commit-as-checkpoint
    });

    it("should handle multiple undos", () => {
      manager.checkpoint("<state1/>");
      manager.checkpoint("<state2/>");
      manager.checkpoint("<state3/>");

      const undo1 = manager.undo("<state3/>");
      expect(undo1?.workflow).toBe("<state3/>");

      const undo2 = manager.undo("<state3/>");
      expect(undo2?.workflow).toBe("<state2/>");

      const undo3 = manager.undo("<state2/>");
      expect(undo3?.workflow).toBe("<state1/>");

      expect(manager.canUndo()).toBe(false);
    });

    it("should preserve entry properties on undo", () => {
      manager.checkpoint("<state1/>", "TestLabel");

      const undone = manager.undo("<current/>");
      expect(undone?.workflow).toBe("<state1/>");
      expect(undone?.label).toBe("TestLabel");
      expect(undone?.ts).toBeDefined();
    });
  });

  describe("redo", () => {
    it("should return null when nothing to redo", () => {
      const result = manager.redo("<current/>");
      expect(result).toBeNull();
    });

    it("should redo after undo", () => {
      manager.checkpoint("<state1/>");
      manager.checkpoint("<state2/>");

      manager.undo("<state2/>");
      const redone = manager.redo("<state1/>");

      expect(redone?.workflow).toBe("<state2/>");
    });

    it("should add current state to undo stack on redo", () => {
      manager.checkpoint("<state1/>");
      manager.undo("<state1/>");

      expect(manager.size().undo).toBe(0);
      manager.redo("<current/>");
      expect(manager.size().undo).toBe(1);
    });

    it("should cancel pending transaction on redo", () => {
      manager.checkpoint("<state1/>");
      manager.begin("<state2/>");

      manager.undo("<state1/>");
      manager.redo("<initial/>");

      // Transaction should be cancelled
      manager.commit("<state3/>");
      expect(manager.size().undo).toBe(2); // state1 from redo + state3 from commit-as-checkpoint
    });

    it("should handle multiple redos", () => {
      manager.checkpoint("<state1/>");
      manager.checkpoint("<state2/>");
      manager.checkpoint("<state3/>");

      manager.undo("<state3/>");
      manager.undo("<state3/>");
      manager.undo("<state2/>");

      const redo1 = manager.redo("<state1/>");
      expect(redo1?.workflow).toBe("<state2/>");

      const redo2 = manager.redo("<state1/>");
      expect(redo2?.workflow).toBe("<state3/>");

      const redo3 = manager.redo("<state2/>");
      expect(redo3?.workflow).toBe("<state3/>");
    });

    it("should preserve timestamp on redo", () => {
      manager.checkpoint("<state1/>");
      manager.undo("<state1/>");

      const redone = manager.redo("<current/>");
      expect(redone?.ts).toBeDefined();
      expect(typeof redone?.ts).toBe("number");
    });
  });

  describe("canUndo and canRedo", () => {
    it("should reflect undo availability", () => {
      expect(manager.canUndo()).toBe(false);

      manager.checkpoint("<state1/>");
      expect(manager.canUndo()).toBe(true);

      manager.undo("<state1/>");
      expect(manager.canUndo()).toBe(false);
    });

    it("should reflect redo availability", () => {
      manager.checkpoint("<state1/>");

      expect(manager.canRedo()).toBe(false);

      manager.undo("<state1/>");
      expect(manager.canRedo()).toBe(true);

      manager.redo("<current/>");
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear all stacks", () => {
      manager.checkpoint("<state1/>");
      manager.checkpoint("<state2/>");
      manager.undo("<state2/>");

      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(true);

      manager.clear();

      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
      expect(manager.size()).toEqual({ undo: 0, redo: 0 });
    });

    it("should clear pending transaction", () => {
      manager.begin("<state1/>");
      manager.clear();

      // Commit after clear should act as checkpoint
      manager.commit("<state2/>");
      expect(manager.size().undo).toBe(1);
    });

    it("should allow new operations after clear", () => {
      manager.checkpoint("<state1/>");
      manager.clear();

      manager.checkpoint("<state2/>");
      expect(manager.canUndo()).toBe(true);
      expect(manager.size().undo).toBe(1);
    });
  });

  describe("size", () => {
    it("should return correct stack sizes", () => {
      expect(manager.size()).toEqual({ undo: 0, redo: 0 });

      manager.checkpoint("<state1/>");
      expect(manager.size()).toEqual({ undo: 1, redo: 0 });

      manager.checkpoint("<state2/>");
      expect(manager.size()).toEqual({ undo: 2, redo: 0 });

      manager.undo("<state2/>");
      expect(manager.size()).toEqual({ undo: 1, redo: 1 });

      manager.undo("<state2/>");
      expect(manager.size()).toEqual({ undo: 0, redo: 2 });
    });
  });

  describe("complex scenarios", () => {
    it("should handle undo/redo/checkpoint sequence", () => {
      manager.checkpoint("<state1/>");
      manager.checkpoint("<state2/>");
      manager.undo("<state2/>"); // Redo stack now has state2

      // New checkpoint should clear redo
      manager.checkpoint("<state3/>");

      expect(manager.canRedo()).toBe(false);
      expect(manager.size()).toEqual({ undo: 2, redo: 0 });
    });

    it("should handle transaction interrupted by undo", () => {
      manager.checkpoint("<state1/>");
      manager.begin("<state2/>");

      // Undo before commit
      manager.undo("<state2/>");

      // Transaction should be cancelled, commit acts as checkpoint
      manager.commit("<state3/>");

      const undone = manager.undo("<state3/>");
      expect(undone?.workflow).toBe("<state3/>"); // The checkpoint, not the cancelled transaction
    });

    it("should handle long undo/redo chain", () => {
      const states: string[] = [];
      for (let i = 0; i < 10; i++) {
        const state = `<state${i}/>`;
        states.push(state);
        manager.checkpoint(state);
      }

      expect(manager.size().undo).toBe(10);

      // Undo 5 times
      for (let i = 0; i < 5; i++) {
        manager.undo("<current/>");
      }

      expect(manager.size()).toEqual({ undo: 5, redo: 5 });

      // Redo 3 times
      for (let i = 0; i < 3; i++) {
        manager.redo("<current/>");
      }

      expect(manager.size()).toEqual({ undo: 8, redo: 2 });
    });

    it("should handle alternating transactions and checkpoints", () => {
      manager.begin("<state1/>");
      manager.commit("<state2/>");

      manager.checkpoint("<state3/>");

      manager.begin("<state3/>");
      manager.commit("<state4/>");

      expect(manager.size().undo).toBe(3);

      manager.undo("<state4/>");
      manager.undo("<state4/>");
      manager.undo("<state3/>");

      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty workflow strings", () => {
      manager.checkpoint("");
      const undone = manager.undo("");
      expect(undone?.workflow).toBe("");
    });

    it("should handle very long workflow strings", () => {
      const longXml = "<root>" + "x".repeat(10000) + "</root>";
      manager.checkpoint(longXml);

      const undone = manager.undo("<current/>");
      expect(undone?.workflow).toBe(longXml);
    });

    it("should handle special characters in workflow", () => {
      const specialXml = "<root>&lt;&gt;&amp;&quot;&apos;</root>";
      manager.checkpoint(specialXml);

      const undone = manager.undo("<current/>");
      expect(undone?.workflow).toBe(specialXml);
    });

    it("should handle rapid successive operations", () => {
      for (let i = 0; i < 100; i++) {
        manager.checkpoint(`<state${i}/>`);
      }

      expect(manager.size().undo).toBe(100);

      for (let i = 0; i < 50; i++) {
        manager.undo("<current/>");
      }

      expect(manager.size()).toEqual({ undo: 50, redo: 50 });
    });
  });
});
