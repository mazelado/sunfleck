import { Anchor } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { AuthCard } from "../../components/AuthCard";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <AuthCard title={t("notFound.title")}>
      <Anchor component={Link} to="/">
        {t("notFound.home")}
      </Anchor>
    </AuthCard>
  );
}
