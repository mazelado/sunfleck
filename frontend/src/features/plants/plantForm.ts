import type { Plant, ContainerMaterial, PlantStatus, SoilType } from "../../api/plants";
import type { Location } from "../../api/places";
import type { Wish } from "../../api/wishlist";
import { cmToDisplay, displayToCm, type UnitSystem } from "../../lib/units";
import type { ChosenSpecies } from "../taxonomy/SpeciesPicker";

export interface LightChoice {
  checked: boolean;
  distance: number | "";
}

export interface PlantFormValues {
  nickname: string;
  locationId: string | null;
  /** Keyed by light source id. */
  lights: Record<string, LightChoice>;
  status: PlantStatus;
  potDiameter: number | "";
  potHeight: number | "";
  potMaterial: ContainerMaterial | null;
  soil: SoilType | null;
  acquiredOn: string;
  notes: string;
  photo: File | null;
  species: ChosenSpecies | null;
  /** The care profile chosen for the plant; null uses its species' profile. */
  careProfileKey: string | null;
  /** New plants: about how many days ago it was last watered and fertilized; "" if not known. */
  lastWatered: string;
  lastFertilized: string;
}

/** The lights that reach a plant, as the form shows them. */
export function initialLights(
  plant: Plant | undefined,
  units: UnitSystem,
): Record<string, LightChoice> {
  const lights: Record<string, LightChoice> = {};
  for (const link of plant?.light_sources ?? []) {
    lights[String(link.light_source.id)] = {
      checked: true,
      distance: link.distance_cm === null ? "" : cmToDisplay(link.distance_cm, units),
    };
  }
  return lights;
}

/** What the API is sent for the plant in the form (its last care is added for new ones). */
export function plantBody(
  formValues: PlantFormValues,
  location: Location | undefined,
  units: UnitSystem,
) {
  const chosenLights = (location?.light_sources ?? []).filter(
    (light) => formValues.lights[String(light.id)]?.checked,
  );
  return {
    nickname: formValues.nickname,
    location_id: location ? location.id : null,
    status: formValues.status,
    container_diameter_cm:
      formValues.potDiameter === "" ? null : displayToCm(formValues.potDiameter, units),
    container_height_cm:
      formValues.potHeight === "" ? null : displayToCm(formValues.potHeight, units),
    container_material: formValues.potMaterial,
    soil_type: formValues.soil,
    acquired_on: formValues.acquiredOn || null,
    notes: formValues.notes,
    taxon_id: formValues.species?.id ?? null,
    care_profile_key: formValues.careProfileKey,
    light_sources: chosenLights.map((light) => {
      const distance = formValues.lights[String(light.id)]?.distance ?? "";
      return {
        light_source_id: light.id,
        distance_cm: distance !== "" ? displayToCm(distance, units) : null,
      };
    }),
  };
}

/** The form's starting values: a plant's own when editing, else a wish's name and species. */
export function plantFormValues(
  plant: Plant | undefined,
  wish: Wish | undefined,
  /** For a new plant: the room it's added from, if any. */
  locationId: string | null,
  units: UnitSystem,
): PlantFormValues {
  return {
    nickname: plant?.nickname ?? wish?.name ?? "",
    locationId: plant ? (plant.location ? String(plant.location.id) : null) : locationId,
    lights: initialLights(plant, units),
    status: plant?.status ?? "active",
    potDiameter:
      plant?.container_diameter_cm == null ? "" : cmToDisplay(plant.container_diameter_cm, units),
    potHeight:
      plant?.container_height_cm == null ? "" : cmToDisplay(plant.container_height_cm, units),
    potMaterial: plant?.container_material ?? null,
    soil: plant?.soil_type ?? null,
    acquiredOn: plant?.acquired_on ?? "",
    notes: plant?.notes ?? "",
    photo: null,
    species: plant?.species ?? wish?.species ?? null,
    careProfileKey: plant?.care_profile?.chosen ? plant.care_profile.key : null,
    lastWatered: "",
    lastFertilized: "",
  };
}
