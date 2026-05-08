export interface ThemeTokens {
  id: string;
  colors: {
    background: string;
    text: string;
    accent: string;
  };
}

export const demoHotelTheme: ThemeTokens = {
  id: "demo-hotel-dark",
  colors: {
    background: "#07131f",
    text: "#f5f8fb",
    accent: "#49c6e5",
  },
};
