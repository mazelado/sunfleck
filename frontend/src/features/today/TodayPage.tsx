import { Alert, Anchor, Container, Stack, Text, Title } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useSites } from "../../api/places";
import { usePlants } from "../../api/plants";
import { useToday } from "../../api/today";
import { EmptyState } from "../../components/EmptyState";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { PageHeader } from "../../components/PageHeader";
import { useCanEdit } from "../../lib/useCanEdit";
import { GardenNote } from "../garden/GardenNote";
import { GettingStarted } from "../home/GettingStarted";
import { DueCount } from "./DueCount";
import { groupBy } from "./grouping";
import { TaskGroup } from "./TaskGroup";
import { WeatherCard } from "./WeatherCard";

/** The household's care for today: what's overdue or due, by location, then what's coming up. */
export function TodayPage() {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const canEdit = useCanEdit();
  const places = useSites().data;
  const plantCount = usePlants().data?.pages[0]?.count;

  if (today.isPending) {
    return <FullPageLoader />;
  }
  if (!today.data) {
    return <ErrorAlert error={today.error} />;
  }
  const {
    sites,
    tasks,
    unscheduled_plants: unscheduled,
    unscheduled_plant_id: unscheduledPlantId,
  } = today.data;
  const due = tasks.filter((task) => task.days_until <= 0);
  const upcoming = tasks.filter((task) => task.days_until > 0);
  // The room alone when there's only one place to be in; else which place it's in too.
  const onePlace = (places?.length ?? 0) <= 1;
  const byLocation = groupBy(due, (task) =>
    task.plant.location
      ? onePlace
        ? task.plant.location.name
        : `${task.plant.location.site_name} · ${task.plant.location.name}`
      : t("today.noLocation"),
  );
  const byDay = groupBy(upcoming, (task) => task.due_on);
  // A new household, with no plants and so no care: the first steps instead of empty lists.
  const isNew = plantCount === 0 && places !== undefined && tasks.length === 0 && unscheduled === 0;

  return (
    // A reading width on wide screens, so each plant's name and its buttons sit together.
    <Container size="reading" px={0}>
      <Stack gap="lg">
        <PageHeader
          title={t("today.title")}
          eyebrow={
            <Text className="sunfleck-card-label" size="xs">
              {new Intl.DateTimeFormat(i18n.language, {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(new Date())}
            </Text>
          }
          action={due.length > 0 && <DueCount count={due.length} />}
        />

        {isNew && <GettingStarted sites={places} canEdit={canEdit} />}

        {sites.map((conditions) => (
          <WeatherCard
            key={`${String(conditions.site_id)}-${conditions.plugin_id}`}
            conditions={conditions}
          />
        ))}

        {unscheduled > 0 && (
          <Alert variant="light" icon={<IconInfoCircle />}>
            {t("today.unscheduled", { count: unscheduled })}{" "}
            {/* Straight to the plant when there's one, else to the list of them. */}
            <Anchor
              component={Link}
              to={
                unscheduledPlantId === null
                  ? "/plants?needs_routine=true"
                  : `/plants/${String(unscheduledPlantId)}`
              }
              inherit
            >
              {t("today.unscheduledAction", { count: unscheduled })}
            </Anchor>
          </Alert>
        )}

        <GardenNote />

        {!isNew && (
          <>
            <Stack gap="sm">
              <Title order={2} fz="h4">
                {t("today.needsCare")}
              </Title>
              {due.length === 0 && (
                <EmptyState illustration="done">{t("today.allCaughtUp")}</EmptyState>
              )}
              {[...byLocation].map(([location, group]) => (
                <TaskGroup
                  key={location}
                  title={location}
                  place={group[0]?.plant.location?.name}
                  tasks={group}
                  canEdit={canEdit}
                  bulk={canEdit}
                />
              ))}
            </Stack>

            <Stack gap="sm">
              <Title order={2} fz="h4">
                {t("today.comingUp")}
              </Title>
              {upcoming.length === 0 && <Text c="dimmed">{t("today.nothingComingUp")}</Text>}
              {[...byDay].map(([day, group]) => (
                <TaskGroup
                  key={day}
                  title={
                    group[0]?.days_until === 1
                      ? t("today.tomorrow")
                      : new Intl.DateTimeFormat(i18n.language, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        }).format(new Date(`${day}T12:00:00`))
                  }
                  tasks={group}
                  canEdit={canEdit}
                  bulk={false}
                />
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Container>
  );
}
