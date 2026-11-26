import { useState } from "react";
import { Navigate } from "react-router";

import { type Me, useMe } from "../../api/accounts";
import { type LightSource, type Location, type Site, useSites } from "../../api/places";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { GrowStep } from "./GrowStep";
import { PlaceStep } from "./PlaceStep";
import { PlantSteps } from "./PlantSteps";
import { RoomStep } from "./RoomStep";

/**
 * The first-run flow (`/welcome`): for an Admin of a household without a place, what it grows
 * (which turns on Garden and Collection); then a place, a room with its window, and a first
 * plant, one question per screen. Each step is saved as it's done, so leaving loses nothing;
 * coming back starts at the first step not done yet.
 */
export function WelcomePage() {
  const sites = useSites();
  const me = useMe().data;
  const canEdit = useCanEdit();
  if (!canEdit) {
    return <Navigate to="/" replace />;
  }
  if (sites.isPending || !me) {
    return <FullPageLoader />;
  }
  return <WelcomeFlow sites={sites.data ?? []} me={me} />;
}

type Stage =
  | { step: "grow" }
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

function WelcomeFlow({ sites, me }: { sites: Site[]; me: Me }) {
  // Only Admins choose the parts of the app; in a new household, it's the first question.
  const [asksWhatsGrown] = useState(
    () => me.role === "admin" && me.household !== null && sites.length === 0,
  );
  const [stage, setStage] = useState<Stage>(() =>
    asksWhatsGrown ? { step: "grow" } : firstStage(sites),
  );
  const first = asksWhatsGrown ? 2 : 1;
  const steps = first + 3;

  if (stage.step === "grow" && me.household) {
    return (
      <GrowStep
        household={me.household}
        step={1}
        of={steps}
        onDone={() => {
          setStage({ step: "place" });
        }}
      />
    );
  }
  if (stage.step === "place" || stage.step === "grow") {
    const site = stage.step === "place" ? stage.site : undefined;
    return (
      <PlaceStep
        site={site}
        step={first}
        of={steps}
        onBack={
          asksWhatsGrown
            ? () => {
                setStage({ step: "grow" });
              }
            : undefined
        }
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
        step={first + 1}
        of={steps}
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
  return <PlantSteps location={stage.location} light={stage.light} step={first + 2} of={steps} />;
}
