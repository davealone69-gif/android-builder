/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#0a0a0a',
    tint: '#2f95dc',

    // Core surfaces
    background: '#0B1223',
    foreground: '#F3F6FF',

    // Cards / elevated surfaces
    card: '#131F38',
    cardForeground: '#F3F6FF',

    // Primary action color (buttons, links, active states)
    primary: '#9BFFB5',
    primaryForeground: '#0B1223',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#203252',
    secondaryForeground: '#DCE6FF',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#172642',
    mutedForeground: '#93A3C5',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#1D3B68',
    accentForeground: '#CFE0FF',

    // Destructive actions (delete, error states)
    destructive: '#FF7D85',
    destructiveForeground: '#220A13',

    // Borders and input outlines
    border: '#294163',
    input: '#294163',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
