import { Paper, Select, Stack, TextInput, Container } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";

import { type Site, useCreateSite, useDeleteSite, useSite, useUpdateSite } from "../../api/places";
import { FormActions } from "../../components/FormActions";
import { PageHeader } from "../../components/PageHeader";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { LeaveDialog } from "../../components/LeaveDialog";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { SitePositionFields } from "./SitePositionFields";
import { browserTimezone, timezoneOptions } from "./timezones";

/** Create a site (`/places/new`) or edit one (`/places/:siteId/edit`). */
export function SiteFormPage() {
  const { siteId } = useParams();
  const site = useSite(Number(siteId));
  const canEdit = useCanEdit();
  if (!canEdit) {
    return <Navigate to={siteId ? `/places/${siteId}` : "/places"} replace />;
  }
  if (siteId && site.isPending) {
    return <FullPageLoader />;
  }
  if (siteId && !site.data) {
    return <ErrorAlert error={site.error ?? new Error("not found")} />;
  }
  return <SiteForm site={site.data} />;
}

interface SiteFormValues {
  name: string;
  latitude: number | "";
  longitude: number | "";
  timezone: string;
}

function SiteForm({ site }: { site?: Site }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const applyFieldErrors = useApplyFieldErrors();
  const createSite = useCreateSite();
  const updateSite = useUpdateSite(site?.id ?? 0);
  const deleteSite = useDeleteSite();
  const save = site ? updateSite : createSite;
  const timezones = useMemo(() => timezoneOptions(), []);

  const form = useForm<SiteFormValues>({
    initialValues: {
      name: site?.name ?? "",
      latitude: site?.latitude ?? "",
      longitude: site?.longitude ?? "",
      timezone: site?.timezone ?? browserTimezone(),
    },
    validate: {
      name: isNotEmpty(t("validation.required")),
      latitude: isNotEmpty(t("validation.required")),
      longitude: isNotEmpty(t("validation.required")),
      timezone: isNotEmpty(t("validation.required")),
    },
  });
  const leaveGuard = useLeaveGuard(form.isDirty);
  const { latitude, longitude } = form.getValues();

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        name: values.name,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
        timezone: values.timezone,
      });
      leaveGuard.allowLeave();
      await navigate(`/places/${String(saved.id)}`);
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <Container size="reading" px={0}>
      <Stack gap="lg">
        <PageHeader
          title={site ? t("places.editSite") : t("places.newSite")}
          back={{
            to: site ? `/places/${String(site.id)}` : "/places",
            label: site?.name ?? t("places.title"),
          }}
        />
        <Paper withBorder radius="lg" p="lg">
          <form onSubmit={handleSubmit} noValidate>
            <Stack gap="md">
              <ErrorAlert error={save.error} />
              <TextInput
                label={t("places.siteName")}
                placeholder={t("places.siteNamePlaceholder")}
                required
                {...form.getInputProps("name")}
              />
              <SitePositionFields
                latitude={latitude}
                longitude={longitude}
                onPick={(lat, lng) => {
                  form.setFieldValue("latitude", lat);
                  form.setFieldValue("longitude", lng);
                }}
                latitudeProps={form.getInputProps("latitude")}
                longitudeProps={form.getInputProps("longitude")}
              />
              <Select
                label={t("places.timezone")}
                description={t("places.timezoneHelp")}
                data={timezones}
                searchable
                allowDeselect={false}
                required
                {...form.getInputProps("timezone")}
              />
              <FormActions
                saving={save.isPending}
                cancelTo={site ? `/places/${String(site.id)}` : "/places"}
                extra={
                  site && (
                    <ConfirmDeleteButton
                      label={t("places.deleteSite")}
                      title={t("places.deleteSiteTitle", { name: site.name })}
                      message={t("places.deleteSiteConfirm")}
                      onConfirm={async () => {
                        await deleteSite.mutateAsync(site.id);
                        notifications.show({
                          message: t("places.siteDeleted", { name: site.name }),
                        });
                        leaveGuard.allowLeave();
                        await navigate("/places");
                      }}
                    />
                  )
                }
              />
            </Stack>
          </form>
        </Paper>
        <LeaveDialog blocker={leaveGuard.blocker} />
      </Stack>
    </Container>
  );
}
