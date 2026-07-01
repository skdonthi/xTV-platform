export interface ThemeTokens {
  id: string;
  colors: {
    background: string;
    text: string;
    accent: string;
  };
}

// CCL (Carnival) brand tokens — matches the "ccl-red" theme in the tenant config.
export const cclTheme: ThemeTokens = {
  id: "ccl-red",
  colors: {
    background: "#0a1a2f",
    text: "#f5f8fb",
    accent: "#e11b3c",
  },
};
