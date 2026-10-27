import { Navigate, Outlet, useLocation } from "react-router";

import { useMe } from "../../api/accounts";
import { FullPageLoader } from "../../components/FullPageLoader";

/** Shows its pages only to signed-in people; everyone else goes to the sign-in page. */
export function RequireAuth() {
  const { pathname, search } = useLocation();
  const me = useMe();
  if (me.isPending) {
    return <FullPageLoader />;
  }
  if (!me.data) {
    const next = encodeURIComponent(pathname + search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }
  return <Outlet />;
}
