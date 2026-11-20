import { Anchor } from "@mantine/core";
import { useTranslation } from "react-i18next";

/**
 * "Why?": shows or hides what a schedule's interval took into account. With a `label`, the
 * same kind of link for more depth on a schedule, such as its history.
 */
export function WhyToggle({
  shown,
  onToggle,
  label,
}: {
  shown: boolean;
  onToggle: (shown: boolean) => void;
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <Anchor
      component="button"
      type="button"
      size="sm"
      aria-expanded={shown}
      style={{ whiteSpace: "nowrap" }}
      onClick={() => {
        onToggle(!shown);
      }}
    >
      {label ?? t("schedules.why")}
    </Anchor>
  );
}
