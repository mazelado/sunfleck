import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Chip,
  Group,
  Image,
  Menu,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDots, IconPencil, IconPhoto, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type CareEvent,
  eventInput,
  FEEDBACK,
  type TimelineItem,
  useDeleteCareEvent,
  useTimeline,
  useUpdateCareEvent,
} from "../../api/care";
import type { Photo } from "../../api/plants";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PersonAvatar } from "../../components/PersonAvatar";
import { formatDateAndTime, relativeDay } from "../../lib/relativeTime";
import { CareEventDialog } from "./CareEventDialog";
import { CareIcon } from "./icons";
import { useCareTypeName } from "./useCareTypeName";

interface PlantTimelineProps {
  plantId: number;
  canEdit: boolean;
  /** Opens a photo in the photo viewer. */
  onOpenPhoto: (photo: Photo) => void;
}

/** The plant's history: care and photos, newest first. */
export function PlantTimeline({ plantId, canEdit, onOpenPhoto }: PlantTimelineProps) {
  const { t } = useTranslation();
  const timeline = useTimeline(plantId);
  const [editing, setEditing] = useState<CareEvent | null>(null);
  const items = timeline.data?.pages.flatMap((page) => page.items) ?? [];
  // Only the latest watering asks for soil feedback, so the history doesn't nag.
  const latestWatering = items.find((item) => item.care_event?.care_type.counts_as_watering);
  const askFeedbackFor =
    canEdit && latestWatering?.care_event && !latestWatering.care_event.feedback
      ? latestWatering.care_event.id
      : null;

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Title order={2} fz="h4">
          {t("care.history")}
        </Title>
        <ErrorAlert error={timeline.error} />
        {!timeline.isPending && items.length === 0 && (
          <Text size="sm" c="dimmed">
            {t("care.noHistory")}
          </Text>
        )}
        {items.map((item) =>
          item.care_event ? (
            <CareEntry
              key={`care-${String(item.care_event.id)}`}
              event={item.care_event}
              canEdit={canEdit}
              askFeedback={item.care_event.id === askFeedbackFor}
              onEdit={setEditing}
            />
          ) : (
            <PhotoEntry key={`photo-${String(item.photo?.id)}`} item={item} onOpen={onOpenPhoto} />
          ),
        )}
        {timeline.hasNextPage && (
          <Center>
            <Button
              variant="default"
              size="xs"
              loading={timeline.isFetchingNextPage}
              onClick={() => void timeline.fetchNextPage()}
            >
              {t("plants.showMore")}
            </Button>
          </Center>
        )}
      </Stack>
      {editing && (
        <CareEventDialog
          plantId={plantId}
          event={editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </Paper>
  );
}

function When({ at }: { at: string }) {
  const { i18n } = useTranslation();
  return (
    <Text size="xs" c="dimmed" title={formatDateAndTime(at, i18n.language)}>
      {relativeDay(at, i18n.language)}
    </Text>
  );
}

interface CareEntryProps {
  event: CareEvent;
  canEdit: boolean;
  askFeedback: boolean;
  onEdit: (event: CareEvent) => void;
}

function CareEntry({ event, canEdit, askFeedback, onEdit }: CareEntryProps) {
  const { t } = useTranslation();
  const { done } = useCareTypeName();
  const deleteEvent = useDeleteCareEvent();
  const updateEvent = useUpdateCareEvent();
  const action = done(event.care_type);

  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <ThemeIcon variant="light" radius="xl" size="lg" color={event.skipped ? "gray" : "leaf"}>
        <CareIcon icon={event.care_type.icon} />
      </ThemeIcon>
      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Group gap={6}>
          <Text fw={500} td={event.skipped ? "line-through" : undefined}>
            {action}
          </Text>
          {event.skipped && (
            <Badge size="sm" variant="light" color="gray">
              {t("care.skipped")}
            </Badge>
          )}
          {event.feedback && (
            <Badge
              size="sm"
              variant="light"
              color={event.feedback === "just_right" ? "leaf" : "yellow"}
            >
              {t("care.soil", { feedback: t(`care.feedback.${event.feedback}`) })}
            </Badge>
          )}
        </Group>
        <Group gap={6}>
          <When at={event.performed_at} />
          {event.performed_by && (
            <Group gap={4} wrap="nowrap">
              <Text size="xs" c="dimmed">
                ·
              </Text>
              <PersonAvatar url={event.performed_by.avatar_url} size={18} />
              <Text size="xs" c="dimmed">
                {t("care.by", { name: event.performed_by.display_name })}
              </Text>
            </Group>
          )}
        </Group>
        {event.notes && (
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {event.notes}
          </Text>
        )}
        {askFeedback && (
          <Stack gap={4} mt={4}>
            <Text size="xs" c="dimmed" id={`soil-${String(event.id)}`}>
              {t("care.howWasSoil")}
            </Text>
            <Group gap={6} role="group" aria-labelledby={`soil-${String(event.id)}`}>
              {FEEDBACK.map((feedback) => (
                <Chip
                  key={feedback}
                  size="xs"
                  checked={false}
                  disabled={updateEvent.isPending}
                  onChange={() => {
                    updateEvent.mutate({ id: event.id, body: { ...eventInput(event), feedback } });
                  }}
                >
                  {t(`care.feedback.${feedback}`)}
                </Chip>
              ))}
            </Group>
          </Stack>
        )}
        <ErrorAlert error={updateEvent.error ?? deleteEvent.error} />
      </Stack>
      {canEdit && (
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={t("care.eventMenu", { action })}>
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconPencil size={16} />}
              onClick={() => {
                onEdit(event);
              }}
            >
              {t("care.editEvent")}
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => {
                deleteEvent.mutate(event.id, {
                  onSuccess: () => notifications.show({ message: t("care.eventDeleted") }),
                });
              }}
            >
              {t("care.deleteEvent")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}

function PhotoEntry({ item, onOpen }: { item: TimelineItem; onOpen: (photo: Photo) => void }) {
  const { t } = useTranslation();
  const photo = item.photo;
  if (!photo) {
    return null;
  }
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <ThemeIcon variant="light" radius="xl" size="lg" color="blue">
        <IconPhoto size={18} aria-hidden />
      </ThemeIcon>
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        <Text fw={500}>{photo.caption || t("care.photo")}</Text>
        <When at={item.at} />
        <UnstyledButton
          w={160}
          aria-label={photo.caption || t("care.photo")}
          onClick={() => {
            onOpen(photo);
          }}
        >
          <Image src={photo.thumbnail_url} alt="" radius="md" h={120} fit="cover" />
        </UnstyledButton>
      </Stack>
    </Group>
  );
}
