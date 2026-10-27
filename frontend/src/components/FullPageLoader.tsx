import { Center, Loader } from "@mantine/core";
import { useTranslation } from "react-i18next";

export function FullPageLoader() {
  const { t } = useTranslation();
  return (
    <Center mih="100dvh">
      <Loader aria-label={t("common.loading")} />
    </Center>
  );
}
