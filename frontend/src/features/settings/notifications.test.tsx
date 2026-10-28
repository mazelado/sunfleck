import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Channel } from "../../api/notifications";
import { renderApp } from "../../test/render";
import { ada, apiError, server, signInAs } from "../../test/server";

const phone: Channel = {
  id: 7,
  label: "My phone",
  service: "ntfy",
  enabled: true,
  last_sent_at: null,
  last_error: null,
};

function withChannels(channels: Channel[]) {
  server.use(
    http.get("*/api/v1/notifications", () =>
      HttpResponse.json({
        preferences: {
          digest_time: "08:00:00",
          reminder_time: null,
          timezone: "Europe/Amsterdam",
        },
        channels,
      }),
    ),
  );
}

describe("notifications", () => {
  it("are in everyone's menu", async () => {
    signInAs({ ...ada, role: "viewer" });
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: /^Account menu/ }));
    expect(await screen.findByRole("menuitem", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/settings/notifications",
    );
  });

  it("get a channel from an Apprise URL", async () => {
    signInAs(ada);
    let sent: unknown = null;
    server.use(
      http.post("*/api/v1/notifications/channels", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(phone, { status: 201 });
      }),
    );
    const { user } = renderApp("/settings/notifications");

    expect(await screen.findByText(/Add somewhere to send them/)).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "My phone");
    await user.type(
      screen.getByRole("textbox", { name: "Address (Apprise URL)" }),
      "ntfy://ntfy.sh/my-plants",
    );
    await user.click(screen.getByRole("button", { name: "Add a channel" }));

    await waitFor(() => {
      expect(sent).toEqual({ label: "My phone", url: "ntfy://ntfy.sh/my-plants" });
    });
  });

  it("show an address Apprise doesn't know at its field", async () => {
    signInAs(ada);
    server.use(
      http.post("*/api/v1/notifications/channels", () =>
        apiError(422, "unsupported_channel_url", { field: "url" }),
      ),
    );
    const { user } = renderApp("/settings/notifications");

    await user.type(await screen.findByRole("textbox", { name: "Name" }), "Phone");
    const url = screen.getByRole("textbox", { name: "Address (Apprise URL)" });
    await user.type(url, "nope://x");
    await user.click(screen.getByRole("button", { name: "Add a channel" }));

    await waitFor(() => {
      expect(url).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("send a test, and show why one failed", async () => {
    signInAs(ada);
    withChannels([phone]);
    server.use(
      http.post("*/api/v1/notifications/channels/7/test", () => {
        withChannels([{ ...phone, last_error: "ntfy: 401 Unauthorized" }]);
        return apiError(422, "delivery_failed");
      }),
    );
    const { user } = renderApp("/settings/notifications");

    expect(await screen.findByText("ntfy")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Send a test" }));

    expect(await screen.findByText("Last attempt failed: ntfy: 401 Unauthorized")).toBeVisible();
  });

  it("can be renamed or given a new address", async () => {
    signInAs(ada);
    withChannels([phone]);
    const sent: unknown[] = [];
    server.use(
      http.put("*/api/v1/notifications/channels/7", async ({ request }) => {
        sent.push(await request.json());
        return sent.length === 1
          ? apiError(422, "unsupported_channel_url", { field: "url" })
          : HttpResponse.json({ ...phone, label: "Email", service: "mailto" });
      }),
    );
    const { user } = renderApp("/settings/notifications");

    await user.click(await screen.findByRole("button", { name: "Edit My phone" }));
    const form = within(screen.getByRole("form", { name: "Edit My phone" }));
    const name = form.getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("My phone");
    const address = form.getByRole("textbox", { name: "New address (Apprise URL)" });
    // The current address is never shown.
    expect(address).toHaveValue("");
    await user.clear(name);
    await user.type(name, "Email");
    await user.type(address, "pager://1");
    await user.click(form.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(address).toHaveAttribute("aria-invalid", "true");
    });
    await user.clear(address);
    await user.type(address, "mailto://ada:secret@example.com");
    await user.click(form.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "New address (Apprise URL)" })).toBeNull();
    });
    expect(sent).toEqual([
      { label: "Email", enabled: true, url: "pager://1" },
      { label: "Email", enabled: true, url: "mailto://ada:secret@example.com" },
    ]);
  });

  it("keep their address when only renamed", async () => {
    signInAs(ada);
    withChannels([phone]);
    let sent: unknown = null;
    server.use(
      http.put("*/api/v1/notifications/channels/7", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(phone);
      }),
    );
    const { user } = renderApp("/settings/notifications");

    await user.click(await screen.findByRole("button", { name: "Edit My phone" }));
    const form = within(screen.getByRole("form", { name: "Edit My phone" }));
    await user.type(form.getByRole("textbox", { name: "Name" }), " 2");
    await user.click(form.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(sent).toEqual({ label: "My phone 2", enabled: true, url: null });
    });
  });

  it("can be paused per channel", async () => {
    signInAs(ada);
    withChannels([phone]);
    let sent: unknown = null;
    server.use(
      http.put("*/api/v1/notifications/channels/7", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...phone, enabled: false });
      }),
    );
    const { user } = renderApp("/settings/notifications");

    await user.click(await screen.findByRole("switch", { name: "In use" }));

    await waitFor(() => {
      expect(sent).toEqual({ label: "My phone", enabled: false });
    });
  });

  it("are sent at the chosen times", async () => {
    signInAs(ada);
    let sent: unknown = null;
    server.use(
      http.put("*/api/v1/notifications/preferences", async ({ request }) => {
        const body = (await request.json()) as Record<string, string | null>;
        sent = body;
        return HttpResponse.json(body);
      }),
    );
    const { user } = renderApp("/settings/notifications");

    const digest = await screen.findByLabelText(/Daily digest at/);
    expect(digest).toHaveValue("08:00");
    await user.clear(digest);
    await user.type(digest, "07:30");
    await user.click(screen.getByRole("switch", { name: /Evening reminder/ }));
    expect(screen.getByLabelText(/Evening reminder at/)).toHaveValue("19:00");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(sent).toEqual({
        digest_time: "07:30",
        reminder_time: "19:00",
        timezone: "Europe/Amsterdam",
      });
    });
  });

  it("preview today's digest", async () => {
    signInAs(ada);
    server.use(
      http.get("*/api/v1/notifications/preview", () =>
        HttpResponse.json({
          message: {
            title: "2 plants need care today",
            body: "Living room: Water Monty (2 days overdue), Mist Fern",
          },
        }),
      ),
    );
    renderApp("/settings/notifications");

    const preview = (await screen.findByText("2 plants need care today")).closest("div");
    expect(preview).not.toBeNull();
    expect(
      within(preview as HTMLElement).getByText(
        "Living room: Water Monty (2 days overdue), Mist Fern",
      ),
    ).toBeVisible();
  });

  it("say when there's nothing to send today", async () => {
    signInAs(ada);
    renderApp("/settings/notifications");

    expect(await screen.findByText(/Nothing needs care today/)).toBeVisible();
  });
});
