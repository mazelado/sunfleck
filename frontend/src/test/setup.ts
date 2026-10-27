import "@testing-library/jest-dom/vitest";

import { notifications } from "@mantine/notifications";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

// Any request a test didn't plan for is a bug in the test or the app, so it fails the test.
const unexpectedRequests: string[] = [];

beforeAll(() => {
  server.listen({
    onUnhandledFrame({ frame, defaults }) {
      const { request } = frame.data as { request?: Request };
      unexpectedRequests.push(request ? `${request.method} ${request.url}` : frame.protocol);
      defaults.error();
    },
  });
});

afterEach(() => {
  const unexpected = unexpectedRequests.splice(0);
  if (unexpected.length > 0) {
    throw new Error(`The test made requests nobody expected:\n${unexpected.join("\n")}`);
  }
});

afterEach(() => {
  cleanup();
  notifications.clean(); // notifications live in a global store, not in the rendered tree
  server.resetHandlers();
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

afterAll(() => {
  server.close();
});

// jsdom doesn't implement these browser APIs, which Mantine uses.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub;
Element.prototype.scrollIntoView = () => undefined;
// Textareas that grow with their text listen for web fonts loading.
Object.defineProperty(document, "fonts", {
  value: { addEventListener: () => undefined, removeEventListener: () => undefined },
});
