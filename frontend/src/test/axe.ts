import axe from "axe-core";

/**
 * Accessibility problems axe finds on the page, e.g. a button without a name or a missing
 * landmark. Colour contrast can't be measured here (jsdom doesn't render), so it's checked in
 * a real browser instead (see docs/development.md).
 */
export async function accessibilityProblems(root: Element = document.body): Promise<string[]> {
  const result = await axe.run(root, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} (${violation.help})`),
  );
}
