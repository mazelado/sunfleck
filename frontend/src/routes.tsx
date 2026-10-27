import type { RouteObject } from "react-router";

import { AcceptInvitationPage } from "./features/auth/AcceptInvitationPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import { SetupPage } from "./features/auth/SetupPage";
import { SignInPage } from "./features/auth/SignInPage";
import { HomePage } from "./features/home/HomePage";
import { AppLayout } from "./features/layout/AppLayout";
import { NotFoundPage } from "./features/layout/NotFoundPage";
import { LocationFormPage } from "./features/places/LocationFormPage";
import { LocationPage } from "./features/places/LocationPage";
import { PlacesPage } from "./features/places/PlacesPage";
import { SiteFormPage } from "./features/places/SiteFormPage";
import { SitePage } from "./features/places/SitePage";
import { RequireAuth } from "./features/layout/RequireAuth";
import { SetupGate } from "./features/layout/SetupGate";
import { HouseholdPage } from "./features/settings/HouseholdPage";
import { ProfilePage } from "./features/settings/ProfilePage";

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
              { path: "/", element: <HomePage /> },
              { path: "/places", element: <PlacesPage /> },
              { path: "/places/new", element: <SiteFormPage /> },
              { path: "/places/:siteId", element: <SitePage /> },
              { path: "/places/:siteId/edit", element: <SiteFormPage /> },
              { path: "/places/:siteId/locations/new", element: <LocationFormPage /> },
              { path: "/places/:siteId/locations/:locationId", element: <LocationPage /> },
              {
                path: "/places/:siteId/locations/:locationId/edit",
                element: <LocationFormPage />,
              },
              { path: "/settings/profile", element: <ProfilePage /> },
              { path: "/settings/household", element: <HouseholdPage /> },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
