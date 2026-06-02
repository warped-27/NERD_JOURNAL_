export const Palette = {
  light: {
    background: '#f9f9fb',      // Avorio morbido (Sfondo principale)
    surface: '#ffffff',         // Bianco puro (Card, Sidebar)
    textPrimary: '#18181b',     // Zinc-900 (Massimo contrasto per caratteri semplici)
    textSecondary: '#71717a',   // Zinc-500 (Riassunti, tag desaturati)
    border: '#e4e4e7',          // Zinc-200 (Bordi finissimi)
    accentPastel: '#e8f5e9',    // Salvia chiarissimo per elementi IA
  },
  dark: {
    background: '#0c0d12',      // Deep Charcoal NotebookLM (Sfondo principale scuro)
    surface: '#16171f',         // Antracite morbido (Card, Sidebar)
    textPrimary: '#f4f4f5',     // Zinc-100 (Massimo contrasto bianco morbido)
    textSecondary: '#a1a1aa',   // Zinc-400 (Riassunti, tag desaturati)
    border: '#27272a',          // Zinc-800 (Bordi scuri discreti)
    accentPastel: '#1b2e24',    // Salvia scuro desaturato per elementi IA
  }
};

// Esportazione di default per mantenere la retrocompatibilità con i componenti Themed e i layout generati da Expo Router
const Colors = {
  light: {
    text: Palette.light.textPrimary,
    background: Palette.light.background,
    tint: Palette.light.textPrimary, // Massimo contrasto per gli elementi attivi
    tabIconDefault: Palette.light.textSecondary,
    tabIconSelected: Palette.light.textPrimary,
  },
  dark: {
    text: Palette.dark.textPrimary,
    background: Palette.dark.background,
    tint: Palette.dark.textPrimary, // Massimo contrasto per gli elementi attivi
    tabIconDefault: Palette.dark.textSecondary,
    tabIconSelected: Palette.dark.textPrimary,
  },
};

export default Colors;