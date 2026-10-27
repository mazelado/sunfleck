import { createTheme, type MantineColorsTuple } from "@mantine/core";

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
});
