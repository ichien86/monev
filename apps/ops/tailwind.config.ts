import type { Config } from "tailwindcss";

/**
 * Token warna & tipografi disamakan dengan mockup (`simonev-boyolali-mockup-v10.2-data-riil.jsx`)
 * supaya implementasi nyata secara visual konsisten dengan yang sudah divalidasi Bapperida.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F6F7F4",
        surface: "#FFFFFF",
        primary: { DEFAULT: "#1F4B3F", deep: "#163529", tint: "#E6EEE9" },
        accent: { DEFAULT: "#C08A28", tint: "#FAF0DA" },
        ink: "#1C2321",
        muted: "#6B7570",
        faint: "#9BA39C",
        border: "#E3E6E0",
        success: { DEFAULT: "#2F7A4C", tint: "#E7F3EB" },
        danger: { DEFAULT: "#B23A2E", tint: "#FBEAE7" },
        info: { DEFAULT: "#4A6FA5", tint: "#EAF0F8" },
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
