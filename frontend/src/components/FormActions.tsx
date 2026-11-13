import { Button, Group } from "@mantine/core";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

interface FormActionsProps {
  /** Whether saving is under way. */
  saving: boolean;
  /** Where Cancel goes; no Cancel without it. */
  cancelTo?: string;
  /** At the other end, e.g. a Delete button. */
  extra?: ReactNode;
  saveLabel?: string;
}

/**
 * A form's Save (and Cancel), kept in view at the bottom of the screen while the form is (above
 * the tab bar on phones), so nobody thinks they're done halfway down a long form. It belongs in
 * a card's form, as its last child: it spans the card's width and rounds its bottom corners.
 */
export function FormActions({ saving, cancelTo, extra, saveLabel }: FormActionsProps) {
  const { t } = useTranslation();
  return (
    <Group justify="space-between" gap="sm" className="sunfleck-form-actions">
      <Group gap="sm">
        <Button type="submit" loading={saving}>
          {saveLabel ?? t("common.save")}
        </Button>
        {cancelTo && (
          <Button component={Link} to={cancelTo} variant="default">
            {t("common.cancel")}
          </Button>
        )}
      </Group>
      {extra}
    </Group>
  );
}
