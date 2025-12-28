/**
 * Socket ID constants for tool definitions.
 *
 * These MUST match the backend sockets.py exactly.
 * Any changes here require corresponding backend changes.
 */

export const CommonSockets = {
  INPUT: "input",
  OUTPUT: "output",
} as const;

export const FilterSockets = {
  INPUT: "input",
  OUTPUT_TRUE: "output-true",
  OUTPUT_FALSE: "output-false",
} as const;

export const JoinSockets = {
  INPUT_LEFT: "input-left",
  INPUT_RIGHT: "input-right",
  OUTPUT_LEFT: "output-left",
  OUTPUT_MATCH: "output-match",
  OUTPUT_RIGHT: "output-right",
} as const;

export const UnionSockets = {
  INPUT: "input",
  OUTPUT: "output",
} as const;

export const UniqueSockets = {
  INPUT: "input",
  OUTPUT_UNIQUE: "output-unique",
  OUTPUT_DUPLICATE: "output-duplicate",
} as const;

// Type exports for use in TypeScript
export type CommonSocketId = (typeof CommonSockets)[keyof typeof CommonSockets];
export type FilterSocketId = (typeof FilterSockets)[keyof typeof FilterSockets];
export type JoinSocketId = (typeof JoinSockets)[keyof typeof JoinSockets];
export type UnionSocketId = (typeof UnionSockets)[keyof typeof UnionSockets];
export type UniqueSocketId = (typeof UniqueSockets)[keyof typeof UniqueSockets];
