import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("give a private calendar address, shown once", async () => {
    signInAs(ada);
    let active = false;
    server.use(
      http.get("*/api/v1/notifications/calendar", () =>
        HttpResponse.json({
          active,
          created_at: active ? "2026-04-15T10:00:00Z" : null,
          last_read_at: null,
        }),
      ),
      http.post("*/api/v1/notifications/calendar", () => {
        active = true;
        return HttpResponse.json(
          { url: "https://plants.example.com/api/v1/calendar/s3cret.ics" },
          { status: 201 },
        );
      }),
    );
    const { user } = renderApp("/settings/notifications");

    await user.click(await screen.findByRole("button", { name: "Get a calendar address" }));

    expect(await screen.findByRole("textbox", { name: "Your calendar address" })).toHaveValue(
      "https://plants.example.com/api/v1/calendar/s3cret.ics",
    );
    expect(screen.getByText(/it's only shown this once/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open it in your calendar app" })).toHaveAttribute(
      "href",
      "webcal://plants.example.com/api/v1/calendar/s3cret.ics",
    );
    expect(screen.queryByRole("button", { name: "Get a calendar address" })).toBeNull();
  });

  it("say when there's a calendar address, and make a new one only when asked", async () => {
    signInAs(ada);
    let made = 0;
    server.use(
      http.get("*/api/v1/notifications/calendar", () =>
        HttpResponse.json({
          active: true,
          created_at: "2026-04-15T10:00:00Z",
          last_read_at: null,
        }),
      ),
      http.post("*/api/v1/notifications/calendar", () => {
        made += 1;
        return HttpResponse.json(
          { url: "https://plants.example.com/api/v1/calendar/new.ics" },
          { status: 201 },
        );
      }),
    );
    const { user } = renderApp("/settings/notifications");

    expect(
      await screen.findByText(/You have a calendar address.*No calendar app has read it yet\./),
    ).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Your calendar address" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "New address" }));
    expect(screen.getByText(/will stop getting updates/)).toBeVisible();
    expect(made).toBe(0);
    await user.click(screen.getByRole("button", { name: "Make a new address" }));

    expect(await screen.findByRole("textbox", { name: "Your calendar address" })).toHaveValue(
      "https://plants.example.com/api/v1/calendar/new.ics",
    );
    expect(made).toBe(1);
  });

  describe("on this device (Web Push)", () => {
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "BNcR", auth: "tBHI" },
    };

    function stubPush(permission: NotificationPermission, subscribe = true) {
      // Only its presence is checked.
      vi.stubGlobal("PushManager", function PushManager() {
        // A stand-in.
      });
      vi.stubGlobal("Notification", {
        permission: "default",
        requestPermission: () => Promise.resolve(permission),
      });
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          ready: Promise.resolve({
            pushManager: {
              subscribe: () =>
                subscribe
                  ? Promise.resolve({ toJSON: () => subscription })
                  : Promise.reject(new DOMException("push service error", "AbortError")),
            },
          }),
        },
      });
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, "serviceWorker");
    });

    it("are turned on, adding the device as a channel", async () => {
      signInAs(ada);
      stubPush("granted");
      let sent: unknown = null;
      server.use(
        http.get("*/api/v1/notifications/push/key", () =>
          HttpResponse.json({ public_key: "BIJ-mWSIT3Unc3geyfAf" }),
        ),
        http.post("*/api/v1/notifications/push/devices", async ({ request }) => {
          sent = await request.json();
          return HttpResponse.json(
            {
              id: 9,
              label: "This device",
              service: "webpush",
              enabled: true,
              last_sent_at: null,
              last_error: null,
            },
            { status: 201 },
          );
        }),
      );
      const { user } = renderApp("/settings/notifications");

      await user.click(
        await screen.findByRole("button", { name: "Get notifications on this device" }),
      );

      expect(
        await screen.findByText(
          "Notifications are on for This device. Send a test to check they arrive.",
        ),
      ).toBeVisible();
      expect(sent).toEqual({ label: "This device", subscription });
    });

    it("change nothing when notifications aren't allowed", async () => {
      signInAs(ada);
      stubPush("denied");
      let added = false;
      server.use(
        http.get("*/api/v1/notifications/push/key", () =>
          HttpResponse.json({ public_key: "BIJ-mWSIT3Unc3geyfAf" }),
        ),
        http.post("*/api/v1/notifications/push/devices", () => {
          added = true;
          return HttpResponse.json({}, { status: 201 });
        }),
      );
      const { user } = renderApp("/settings/notifications");

      await user.click(
        await screen.findByRole("button", { name: "Get notifications on this device" }),
      );

      expect(
        await screen.findByText("Notifications weren't allowed, so nothing changed."),
      ).toBeVisible();
      expect(added).toBe(false);
    });

    it("say when the browser's push service can't be reached", async () => {
      signInAs(ada);
      stubPush("granted", false);
      server.use(
        http.get("*/api/v1/notifications/push/key", () =>
          HttpResponse.json({ public_key: "BIJ-mWSIT3Unc3geyfAf" }),
        ),
      );
      const { user } = renderApp("/settings/notifications");

      await user.click(
        await screen.findByRole("button", { name: "Get notifications on this device" }),
      );

      expect(await screen.findByText(/couldn't reach its push service/)).toBeVisible();
    });

    it("say so when the browser can't get them", async () => {
      signInAs(ada);

      renderApp("/settings/notifications");

      expect(await screen.findByText(/This browser can't get notifications/)).toBeVisible();
      expect(screen.queryByRole("button", { name: "Get notifications on this device" })).toBeNull();
    });

    it("show a device like a channel, without an address to change", async () => {
      signInAs(ada);
      server.use(
        http.get("*/api/v1/notifications", () =>
          HttpResponse.json({
            preferences: {
              digest_time: "08:00:00",
              reminder_time: null,
              timezone: "Europe/Amsterdam",
            },
            channels: [
              {
                id: 9,
                label: "Pixel",
                service: "webpush",
                enabled: true,
                last_sent_at: null,
                last_error: null,
              },
            ],
          }),
        ),
      );
      const { user } = renderApp("/settings/notifications");

      expect(await screen.findByText("This app (Web Push)")).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Edit Pixel" }));
      const form = screen.getByRole("form", { name: "Edit Pixel" });
      expect(within(form).getByRole("textbox", { name: /^Name/ })).toHaveValue("Pixel");
      expect(within(form).queryByRole("textbox", { name: /address/i })).toBeNull();
    });
  });
});
