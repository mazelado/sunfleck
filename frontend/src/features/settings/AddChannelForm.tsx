import { Anchor, Button, Group, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import { useAddChannel } from "../../api/notifications";
import { useApplyFieldErrors } from "../auth/serverErrors";

const APPRISE_WIKI = "https://github.com/caronc/apprise/wiki";

export function AddChannelForm() {
  const { t } = useTranslation();
  const add = useAddChannel();
  const applyFieldErrors = useApplyFieldErrors();
  const form = useForm({
    initialValues: { label: "", url: "" },
    validate: {
      label: (value) => (value.trim() ? null : t("validation.required")),
      url: (value) => (value.trim() ? null : t("validation.required")),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      const channel = await add.mutateAsync(values);
      notifications.show({ message: t("notifications.added", { label: channel.label }) });
      form.reset();
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="sm" mt="xs">
        <Title order={3} fz="h5">
          {t("notifications.add")}
        </Title>
        <TextInput
          label={t("notifications.label")}
          placeholder={t("notifications.labelPlaceholder")}
          required
          maxLength={100}
          {...form.getInputProps("label")}
        />
        <TextInput
          label={t("notifications.url")}
          description={
            <>
              {t("notifications.urlHelp")}{" "}
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
          required
          autoComplete="off"
          spellCheck={false}
          maxLength={2000}
          {...form.getInputProps("url")}
        />
        <Group>
          <Button type="submit" loading={add.isPending}>
            {t("notifications.add")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
