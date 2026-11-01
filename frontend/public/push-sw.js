// Web Push, added to the service worker that vite-plugin-pwa makes (see vite.config.ts):
// shows Sunfleck's notifications, and opens the app on the page they're about when tapped.
/* global clients */

self.addEventListener("push", (event) => {
  let message;
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "Sunfleck", {
      body: message.body || "",
      icon: "/icons/icon-192.png",
      // One notification at a time: today's replaces yesterday's.
      tag: "sunfleck",
      data: { url: message.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open) {
        return open.navigate(url).then((client) => (client || open).focus());
      }
      return clients.openWindow(url);
    }),
  );
});
