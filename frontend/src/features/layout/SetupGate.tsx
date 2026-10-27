import { Navigate, Outlet, useLocation } from "react-router";

import { useSetupStatus } from "../../api/accounts";
import { FullPageLoader } from "../../components/FullPageLoader";

/** Sends everyone to the setup page until the first account exists, and away from it after. */
export function SetupGate() {
  const { pathname } = useLocation();
  const setup = useSetupStatus();
  if (setup.isPending) {
    return <FullPageLoader />;
  }
  const needsSetup = setup.data?.needs_setup ?? false;
  if (needsSetup && pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }
  if (!needsSetup && pathname === "/setup") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
