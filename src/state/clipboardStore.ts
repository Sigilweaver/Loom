// In-memory clipboard store for canvas operations
// XML-first clipboard payload is a string fragment; legacy clipboard stores structured data

export type LegacyClipboard = {
  tools: { id: string; type: string; x: number; y: number }[];
  wires: {
    from: { tool: string; socket: number };
    to: { tool: string; socket: number };
  }[];
  minX: number;
  minY: number;
};

let xmlClipboard: string = "";
let legacyClipboard: LegacyClipboard | undefined;

export const getXMLClipboard = () => xmlClipboard;
export const setXMLClipboard = (value: string) => {
  xmlClipboard = value;
};

export const getLegacyClipboard = () => legacyClipboard;
export const setLegacyClipboard = (value: LegacyClipboard | undefined) => {
  legacyClipboard = value;
};
