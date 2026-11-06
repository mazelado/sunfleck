import {
  Alert,
  Badge,
  Button,
  Checkbox,
  FileButton,
  Group,
  List,
  Modal,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { IconAlertTriangle, IconCamera, IconCheck, IconStethoscope } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Diagnosis, diagnosePlant, type DiagnosisRequest } from "../../api/diagnosis";
import { useSuggestAvailable } from "../../api/taxonomy";
import { ErrorAlert } from "../../components/ErrorAlert";
import { type PreparedPhoto, preparePhoto } from "../../lib/photos";

/**
 * "What's wrong?": send a photo of a struggling plant, with a few words, to the household's AI
 * plugin and show its likely causes and next steps. Only when someone asks, and hidden when no
 * AI plugin is on.
 */
export function DiagnosePlant({ plantId, plantName }: { plantId: number; plantName: string }) {
  const { t } = useTranslation();
  const available = useSuggestAvailable().data?.available ?? false;
  const [opened, setOpened] = useState(false);
  if (!available) {
    return null;
  }
  return (
    <>
      <Group>
        <Button
          variant="light"
          color="grape"
          size="xs"
          leftSection={<IconStethoscope size={14} />}
          onClick={() => {
            setOpened(true);
          }}
        >
          {t("diagnosis.button")}
        </Button>
      </Group>
      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
        }}
        title={t("diagnosis.title", { name: plantName })}
        size="lg"
      >
        {/* It starts again each time the dialog opens. */}
        {opened && <DiagnoseForm plantId={plantId} />}
      </Modal>
    </>
  );
}

function useDiagnose(plantId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: DiagnosisRequest) => diagnosePlant(plantId, request),
    onSuccess: async (diagnosis) => {
      // A kept photo shows in the gallery and the history.
      if (diagnosis.photo) {
        await queryClient.invalidateQueries({ queryKey: ["plants"] });
      }
    },
  });
}

function DiagnoseForm({ plantId }: { plantId: number }) {
  const { t } = useTranslation();
  const diagnose = useDiagnose(plantId);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [description, setDescription] = useState("");
  const [keepPhoto, setKeepPhoto] = useState(true);

  async function choose(file: File | null) {
    if (!file) return;
    setPreparing(true);
    try {
      setPhoto(await preparePhoto(file));
      diagnose.reset();
    } finally {
      setPreparing(false);
    }
  }

  if (diagnose.data) {
    return (
      <Stack>
        <DiagnosisResult diagnosis={diagnose.data} />
        <Group>
          <Button
            variant="default"
            onClick={() => {
              setPhoto(null);
              diagnose.reset();
            }}
          >
            {t("diagnosis.again")}
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (photo) diagnose.mutate({ photo, description: description.trim(), keepPhoto });
      }}
    >
      <Stack>
        <Text size="sm">{t("diagnosis.intro")}</Text>
        <Group>
          <FileButton onChange={(file) => void choose(file)} accept="image/*" capture="environment">
            {(props) => (
              <Button
                {...props}
                variant={photo ? "default" : "filled"}
                loading={preparing}
                leftSection={<IconCamera size={16} />}
              >
                {photo ? t("diagnosis.otherPhoto") : t("diagnosis.photo")}
              </Button>
            )}
          </FileButton>
          {photo && (
            <Group gap={4}>
              <IconCheck size={16} aria-hidden />
              <Text size="sm">{photo.filename}</Text>
            </Group>
          )}
        </Group>
        <Textarea
          label={t("diagnosis.description")}
          description={t("diagnosis.descriptionHelp")}
          value={description}
          onChange={(event) => {
            setDescription(event.currentTarget.value);
          }}
          maxLength={1000}
          autosize
          minRows={2}
        />
        <Checkbox
          label={t("diagnosis.keepPhoto")}
          checked={keepPhoto}
          onChange={(event) => {
            setKeepPhoto(event.currentTarget.checked);
          }}
        />
        <ErrorAlert error={diagnose.error} />
        <Text size="xs" c="dimmed">
          {t("diagnosis.privacy")}
        </Text>
        <Group>
          <Button type="submit" disabled={!photo} loading={diagnose.isPending}>
            {t("diagnosis.ask")}
          </Button>
          {diagnose.isPending && (
            <Text size="sm" c="dimmed" role="status">
              {t("diagnosis.waiting")}
            </Text>
          )}
        </Group>
      </Stack>
    </form>
  );
}

function DiagnosisResult({ diagnosis }: { diagnosis: Diagnosis }) {
  const { t } = useTranslation();
  return (
    <Stack gap="sm">
      {diagnosis.urgent && (
        <Alert color="red" icon={<IconAlertTriangle />} title={t("diagnosis.urgent")}>
          {t("diagnosis.urgentHelp")}
        </Alert>
      )}
      <Text>{diagnosis.summary}</Text>
      {!diagnosis.photo_clear && (
        <Text size="sm" c="dimmed">
          {t("diagnosis.unclear")}
        </Text>
      )}
      {diagnosis.causes.length > 0 && (
        <Stack gap="xs">
          <Title order={2} fz="h5">
            {t("diagnosis.causes")}
          </Title>
          {diagnosis.causes.map((cause) => (
            <Stack key={cause.cause} gap={2}>
              <Group gap="xs">
                <Text fw={600} size="sm">
                  {cause.cause}
                </Text>
                <Badge
                  size="sm"
                  variant="light"
                  color={cause.likelihood === "likely" ? "orange" : "gray"}
                >
                  {t(
                    `diagnosis.likelihood.${cause.likelihood === "likely" ? "likely" : "possible"}`,
                  )}
                </Badge>
              </Group>
              <Text size="sm">{cause.signs}</Text>
            </Stack>
          ))}
        </Stack>
      )}
      {diagnosis.next_steps.length > 0 && (
        <Stack gap="xs">
          <Title order={2} fz="h5">
            {t("diagnosis.nextSteps")}
          </Title>
          <List type="ordered" size="sm" spacing={4}>
            {diagnosis.next_steps.map((step) => (
              <List.Item key={step}>{step}</List.Item>
            ))}
          </List>
        </Stack>
      )}
      {diagnosis.photo && (
        <Text size="sm" c="dimmed">
          {t("diagnosis.photoKept")}
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {diagnosis.attribution} · {t("diagnosis.check")}
      </Text>
    </Stack>
  );
}
