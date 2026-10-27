import type { RouteObject } from "react-router";

import { AcceptInvitationPage } from "./features/auth/AcceptInvitationPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import { SetupPage } from "./features/auth/SetupPage";
import { SignInPage } from "./features/auth/SignInPage";
import { HomePage } from "./features/home/HomePage";
import { AppLayout } from "./features/layout/AppLayout";
import { NotFoundPage } from "./features/layout/NotFoundPage";
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
