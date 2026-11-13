import { Anchor, Button, Group, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import { type Channel, useUpdateChannel } from "../../api/notifications";
import { useApplyFieldErrors } from "../auth/serverErrors";

const APPRISE_WIKI = "https://github.com/caronc/apprise/wiki";
const WEB_PUSH = "webpush";

/** Rename a channel or change its address; the current address is never shown. */
export function EditChannelForm({ channel, onDone }: { channel: Channel; onDone: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateChannel();
  const applyFieldErrors = useApplyFieldErrors();
  const form = useForm({
    initialValues: { label: channel.label, url: "" },
    validate: { label: (value) => (value.trim() ? null : t("validation.required")) },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await update.mutateAsync({
        id: channel.id,
        body: {
          label: values.label,
          enabled: channel.enabled,
          url: values.url.trim() || null,
        },
      });
      notifications.show({ message: t("notifications.saved") });
      onDone();
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={t("notifications.edit", { label: channel.label })}
    >
      <Stack gap="sm">
        <TextInput
          label={t("notifications.label")}
          required
          maxLength={100}
          {...form.getInputProps("label")}
        />
        {channel.service !== WEB_PUSH && (
          <TextInput
            label={t("notifications.newUrl")}
            description={
              <>
                {t("notifications.newUrlHelp")}{" "}
                <Anchor
                  href={APPRISE_WIKI}
                  target="_blank"
                  rel="noreferrer"
                  size="xs"
                  underline="always"
                >
                  {t("notifications.allServices")}
                </Anchor>
              </>
            }
            autoComplete="off"
            spellCheck={false}
            maxLength={2000}
            {...form.getInputProps("url")}
          />
        )}
        <Group gap="xs">
          <Button type="submit" loading={update.isPending}>
            {t("common.save")}
          </Button>
          <Button variant="default" onClick={onDone}>
            {t("common.cancel")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
