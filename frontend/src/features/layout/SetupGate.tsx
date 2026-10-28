import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { IconCloudOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router";

import { useSetupStatus } from "../../api/accounts";
import { FullPageLoader } from "../../components/FullPageLoader";

/** Sends everyone to the setup page until the first account exists, and away from it after. */
export function SetupGate() {
  const { pathname } = useLocation();
  const setup = useSetupStatus();
  if (setup.isPending) {
    return <FullPageLoader />;
  }
  if (setup.isError) {
    return (
      <Unreachable
        retrying={setup.isFetching}
        onRetry={() => {
          void setup.refetch();
        }}
      />
    );
  }
  const needsSetup = setup.data.needs_setup;
  if (needsSetup && pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }
  if (!needsSetup && pathname === "/setup") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** When the server can't be reached, e.g. an installed app opened without a connection. */
function Unreachable({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Center component="main" mih="100dvh" p="md">
      <Stack align="center" gap="sm" maw={360} ta="center">
        <IconCloudOff size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Title order={1} fz="h3">
          {t("unreachable.title")}
        </Title>
        <Text c="dimmed">{t("unreachable.body")}</Text>
        <Button loading={retrying} onClick={onRetry}>
          {t("unreachable.retry")}
        </Button>
      </Stack>
    </Center>
  );
}
