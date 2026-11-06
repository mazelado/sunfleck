import "@fontsource-variable/plus-jakarta-sans";

import {
  alpha,
  AppShell,
  createTheme,
  type CSSVariablesResolver,
  darken,
  defaultVariantColorsResolver,
  luminance,
  Menu,
  type MantineColorsTuple,
  Paper,
  Title,
} from "@mantine/core";

/**
 * Sunfleck's look (1.0, "crisp modern"): Plus Jakarta Sans, bundled with the app (no font
 * service is asked), a vivid green, white cards without borders on a soft grey-green page, and
 * section headings as small capitals. See docs/STYLE_GUIDE.md ("Look and feel").
 */
const FONT = '"Plus Jakarta Sans Variable", system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * Sunfleck's green. Filled buttons use shade 7 in light mode, with white text (5.0:1, WCAG AA),
 * and shade 4 in dark mode, with near-black text (8.8:1). Shade 6, the brightest, is for
 * graphics such as icons and progress, which need 3:1.
 */
const leaf: MantineColorsTuple = [
  "#e6f8ee",
  "#ccefdb",
  "#9fe2bd",
  "#6dd49c",
  "#2fd277",
  "#19b562",
  "#12a150",
  "#0c8040",
  "#0a6b36",
  "#07522a",
];

/**
 * Dark mode's greys, with a little green in them: 0 is text, 6 cards and fields, 7 the page.
 */
const dark: MantineColorsTuple = [
  "#eef3f0",
  "#c2ccc6",
  "#97a39d",
  "#6b7872",
  "#2c3730",
  "#232d27",
  "#151c18",
  "#0b100d",
  "#080c0a",
  "#050806",
];

export const theme = createTheme({
  colors: { leaf, dark },
  primaryColor: "leaf",
  primaryShade: { light: 7, dark: 4 },
  // Text on filled buttons and badges is black or white, whichever reads better on the colour.
  autoContrast: true,
  // Mantine picks that text colour from the light mode shade only: on dark mode's brighter
  // green, filled buttons in the primary colour take its contrast colour (set below).
  variantColorResolver: (input) => {
    const colors = defaultVariantColorsResolver(input);
    const primary = !input.color || input.color === input.theme.primaryColor;
    return input.variant === "filled" && primary
      ? { ...colors, color: "var(--mantine-primary-color-contrast)" }
      : colors;
  },
  fontFamily: FONT,
  fontFamilyMonospace: "ui-monospace, SFMono-Regular, Menlo, monospace",
  headings: {
    fontFamily: FONT,
    fontWeight: "800",
    sizes: {
      h1: { fontSize: "1.875rem", lineHeight: "1.15" },
      h2: { fontSize: "1.5rem", lineHeight: "1.2" },
      h3: { fontSize: "1.25rem", lineHeight: "1.25" },
      h4: { fontSize: "1.0625rem", lineHeight: "1.3" },
    },
  },
  radius: { xs: "4px", sm: "8px", md: "12px", lg: "18px", xl: "24px" },
  defaultRadius: "md",
  shadows: {
    xs: "0 1px 2px rgba(15, 26, 20, 0.05)",
    sm: "0 1px 3px rgba(15, 26, 20, 0.06), 0 1px 2px rgba(15, 26, 20, 0.04)",
    md: "0 4px 14px rgba(15, 26, 20, 0.08)",
  },
  components: {
    Menu: Menu.extend({
      defaultProps: {
        // Inside the page's landmarks (the header, the main content), not after them.
        withinPortal: false,
      },
    }),
    // The page is a soft grey-green; cards and fields stay white (or dark grey) on it.
    AppShell: AppShell.extend({
      classNames: { main: "sunfleck-page", header: "sunfleck-bar", footer: "sunfleck-bar" },
    }),
    // A page's cards are bordered Papers with large corners: in this look, they lose the
    // border and get a soft shadow instead. Smaller bordered Papers inside them keep theirs.
    Paper: Paper.extend({
      classNames: (_theme, props) => ({
        root: props.withBorder && props.radius === "lg" ? "sunfleck-card" : undefined,
      }),
    }),
    // Section and card headings (h2) are small capitals, with the page title (h1) above them.
    Title: Title.extend({
      classNames: { root: "sunfleck-title" },
    }),
  },
});

function contrast(a: string, b: string): number {
  const [light, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** The colour's darkest shade, darkened until it reads well on its palest tint. */
function lightVariantText(shades: MantineColorsTuple): string {
  let amount = 0.2;
  while (contrast(darken(shades[9], amount), shades[1]) < 4.6 && amount < 0.8) {
    amount += 0.05;
  }
  return darken(shades[9], amount);
}

/**
 * The page behind the cards, and colours changed for WCAG AA contrast (4.5:1 for text), which
 * some of Mantine's defaults miss:
 * - dimmed text: Mantine's is 3.3:1 on white and 3.5:1 on dark cards; these are at least
 *   5.1:1 (light) and 4.7:1 (dark) on every background they're used on;
 * - text in "light" badges and buttons (coloured text on a pale tint of it), e.g. green on
 *   pale green, 3.8:1, or orange on pale yellow, 2.4:1: darkened until it's at least 4.6:1.
 */
export const cssVariablesResolver: CSSVariablesResolver = (current) => ({
  variables: {},
  light: {
    "--mantine-color-dimmed": "#59655f",
    "--mantine-color-text": "#0f1a14",
    "--sunfleck-page": "#f2f4f3",
    "--sunfleck-bar": "rgba(242, 244, 243, 0.92)",
    "--sunfleck-card-shadow": current.shadows.sm,
    // Links a shade darker than buttons, so they read well on tinted alerts too (5.4:1).
    "--mantine-color-anchor": leaf[8],
    ...Object.fromEntries(
      Object.entries(current.colors).map(([name, shades]) => [
        `--mantine-color-${name}-light-color`,
        lightVariantText(shades),
      ]),
    ),
  },
  dark: {
    "--mantine-color-dimmed": "#97a39d",
    // The bright green of dark mode's filled buttons takes near-black text (8.8:1).
    "--mantine-primary-color-contrast": current.colors.dark[7],
    // Cards, dialogs and fields are a shade lighter than the page.
    "--mantine-color-body": current.colors.dark[6],
    "--sunfleck-page": current.colors.dark[7],
    "--sunfleck-bar": "rgba(11, 16, 13, 0.92)",
    "--sunfleck-card-shadow": "none",
    // Mantine's "light" variants are opaque, deep shades in dark mode (a brick-red alert for
    // a toxic plant): here a translucent tint of the colour, with its pale shade as text.
    ...Object.fromEntries(
      Object.entries(current.colors).flatMap(([name, shades]) => [
        [`--mantine-color-${name}-light`, alpha(shades[6], 0.16)],
        [`--mantine-color-${name}-light-hover`, alpha(shades[6], 0.24)],
        [`--mantine-color-${name}-light-color`, shades[3]],
      ]),
    ),
  },
});
