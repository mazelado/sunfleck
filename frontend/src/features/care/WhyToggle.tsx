import { Anchor } from "@mantine/core";
import { useTranslation } from "react-i18next";

/** "Why?": shows or hides what a schedule's interval took into account. */
export function WhyToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: (shown: boolean) => void;
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
      {t("schedules.why")}
    </Anchor>
  );
}
