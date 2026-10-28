import {
  createTheme,
  type CSSVariablesResolver,
  darken,
  luminance,
  Menu,
  type MantineColorsTuple,
} from "@mantine/core";

/**
 * Sunfleck's green: Mantine's green, with darker top shades so white text on filled buttons
 * meets WCAG AA contrast (4.6:1 for shade 8; Mantine's default green-6 is only 2.4:1).
 */
const leaf: MantineColorsTuple = [
  "#ebfbee",
  "#d3f9d8",
  "#b2f2bb",
  "#8ce99a",
  "#69db7c",
  "#51cf66",
  "#40c057",
  "#37b24d",
  "#2a8540",
  "#226b34",
];

export const theme = createTheme({
  colors: { leaf },
  primaryColor: "leaf",
  primaryShade: 8,
  defaultRadius: "md",
  components: {
    Menu: Menu.extend({
      defaultProps: {
        // Inside the page's landmarks (the header, the main content), not after them.
        withinPortal: false,
      },
    }),
  },
});

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
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
 * Colours changed for WCAG AA contrast (4.5:1 for text), which some of Mantine's defaults miss:
 * - dimmed text: Mantine's is 3.3:1 on white and 3.5:1 on dark cards; these are at least
 *   5.2:1 (light) and 4.7:1 (dark) on every background they're used on;
 * - text in "light" badges and buttons (coloured text on a pale tint of it), e.g. green on
 *   pale green, 3.8:1, or orange on pale yellow, 2.4:1: darkened until it's at least 4.6:1.
 */
export const cssVariablesResolver: CSSVariablesResolver = (current) => ({
  variables: {},
  light: {
    "--mantine-color-dimmed": "#5f6770",
    ...Object.fromEntries(
      Object.entries(current.colors).map(([name, shades]) => [
        `--mantine-color-${name}-light-color`,
        lightVariantText(shades),
      ]),
    ),
  },
  dark: { "--mantine-color-dimmed": "#a8a8a8" },
});
