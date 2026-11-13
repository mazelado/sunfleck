import { Paper, Stack, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useNotifications } from "../../api/notifications";
import { PageHeader } from "../../components/PageHeader";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { CalendarFeed } from "./CalendarFeed";
import { ChannelRow } from "./ChannelRow";
import { DigestPreview } from "./DigestPreview";
import { OtherChannels } from "./OtherChannels";
import { PreferencesForm } from "./PreferencesForm";
import { ThisDevice } from "./ThisDevice";

/** Each person's own notifications: where they go, when, and what today's would say. */
export function NotificationsPage() {
  const { t } = useTranslation();
  const data = useNotifications();

  if (data.isPending) {
    return <FullPageLoader />;
  }
  if (!data.data) {
    return <ErrorAlert error={data.error} />;
  }
  return (
    <Stack gap="md">
      <PageHeader
        title={t("notifications.title")}
        back={{ to: "/settings", label: t("settings.title") }}
        subtitle={t("notifications.intro")}
      />
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Title order={2} fz="h4">
            {t("notifications.channels")}
          </Title>
          {/* This device first: for most people, the whole answer. */}
          <ThisDevice />
          {data.data.channels.map((channel) => (
            <ChannelRow key={channel.id} channel={channel} />
          ))}
          <OtherChannels />
        </Stack>
      </Paper>
      <PreferencesForm preferences={data.data.preferences} />
      <DigestPreview />
      <CalendarFeed />
    </Stack>
  );
}
