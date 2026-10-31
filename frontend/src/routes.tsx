import type { ComponentType } from "react";
import type { RouteObject } from "react-router";

import { AcceptInvitationPage } from "./features/auth/AcceptInvitationPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import { SetupPage } from "./features/auth/SetupPage";
import { SignInPage } from "./features/auth/SignInPage";
import { AppLayout } from "./features/layout/AppLayout";
import { NotFoundPage } from "./features/layout/NotFoundPage";
import { RequireAuth } from "./features/layout/RequireAuth";
import { SetupGate } from "./features/layout/SetupGate";
import { TodayPage } from "./features/today/TodayPage";
import { loadPageCode } from "./lib/stalePages";

/**
 * A page loaded when it's first opened, so the app starts with less to download. (The service
 * worker then fetches the rest in the background, so later visits are instant.) If the code
 * is gone because the app was updated, the app reloads itself (see `loadPageCode`).
 */
function page<Module>(load: () => Promise<Module>, name: keyof Module) {
  return {
    lazy: async () => ({ Component: (await loadPageCode(load))[name] as ComponentType }),
  } satisfies Partial<RouteObject>;
}

export const routes: RouteObject[] = [
  {
    element: <SetupGate />,
    children: [
      { path: "/setup", element: <SetupPage /> },
      { path: "/sign-in", element: <SignInPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password/:key", element: <ResetPasswordPage /> },
      { path: "/invite/:token", element: <AcceptInvitationPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: "/", element: <TodayPage /> },
              {
                path: "/plants",
                ...page(() => import("./features/plants/PlantsPage"), "PlantsPage"),
              },
              {
                path: "/plants/new",
                ...page(() => import("./features/plants/PlantFormPage"), "PlantFormPage"),
              },
              {
                path: "/plants/:plantId",
                ...page(() => import("./features/plants/PlantPage"), "PlantPage"),
              },
              {
                path: "/plants/:plantId/edit",
                ...page(() => import("./features/plants/PlantFormPage"), "PlantFormPage"),
              },
              {
                path: "/guide",
                ...page(() => import("./features/taxonomy/GuidePage"), "GuidePage"),
              },
              {
                path: "/guide/profiles/:key",
                ...page(() => import("./features/taxonomy/CareProfilePage"), "CareProfilePage"),
              },
              {
                path: "/guide/species/:taxonId",
                ...page(() => import("./features/taxonomy/SpeciesPage"), "SpeciesPage"),
              },
              {
                path: "/places",
                ...page(() => import("./features/places/PlacesPage"), "PlacesPage"),
              },
              {
                path: "/places/new",
                ...page(() => import("./features/places/SiteFormPage"), "SiteFormPage"),
              },
              {
                path: "/places/:siteId",
                ...page(() => import("./features/places/SitePage"), "SitePage"),
              },
              {
                path: "/places/:siteId/edit",
                ...page(() => import("./features/places/SiteFormPage"), "SiteFormPage"),
              },
              {
                path: "/places/:siteId/locations/new",
                ...page(() => import("./features/places/LocationFormPage"), "LocationFormPage"),
              },
              {
                path: "/places/:siteId/locations/:locationId",
                ...page(() => import("./features/places/LocationPage"), "LocationPage"),
              },
              {
                path: "/places/:siteId/locations/:locationId/edit",
                ...page(() => import("./features/places/LocationFormPage"), "LocationFormPage"),
              },
              {
                path: "/about",
                ...page(() => import("./features/about/AboutPage"), "AboutPage"),
              },
              {
                path: "/settings/profile",
                ...page(() => import("./features/settings/ProfilePage"), "ProfilePage"),
              },
              {
                path: "/settings/household",
                ...page(() => import("./features/settings/HouseholdPage"), "HouseholdPage"),
              },
              {
                path: "/settings/care-types",
                ...page(() => import("./features/care/CareTypesPage"), "CareTypesPage"),
              },
              {
                path: "/settings/notifications",
                ...page(() => import("./features/settings/NotificationsPage"), "NotificationsPage"),
              },
              {
                path: "/settings/plugins",
                ...page(() => import("./features/settings/PluginsPage"), "PluginsPage"),
              },
              {
                path: "/settings/data",
                ...page(() => import("./features/settings/DataPage"), "DataPage"),
              },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
