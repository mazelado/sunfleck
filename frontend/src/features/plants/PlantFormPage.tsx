import { Navigate, useParams, useSearchParams } from "react-router";

import { usePlant } from "../../api/plants";
import { useSites } from "../../api/places";
import { useWishlist } from "../../api/wishlist";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { PlantForm } from "./PlantForm";

/**
 * Add a plant (`/plants/new`, optionally `?location=<id>`, or `?wish=<id>` for one from the
 * wishlist) or edit one (`/plants/:id/edit`).
 */
export function PlantFormPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const plantId = params.plantId ? Number(params.plantId) : null;
  const wishId =
    plantId === null && searchParams.get("wish") ? Number(searchParams.get("wish")) : null;
  const plant = usePlant(plantId);
  const sites = useSites();
  const wishlist = useWishlist(wishId !== null);
  const canEdit = useCanEdit();

  if (!canEdit) {
    return <Navigate to={plantId ? `/plants/${String(plantId)}` : "/plants"} replace />;
  }
  if (
    sites.isPending ||
    (plantId !== null && plant.isPending) ||
    (wishId !== null && wishlist.isPending)
  ) {
    return <FullPageLoader />;
  }
  if (plantId !== null && !plant.data) {
    return <ErrorAlert error={plant.error ?? new Error("not found")} />;
  }
  return (
    <PlantForm
      sites={sites.data ?? []}
      plant={plantId !== null ? plant.data : undefined}
      // Gone if someone else got it meanwhile: then it's an ordinary new plant.
      wish={wishlist.data?.find((each) => each.id === wishId)}
    />
  );
}
