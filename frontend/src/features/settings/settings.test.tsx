import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Me, Member } from "../../api/accounts";
import { accessibilityProblems } from "../../test/axe";
import { ada, basil, server, signInAs } from "../../test/server";
import { renderApp } from "../../test/render";

// Uploads are checked in api/accounts.test.ts: jsdom's FormData doesn't survive Node's fetch.
const { uploadAvatar } = vi.hoisted(() => ({ uploadAvatar: vi.fn() }));
vi.mock("../../api/avatar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/avatar")>()),
  uploadAvatar,
}));

afterEach(() => {
  uploadAvatar.mockReset();
});

const adaMember: Member = {
  id: 1,
  user_id: 1,
  email: ada.email,
  display_name: "Ada",
  avatar_url: null,
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

  it("shows the profile picture, everywhere, and removes it", async () => {
    signInAs({ ...ada, avatar_url: "/api/v1/people/1/avatar?v=abc" });
    server.use(
      http.delete("*/api/v1/me/avatar", () => HttpResponse.json({ ...ada, avatar_url: null })),
    );
    const { user, router } = renderApp("/");

    // In the header of the main pages, as decoration: the button says whose menu it is.
    const accountButton = await screen.findByRole("button", { name: "Account menu: Ada" });
    expect(accountButton.querySelector("img")).toHaveAttribute("alt", "");
    await router.navigate("/settings/profile");
    expect(await screen.findByRole("img", { name: "Your profile picture" })).toHaveAttribute(
      "src",
      "/api/v1/people/1/avatar?v=abc",
    );

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByRole("button", { name: "Choose a picture" })).toBeVisible();
    expect(screen.queryByRole("img", { name: "Your profile picture" })).not.toBeInTheDocument();
  });

  it("frames a new profile picture before saving it", async () => {
    signInAs(ada);
    uploadAvatar.mockResolvedValue({ ...ada, avatar_url: "/api/v1/people/1/avatar?v=new" });
    const { user } = renderApp("/settings/profile");

    await screen.findByRole("button", { name: "Choose a picture" });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("No file input");
    const chosen = new File(["not really a jpeg"], "me.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, chosen);

    const dialog = await screen.findByRole("dialog", { name: "Frame your picture" });
    expect(within(dialog).getByRole("slider", { name: "Zoom" })).toBeVisible();
    expect(await accessibilityProblems(dialog)).toEqual([]);
    // Nothing is uploaded until it's saved.
    expect(uploadAvatar).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Profile picture saved")).toBeVisible();
    // The test environment can't show images, so no square was chosen: the server takes the
    // middle.
    expect(uploadAvatar).toHaveBeenCalledWith(chosen, "me.jpg", null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("frames the profile picture again, from the photo it was cut from", async () => {
    const crop = { x: 0.1, y: 0.2, width: 0.5, height: 0.5 };
    const me: Me = {
      ...ada,
      avatar_url: "/api/v1/people/1/avatar?v=abc",
      avatar_source_url: "/api/v1/me/avatar/source?v=src",
      avatar_crop: crop,
    };
    signInAs(me);
    const sent: unknown[] = [];
    server.use(
      http.put("*/api/v1/me/avatar/crop", async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ ...me, avatar_url: "/api/v1/people/1/avatar?v=new" });
      }),
    );
    const { user } = renderApp("/settings/profile");

    // From the Adjust button, or by tapping the picture.
    await user.click(await screen.findByRole("button", { name: "Adjust your profile picture" }));
    let dialog = await screen.findByRole("dialog", { name: "Frame your picture" });
    expect(dialog.querySelector("img")).toHaveAttribute("src", me.avatar_source_url);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Adjust" }));
    dialog = await screen.findByRole("dialog", { name: "Frame your picture" });
    // It starts from the saved square (the test environment can't move it).
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Profile picture saved")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Adjust" }));
    dialog = await screen.findByRole("dialog", { name: "Frame your picture" });
    await user.click(within(dialog).getByRole("button", { name: "Use the middle of the photo" }));
    await waitFor(() => {
      expect(sent).toEqual([{ crop }, { crop: null }]);
    });
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it("can't adjust a picture set before its photo was kept", async () => {
    signInAs({ ...ada, avatar_url: "/api/v1/people/1/avatar?v=abc" });

    renderApp("/settings/profile");

    expect(await screen.findByRole("img", { name: "Your profile picture" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Change" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Adjust/ })).not.toBeInTheDocument();
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

describe("settings page", () => {
  it("is a gear away, and says what each setting is for", async () => {
    signInAs(ada);
    withMembers([adaMember]);
    withInvitations();
    const { user, router } = renderApp("/");

    await user.click(await screen.findByRole("link", { name: "Settings" }));

    expect(await screen.findByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    expect(await accessibilityProblems(document.body)).toEqual([]);
    expect(screen.getByText(/invite people, and choose who can do what/)).toBeVisible();
    expect(screen.getByText(/Reminders of what needs care/)).toBeVisible();
    // A shortcut to inviting someone, which goes straight to the email field.
    await user.click(screen.getByRole("link", { name: "Invite someone" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings/household");
    });
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Their email address/ })).toHaveFocus();
    });
    // The page has loaded its members too, so no request is left for the next test.
    expect(await screen.findByText(ada.email)).toBeVisible();
  });

  it("leaves the account menu for things about you", async () => {
    signInAs(ada);
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: /^Account menu/ }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Profile" })).toBeVisible();
    expect(within(menu).getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(within(menu).queryByRole("menuitem", { name: "Household" })).toBeNull();
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

    // Inviting comes first, in its own card; the household's name, with its own Save, last.
    const headings = (await screen.findAllByRole("heading", { level: 2 })).map(
      (heading) => heading.textContent,
    );
    expect(headings[0]).toBe("Invite someone");
    expect(headings.at(-1)).toBe("Household name");
    await user.type(await screen.findByLabelText(/Their email address/), "new@example.com");
    await user.click(screen.getByRole("button", { name: "Create invitation" }));

    const status = await screen.findByRole("status");
    expect(within(status).getByText(/No email server is set up/)).toBeVisible();
    expect(within(status).getByDisplayValue("http://localhost/invite/secret")).toBeVisible();
    expect(sent).toEqual({ email: "new@example.com", role: "gardener" });
  });

  it("asks before leaving with an email typed but nobody invited", async () => {
    signInAs(ada);
    withMembers([adaMember]);
    withInvitations();
    const { user } = renderApp("/settings/household");

    await user.type(await screen.findByLabelText(/Their email address/), "new@example.com");
    await user.click(screen.getAllByRole("link", { name: "Plants" })[0] as HTMLElement);

    const dialog = await screen.findByRole("dialog", { name: "Leave without inviting them?" });
    expect(
      within(dialog).getByText(/nobody is invited until you press Create invitation/),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText(/Their email address/)).toHaveValue("new@example.com");
  });

  it("keeps the household name's Save off until the name changes", async () => {
    signInAs(ada);
    withMembers([adaMember]);
    withInvitations();
    let sent: unknown;
    server.use(
      http.patch("*/api/v1/household", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...ada.household, name: "Fern Gully!" });
      }),
    );
    const { user } = renderApp("/settings/household");

    const name = await screen.findByRole("textbox", { name: "Household name" });
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.type(name, "!");
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => {
      expect(sent).toEqual({ name: "Fern Gully!" });
    });
    await waitFor(() => {
      expect(save).toBeDisabled();
    });
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
