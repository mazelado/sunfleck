import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { ada, apiError, server, signInAs } from "../../test/server";
import { renderApp } from "../../test/render";

describe("first-run setup", () => {
  it("sends everyone to setup until the first account exists", async () => {
    server.use(http.get("*/api/v1/setup", () => HttpResponse.json({ needs_setup: true })));

    renderApp("/settings/household");

    expect(await screen.findByRole("heading", { name: "Welcome to Sunfleck" })).toBeVisible();
  });

  it("creates the account and opens the home page", async () => {
    let needsSetup = true;
    let sent: unknown;
    server.use(
      http.get("*/api/v1/setup", () => HttpResponse.json({ needs_setup: needsSetup })),
      http.post("*/api/v1/setup", async ({ request }) => {
        sent = await request.json();
        needsSetup = false;
        signInAs(ada);
        return HttpResponse.json(ada, { status: 201 });
      }),
    );
    const { user } = renderApp("/setup");

    await user.type(await screen.findByLabelText(/Your name/), "Ada");
    await user.type(screen.getByLabelText(/Email/), "ada@example.com");
    await user.type(screen.getByLabelText(/^Password/), "a long and unusual passphrase");
    await user.type(screen.getByLabelText(/Household name/), "Fern Gully");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
    expect(sent).toEqual({
      display_name: "Ada",
      email: "ada@example.com",
      password: "a long and unusual passphrase",
      household_name: "Fern Gully",
    });
  });

  it("shows why a password was rejected next to the field", async () => {
    server.use(
      http.get("*/api/v1/setup", () => HttpResponse.json({ needs_setup: true })),
      http.post("*/api/v1/setup", () =>
        apiError(422, "weak_password", { password: ["This password is too common."] }),
      ),
    );
    const { user } = renderApp("/setup");

    await user.type(await screen.findByLabelText(/Your name/), "Ada");
    await user.type(screen.getByLabelText(/Email/), "ada@example.com");
    await user.type(screen.getByLabelText(/^Password/), "password");
    await user.type(screen.getByLabelText(/Household name/), "Fern Gully");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("This password is too common.")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Please choose a stronger password.");
  });

  it("validates the form before sending it", async () => {
    server.use(http.get("*/api/v1/setup", () => HttpResponse.json({ needs_setup: true })));
    const { user } = renderApp("/setup");

    await user.type(await screen.findByLabelText(/Email/), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Enter a valid email address")).toBeVisible();
    expect(screen.getAllByText("Required")).toHaveLength(3);
  });
});

describe("signing in", () => {
  it("asks signed-out people to sign in, then returns them to the page they wanted", async () => {
    let csrfHeader: string | null = null;
    server.use(
      http.post("*/_allauth/browser/v1/auth/login", ({ request }) => {
        csrfHeader = request.headers.get("X-CSRFToken");
        signInAs(ada);
        return HttpResponse.json({ status: 200 });
      }),
    );
    document.cookie = "csrftoken=secret-token";
    const { user, router } = renderApp("/settings/profile");

    await user.type(await screen.findByLabelText(/Email/), "ada@example.com");
    await user.type(screen.getByLabelText(/^Password/), "a long and unusual passphrase");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Profile" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/settings/profile");
    expect(csrfHeader).toBe("secret-token");
  });

  it("explains a wrong email or password", async () => {
    server.use(
      http.post("*/_allauth/browser/v1/auth/login", () =>
        HttpResponse.json(
          { status: 400, errors: [{ code: "email_password_mismatch", message: "x" }] },
          { status: 400 },
        ),
      ),
    );
    const { user } = renderApp("/sign-in");

    await user.type(await screen.findByLabelText(/Email/), "ada@example.com");
    await user.type(screen.getByLabelText(/^Password/), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The email address or password is incorrect.",
    );
  });

  it("skips the sign-in page for people who are already signed in", async () => {
    signInAs(ada);

    renderApp("/sign-in");

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
  });

  it("signs out from the account menu", async () => {
    signInAs(ada);
    server.use(
      http.delete("*/_allauth/browser/v1/auth/session", () => {
        server.use(http.get("*/api/v1/me", () => apiError(401, "not_authenticated")));
        return HttpResponse.json({ status: 401 }, { status: 401 });
      }),
    );
    const { user, router } = renderApp("/plants");

    await user.click(await screen.findByRole("button", { name: /^Account menu/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeVisible();
    // Signing in again starts afresh, rather than returning to the last page.
    expect(router.state.location.search).toBe("");
  });
});

describe("passwords", () => {
  it("confirms that a reset link was requested", async () => {
    server.use(
      http.post("*/_allauth/browser/v1/auth/password/request", () =>
        HttpResponse.json({ status: 200 }),
      ),
    );
    const { user } = renderApp("/forgot-password");

    await user.type(await screen.findByLabelText(/Email/), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Send link" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "If an account exists for ada@example.com",
    );
  });

  it("sets a new password from a reset link and signs in", async () => {
    let sent: unknown;
    server.use(
      http.post("*/_allauth/browser/v1/auth/password/reset", async ({ request }) => {
        sent = await request.json();
        signInAs(ada);
        return HttpResponse.json({ status: 200 });
      }),
    );
    const { user } = renderApp("/reset-password/abc-123");

    await user.type(await screen.findByLabelText(/^New password/), "a fresh passphrase");
    await user.type(screen.getByLabelText(/Repeat/), "a fresh passphrase");
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
    expect(sent).toEqual({ key: "abc-123", password: "a fresh passphrase" });
  });

  it("checks that both new passwords match", async () => {
    const { user } = renderApp("/reset-password/abc-123");

    await user.type(await screen.findByLabelText(/^New password/), "one passphrase");
    await user.type(screen.getByLabelText(/Repeat/), "another passphrase");
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(await screen.findByText("The passwords don't match")).toBeVisible();
  });

  it("explains an invalid reset link", async () => {
    server.use(
      http.post("*/_allauth/browser/v1/auth/password/reset", () =>
        HttpResponse.json(
          { status: 400, errors: [{ code: "invalid_password_reset", message: "x", param: "key" }] },
          { status: 400 },
        ),
      ),
    );
    const { user } = renderApp("/reset-password/used");

    await user.type(await screen.findByLabelText(/^New password/), "a fresh passphrase");
    await user.type(screen.getByLabelText(/Repeat/), "a fresh passphrase");
    await user.click(screen.getByRole("button", { name: "Save password" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("invalid or has already been used");
    });
  });
});

describe("invitations", () => {
  it("greets the invited person and creates their account", async () => {
    let previews = 0;
    server.use(
      http.get("*/api/v1/invitations/:token", () => {
        previews += 1;
        return HttpResponse.json({
          household_name: "Fern Gully",
          email: "basil@example.com",
          role: "gardener",
          invited_by: "Ada",
        });
      }),
      http.post("*/api/v1/invitations/:token/accept", () => {
        signInAs({ ...ada, id: 2, email: "basil@example.com", display_name: "Basil" });
        return HttpResponse.json(ada, { status: 201 });
      }),
    );
    const { user } = renderApp("/invite/tok");

    expect(await screen.findByRole("heading", { name: "Join Fern Gully" })).toBeVisible();
    expect(screen.getByText(/Ada invited you to Sunfleck as a Gardener/)).toBeVisible();
    await user.type(screen.getByLabelText(/Your name/), "Basil");
    await user.type(screen.getByLabelText(/^Password/), "a long and unusual passphrase");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
    // The used-up invitation must not be fetched again (it would briefly show "invalid").
    expect(previews).toBe(1);
  });

  it("explains an invalid invitation link", async () => {
    server.use(http.get("*/api/v1/invitations/:token", () => apiError(404, "invitation_invalid")));

    renderApp("/invite/expired");

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid, already used, or expired");
  });
});

describe("unknown pages", () => {
  it("shows a not-found page", async () => {
    renderApp("/no/such/page");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
