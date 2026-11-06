import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadAvatar } from "./avatar";
import { ApiError } from "./errors";

// Called directly rather than through the fake server: in tests, jsdom's FormData doesn't
// survive Node's fetch (see plants.test.ts).
function stubFetch(response: Response) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("uploadAvatar", () => {
  it("sends the picture with the CSRF token", async () => {
    document.cookie = "csrftoken=secret-token";
    const fetch = stubFetch(new Response(JSON.stringify({ id: 1, avatar_url: "/a" })));

    const me = await uploadAvatar(new Blob(["jpeg bytes"]), "me.jpg");

    expect(me).toEqual({ id: 1, avatar_url: "/a" });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`${window.location.origin}/api/v1/me/avatar`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "X-CSRFToken": "secret-token" });
    expect(((init?.body as FormData).get("file") as File).name).toBe("me.jpg");
  });

  it("sends the square chosen, as fractions of the photo", async () => {
    const fetch = stubFetch(new Response(JSON.stringify({ id: 1, avatar_url: "/a" })));

    await uploadAvatar(new Blob(["jpeg bytes"]), "me.jpg", {
      x: 0.25,
      y: 0.1,
      width: 0.5,
      height: 0.75,
    });

    const body = fetch.mock.calls[0]?.[1]?.body as FormData;
    expect(
      ["crop_x", "crop_y", "crop_width", "crop_height"].map((field) => body.get(field)),
    ).toEqual(["0.25", "0.1", "0.5", "0.75"]);
  });

  it("turns refusals into API errors", async () => {
    stubFetch(
      new Response(
        JSON.stringify({ error: { code: "invalid_image", message: "Not a photo", details: {} } }),
        { status: 422 },
      ),
    );

    await expect(uploadAvatar(new Blob(["x"]), "x.txt")).rejects.toBeInstanceOf(ApiError);
  });
});
