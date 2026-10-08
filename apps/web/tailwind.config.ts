import type { Config } from "tailwindcss";

/**
 * Identidade clara do Periscópio.
 * Tokens em português, derivados da logo. Textos usam as variações escuras
 * (roxo, ceu-700, comunidade-700) para manter contraste AA sobre fundo claro.
 * Aliases semânticos (background, foreground, card, primary...) preservam as
 * classes já usadas nas páginas públicas.
 */
const roxo = {
  50: "#F8F2FB",
  100: "#EFE3F4",
  200: "#E2CCEB",
  500: "#9556B0",
  DEFAULT: "#682880",
  800: "#52206A",
  900: "#3B1750",
};
const ceu = {
  50: "#F0F9FC",
  100: "#DDF0F6",
  300: "#A6D4E2",
  DEFAULT: "#60B0C8",
  700: "#1F7390",
  800: "#14566D",
};
const comunidade = {
  50: "#F2F7F7",
  100: "#E1ECEC",
  DEFAULT: "#609090",
  700: "#3D6B6B",
};
const ouro = {
  50: "#FEF8E8",
  100: "#FBF0D0",
  DEFAULT: "#E0A820",
  800: "#7A5A06",
};
// Paleta oficial da landing v2 (Guia de Identidade Visual).
const turquesa = { DEFAULT: "#26A8B8" };
const amarelo = { DEFAULT: "#F5B031" };
const empatia = { DEFAULT: "#823386", 800: "#68286B" };
const verde = { DEFAULT: "#5D8374" };
const grafite = { DEFAULT: "#000000" };
const tinta = { 900: "#000000", 700: "#000000", 500: "#262626" };

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        roxo,
        ceu,
        comunidade,
        ouro,
        tinta,
        turquesa,
        amarelo,
        empatia,
        verde,
        grafite,
        linha: "#E1E9ED",
        fundo: "#F6F9FB",
        sucesso: "#2F7D5B",
        erro: "#B42318",
        // aliases semânticos
        background: "#F6F9FB",
        foreground: "#000000",
        card: "#FFFFFF",
        border: "#E1E9ED",
        input: "#CBD6DC",
        ring: "#682880",
        "muted-foreground": "#262626",
        primary: { DEFAULT: "#682880", foreground: "#000000" },
        secondary: { DEFAULT: "#F0F9FC", foreground: "#000000" },
      },
      fontFamily: {
        display: ["Montserrat", "sans-serif"],
        sans: ["Public Sans", "system-ui", "sans-serif"],
      },
      borderRadius: { "2xl": "20px", "3xl": "28px" },
      boxShadow: {
        suave: "0 6px 18px -8px rgb(20 32 43 / .22)",
        flutua: "0 24px 60px -32px rgb(31 115 144 / .35)",
      },
    },
  },
  plugins: [],
};

export default config;
