import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";

import { useMe } from "../../api/accounts";
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
    const next = encodeURIComponent(pathname + search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }
  return <Outlet />;
}
