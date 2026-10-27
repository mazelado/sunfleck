import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me, Member } from "../../api/accounts";
import { ada, basil, server, signInAs } from "../../test/server";
import { renderApp } from "../../test/render";

const adaMember: Member = {
  id: 1,
  user_id: 1,
  email: ada.email,
  display_name: "Ada",
  role: "admin",
};

function withMembers(members: Member[]) {
  server.use(http.get("*/api/v1/household/members", () => HttpResponse.json(members)));
}

function withInvitations(invitations: unknown[] = []) {
  server.use(http.get("*/api/v1/household/invitations", () => HttpResponse.json(invitations)));
}

describe("profile", () => {
  it("saves the name and unit preference", async () => {
    signInAs(ada);
    let sent: unknown;
    server.use(
      http.patch("*/api/v1/me", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...ada, display_name: "Ada L." });
      }),
    );
    const { user } = renderApp("/settings/profile");

    const name = await screen.findByLabelText("Your name");
    await user.clear(name);
    await user.type(name, "Ada L.");
    await user.click(screen.getByText("Imperial"));
    expect(await screen.findByText("Inches, °F, gallons")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(sent).toEqual({ display_name: "Ada L.", locale: "en", unit_system: "imperial" });
    });
    expect(await screen.findByText("Saved")).toBeVisible();
  });

  it("shows allauth's message next to the current password", async () => {
    signInAs(ada);
    server.use(
      http.post("*/_allauth/browser/v1/account/password/change", () =>
        HttpResponse.json(
          {
            status: 400,
            errors: [
              {
                code: "enter_current_password",
                message: "Please type your current password.",
                param: "current_password",
              },
            ],
          },
          { status: 400 },
        ),
      ),
    );
    const { user } = renderApp("/settings/profile");

    await user.type(await screen.findByLabelText(/Current password/), "wrong");
    await user.type(screen.getByLabelText(/^New password/), "a fresh passphrase");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your current password is incorrect.",
    );
    // The same translated message is attached to the field, for screen readers too.
    expect(screen.getByLabelText(/Current password/)).toHaveAccessibleDescription(
      "Your current password is incorrect.",
    );
  });
});

describe("household", () => {
  it("shows members read-only to non-admins, without invitations", async () => {
    const viewer: Me = { ...ada, id: 2, role: "viewer" };
    signInAs(viewer);
    withMembers([adaMember, { ...basil, user_id: 2, role: "viewer" }]);

    renderApp("/settings/household");

    expect(await screen.findByText("ada@example.com")).toBeVisible();
    expect(screen.getByText("Fern Gully")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Household name" })).not.toBeInTheDocument();
    expect(screen.queryByText("Invitations")).not.toBeInTheDocument();
    expect(screen.getByText("(you)")).toBeVisible();
  });

  it("lets an admin invite someone and shows the link to share", async () => {
    signInAs(ada);
    withMembers([adaMember]);
    withInvitations();
    let sent: unknown;
    server.use(
      http.post("*/api/v1/household/invitations", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(
          {
            id: 7,
            email: "new@example.com",
            role: "gardener",
            invited_by: "Ada",
            created_at: "2026-10-27T00:00:00Z",
            expires_at: "2026-11-03T00:00:00Z",
            url: "http://localhost/invite/secret",
            email_sent: false,
          },
          { status: 201 },
        );
      }),
    );
    const { user } = renderApp("/settings/household");

    await user.type(await screen.findByLabelText(/Their email address/), "new@example.com");
    await user.click(screen.getByRole("button", { name: "Create invitation" }));

    const status = await screen.findByRole("status");
    expect(within(status).getByText(/No email server is set up/)).toBeVisible();
    expect(within(status).getByDisplayValue("http://localhost/invite/secret")).toBeVisible();
    expect(sent).toEqual({ email: "new@example.com", role: "gardener" });
  });

  it("lists pending invitations and revokes one", async () => {
    signInAs(ada);
    withMembers([adaMember]);
    let invitations = [
      {
        id: 7,
        email: "new@example.com",
        role: "viewer",
        invited_by: "Ada",
        created_at: "2026-10-27T00:00:00Z",
        expires_at: "2026-11-03T00:00:00Z",
      },
    ];
    server.use(
      http.get("*/api/v1/household/invitations", () => HttpResponse.json(invitations)),
      http.delete("*/api/v1/household/invitations/7", () => {
        invitations = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp("/settings/household");

    await user.click(
      await screen.findByRole("button", { name: "Revoke invitation for new@example.com" }),
    );

    expect(await screen.findByText("No pending invitations.")).toBeVisible();
  });

  it("creates a password reset link for a member", async () => {
    signInAs(ada);
    withMembers([adaMember, basil]);
    withInvitations();
    server.use(
      http.post("*/api/v1/household/members/2/password-reset-link", () =>
        HttpResponse.json({ url: "http://localhost/reset-password/2-key" }),
      ),
    );
    const { user } = renderApp("/settings/household");

    await user.click(await screen.findByRole("button", { name: "Actions for Basil" }));
    await user.click(await screen.findByRole("menuitem", { name: "Create password reset link" }));

    // Dialogs fade in, so check the content is there rather than fully visible.
    const dialog = await screen.findByRole("dialog", { name: "Password reset link for Basil" });
    expect(
      within(dialog).getByDisplayValue("http://localhost/reset-password/2-key"),
    ).toBeInTheDocument();
  });

  it("removes a member after confirmation", async () => {
    signInAs(ada);
    let members = [adaMember, basil];
    server.use(
      http.get("*/api/v1/household/members", () => HttpResponse.json(members)),
      http.delete("*/api/v1/household/members/2", () => {
        members = [adaMember];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    withInvitations();
    const { user } = renderApp("/settings/household");

    await user.click(await screen.findByRole("button", { name: "Actions for Basil" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove from household" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove Basil?" });
    await user.click(within(dialog).getByRole("button", { name: "Remove from household" }));

    await waitFor(() => {
      expect(screen.queryByText("basil@example.com")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Basil was removed.")).toBeVisible();
  });

  it("explains when the last admin can't be demoted", async () => {
    signInAs(ada);
    withMembers([adaMember]);
    withInvitations();
    server.use(
      http.patch("*/api/v1/household/members/1", () =>
        HttpResponse.json(
          { error: { code: "last_admin", message: "x", details: {} } },
          { status: 409 },
        ),
      ),
    );
    const { user } = renderApp("/settings/household");

    const roleSelect = await screen.findByRole("combobox", { name: "Role: Ada" });
    await user.click(roleSelect);
    const listbox = document.getElementById(roleSelect.getAttribute("aria-controls") ?? "");
    if (!listbox) throw new Error("The role dropdown didn't open");
    // Mantine animates the dropdown open, so jsdom still considers the options hidden.
    await user.click(within(listbox).getByRole("option", { name: "Viewer", hidden: true }));

    expect(await screen.findByText("A household needs at least one Admin.")).toBeVisible();
  });
});
