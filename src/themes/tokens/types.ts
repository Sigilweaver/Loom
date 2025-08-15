// Minimal seed type for future user-configurable theming.
// Keep it simple for now; we won't wire this yet, just define the shape.
export interface UserThemeSeed {
  background: {
    primary: string;
    secondary: string;
    elevated?: string;
    overlay?: string; // allow rgba string
  };
  accent: {
    primary: string;
    secondary: string;
  };
  text: {
    primary: string;
    secondary: string;
    inverse: string;
  };
  border: {
    primary: string;
  };
  focus: {
    ring: string;
  };
  semantic: {
    success: string;
    warning: string;
    error: string;
    info?: string;
  };
}
