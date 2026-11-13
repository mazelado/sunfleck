import { Skeleton, Stack } from "@mantine/core";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * A page's shape while it loads, in place of a spinner, so the page doesn't jump when it
 * arrives. Announced once as "Loading…"; the shapes themselves are hidden from screen readers.
 */
export function SkeletonPage({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Stack gap="lg" role="status" aria-label={t("common.loading")} aria-busy>
      {/* The title. */}
      <Skeleton h={36} w="45%" radius="md" aria-hidden />
      <div aria-hidden>{children}</div>
    </Stack>
  );
}
