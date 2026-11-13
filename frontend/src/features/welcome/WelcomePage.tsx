import { useState } from "react";
import { Navigate } from "react-router";

import { type LightSource, type Location, type Site, useSites } from "../../api/places";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { PlaceStep } from "./PlaceStep";
import { PlantSteps } from "./PlantSteps";
import { RoomStep } from "./RoomStep";

const STEPS = 4;

/**
 * The first-run flow (`/welcome`): a place, a room with its window, and a first plant, one
 * question per screen. Each step is saved as it's done, so leaving loses nothing; coming back
 * starts at the first step not done yet.
 */
export function WelcomePage() {
  const sites = useSites();
  const canEdit = useCanEdit();
  if (!canEdit) {
    return <Navigate to="/" replace />;
  }
  if (sites.isPending) {
    return <FullPageLoader />;
  }
  return <WelcomeFlow sites={sites.data ?? []} />;
}

type Stage =
  | { step: "place"; site?: Site }
  | { step: "room"; site: Site; madeHere: boolean }
  | { step: "plant"; location: Location; light: LightSource | null };

/** Where to start: the first of a place, a room in it, and a plant that the household lacks. */
function firstStage(sites: Site[]): Stage {
  const site = sites[0];
  if (!site) return { step: "place" };
  const location = sites.flatMap((each) => each.locations)[0];
  if (!location) return { step: "room", site, madeHere: false };
  return { step: "plant", location, light: null };
}

function WelcomeFlow({ sites }: { sites: Site[] }) {
  const [stage, setStage] = useState<Stage>(() => firstStage(sites));

  if (stage.step === "place") {
    return (
      <PlaceStep
        site={stage.site}
        step={1}
        of={STEPS}
        onDone={(site) => {
          setStage({ step: "room", site, madeHere: true });
        }}
      />
    );
  }
  if (stage.step === "room") {
    return (
      <RoomStep
        site={stage.site}
        step={2}
        of={STEPS}
        // Back to the place only when it was made in this flow (else it's not this flow's).
        onBack={
          stage.madeHere
            ? () => {
                setStage({ step: "place", site: stage.site });
              }
            : undefined
        }
        onDone={({ location, light }) => {
          setStage({ step: "plant", location, light });
        }}
      />
    );
  }
  return <PlantSteps location={stage.location} light={stage.light} step={3} of={STEPS} />;
}
