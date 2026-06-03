/**
 * Design tokens reference.
 * Runtime values live in app/globals.css as CSS variables.
 */
export const designSystem = {
  colors: {
    sidebar: "#3B4A7D",
    accent: "#FF7A59",
    canvas: "#F3F4F9",
    surface: "#FFFFFF",
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
  },
  spacing: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    6: "24px",
    8: "32px",
  },
  layout: {
    sidebarWidth: "260px",
    headerHeight: "72px",
  },
} as const;
