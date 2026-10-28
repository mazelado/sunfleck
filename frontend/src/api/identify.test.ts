import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";
import { identifyPlant } from "./identify";

// Called directly rather than through the fake server: in tests, jsdom's FormData doesn't
// survive Node's fetch, so this checks exactly what the browser would send.
function stubFetch(response: Response) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("identifyPlant", () => {
  it("sends the photos and the CSRF token", async () => {
    document.cookie = "csrftoken=secret-token";
    const answer = { attribution: "Identified by Test", candidates: [], remaining: 3 };
    const fetch = stubFetch(new Response(JSON.stringify(answer)));

    const result = await identifyPlant([
      { file: new Blob(["leaf"]), filename: "leaf.jpg", takenAt: null },
      { file: new Blob(["flower"]), filename: "flower.jpg", takenAt: null },
    ]);

    expect(result).toEqual(answer);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`${window.location.origin}/api/v1/identify`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "X-CSRFToken": "secret-token" });
    const photos = (init?.body as FormData).getAll("photos") as File[];
    expect(photos.map((photo) => photo.name)).toEqual(["leaf.jpg", "flower.jpg"]);
  });

  it("turns error responses into API errors", async () => {
    const error = { error: { code: "quota_exceeded", message: "No.", details: {} } };
    stubFetch(new Response(JSON.stringify(error), { status: 429 }));

    const identify = identifyPlant([{ file: new Blob(["x"]), filename: "a.jpg", takenAt: null }]);

    await expect(identify).rejects.toBeInstanceOf(ApiError);
    await expect(identify).rejects.toMatchObject({ code: "quota_exceeded" });
  });
});
