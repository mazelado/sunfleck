import {
  Anchor,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconExternalLink, IconPencil, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useDeleteWish, useSaveWish, useWishlist, type Wish } from "../../api/wishlist";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { sentenceCase } from "../../lib/text";
import { useCanEdit } from "../../lib/useCanEdit";
import { EmptyState } from "../../components/EmptyState";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { type ChosenSpecies, SpeciesPicker } from "../taxonomy/SpeciesPicker";

/** The plants the household would like to have. "Got it" adds one as a plant. */
export function WishlistPage() {
  const { t } = useTranslation();
  const wishlist = useWishlist();
  const canEdit = useCanEdit();
  const [editing, setEditing] = useState<Wish | "new" | null>(null);

  if (wishlist.isPending) {
    return <FullPageLoader />;
  }
  const items = wishlist.data ?? [];
  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/plants" size="sm">
        ← {t("plants.title")}
      </Anchor>
      <Group justify="space-between">
        <Title order={1} fz="h2">
          {t("wishlist.title")}
        </Title>
        {canEdit && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing("new");
            }}
          >
            {t("wishlist.add")}
          </Button>
        )}
      </Group>
      <Text c="dimmed" size="sm">
        {t("wishlist.intro")}
      </Text>
      <ErrorAlert error={wishlist.error} />
      {items.length === 0 && !wishlist.error && (
        <EmptyState illustration="plant">{t("wishlist.empty")}</EmptyState>
      )}
      {items.map((wish) => (
        <WishCard
          key={wish.id}
          wish={wish}
          canEdit={canEdit}
          onEdit={() => {
            setEditing(wish);
          }}
        />
      ))}
      {editing !== null && (
        <WishForm
          wish={editing === "new" ? undefined : editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </Stack>
  );
}

function WishCard({ wish, canEdit, onEdit }: { wish: Wish; canEdit: boolean; onEdit: () => void }) {
  const { t } = useTranslation();
  const species = wish.species;
  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={500}>{wish.name}</Text>
            {species && (
              <Anchor component={Link} to={`/guide/species/${String(species.id)}`} size="sm">
                {species.common_name &&
                species.common_name.toLowerCase() !== wish.name.toLowerCase() ? (
                  <>{sentenceCase(species.common_name)} · </>
                ) : null}
                <Text span fs="italic" inherit>
                  {species.scientific_name}
                </Text>
              </Anchor>
            )}
            {wish.notes && (
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {wish.notes}
              </Text>
            )}
            {wish.link && (
              <Anchor
                href={wish.link}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                style={{ overflowWrap: "anywhere" }}
              >
                {t("wishlist.where", { host: hostOf(wish.link) })}{" "}
                <IconExternalLink size={12} aria-hidden />
              </Anchor>
            )}
          </Stack>
          {canEdit && (
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconPencil size={14} />}
              onClick={onEdit}
              style={{ flexShrink: 0 }}
              aria-label={t("wishlist.edit", { name: wish.name })}
            >
              {t("common.edit")}
            </Button>
          )}
        </Group>
        {canEdit && (
          <Button
            component={Link}
            to={`/plants/new?wish=${String(wish.id)}`}
            size="xs"
            variant="light"
            style={{ alignSelf: "flex-start" }}
            aria-label={t("wishlist.gotItLabel", { name: wish.name })}
          >
            {t("wishlist.gotIt")}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

function hostOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

interface WishFormValues {
  species: ChosenSpecies | null;
  name: string;
  link: string;
  notes: string;
}

function WishForm({ wish, onClose }: { wish?: Wish; onClose: () => void }) {
  const { t } = useTranslation();
  const applyFieldErrors = useApplyFieldErrors();
  const save = useSaveWish();
  const remove = useDeleteWish();
  const form = useForm<WishFormValues>({
    initialValues: {
      species: wish?.species ?? null,
      name: wish?.name ?? "",
      link: wish?.link ?? "",
      notes: wish?.notes ?? "",
    },
    validate: {
      name: isNotEmpty(t("validation.required")),
      link: (value) =>
        value.trim() === "" || /^https?:\/\/\S+$/.test(value.trim())
          ? null
          : t("wishlist.linkInvalid"),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: wish?.id,
        body: {
          name: values.name,
          taxon_id: values.species?.id ?? null,
          link: values.link.trim(),
          notes: values.notes,
        },
      });
      onClose();
    } catch (error) {
      applyFieldErrors(form, error, { taxon_id: "species" });
    }
  });

  return (
    <Modal opened onClose={onClose} title={wish ? t("wishlist.editTitle") : t("wishlist.add")}>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={save.error} />
          <SpeciesPicker
            value={form.getValues().species}
            error={form.errors.species}
            onChange={(species) => {
              form.setFieldValue("species", species);
              // Name it after its species, unless it has a name already.
              const name = species?.common_name ?? species?.scientific_name;
              if (name && !form.getValues().name.trim()) {
                form.setFieldValue("name", sentenceCase(name));
              }
            }}
          />
          <TextInput
            label={t("wishlist.name")}
            placeholder={t("wishlist.namePlaceholder")}
            required
            maxLength={100}
            {...form.getInputProps("name")}
          />
          <TextInput
            type="url"
            label={t("wishlist.link")}
            placeholder="https://"
            description={t("wishlist.linkHelp")}
            maxLength={500}
            {...form.getInputProps("link")}
          />
          <Textarea
            label={t("wishlist.notes")}
            placeholder={t("wishlist.notesPlaceholder")}
            description={t("common.optional")}
            autosize
            minRows={2}
            maxLength={2000}
            {...form.getInputProps("notes")}
          />
          <Group justify="space-between">
            {wish ? (
              <ConfirmDeleteButton
                label={t("wishlist.delete")}
                title={t("wishlist.deleteTitle", { name: wish.name })}
                message={t("wishlist.deleteConfirm")}
                onConfirm={async () => {
                  await remove.mutateAsync(wish.id);
                  notifications.show({ message: t("wishlist.deleted", { name: wish.name }) });
                  onClose();
                }}
              />
            ) : (
              <span />
            )}
            <Group>
              <Button variant="default" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={save.isPending}>
                {t("common.save")}
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
