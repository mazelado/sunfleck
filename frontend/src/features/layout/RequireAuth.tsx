import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";

import { hasSignedOut, useMe } from "../../api/accounts";
import { FullPageLoader } from "../../components/FullPageLoader";
import { setLanguage } from "../../i18n";

/** Shows its pages only to signed-in people; everyone else goes to the sign-in page. */
export function RequireAuth() {
  const { pathname, search } = useLocation();
  const me = useMe();
  const locale = me.data?.locale;
  // The language chosen in the profile.
  useEffect(() => {
    if (locale) {
      void setLanguage(locale);
    }
  }, [locale]);
  if (me.isPending) {
    return <FullPageLoader />;
  }
  if (!me.data) {
    // After signing out, signing in starts afresh (on Today). The sign-out also goes to the
    // sign-in page, but this page may see the signed-out session before that shows.
    if (hasSignedOut()) {
      return <Navigate to="/sign-in" replace />;
    }
    // The session ended: come back here after signing in.
    const next = encodeURIComponent(pathname + search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }
  return <Outlet />;
}
