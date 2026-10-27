import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";
import { uploadPhoto } from "./plants";

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

describe("uploadPhoto", () => {
  it("sends the file, its caption and date, and the CSRF token", async () => {
    document.cookie = "csrftoken=secret-token";
    const fetch = stubFetch(new Response(JSON.stringify({ id: 5 }), { status: 201 }));
    const file = new Blob(["jpeg bytes"], { type: "image/jpeg" });

    const photo = await uploadPhoto(7, {
      file,
      filename: "monty.jpg",
      caption: "New leaf",
      takenAt: "2026-05-01T12:30:00",
    });

    expect(photo).toEqual({ id: 5 });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`${window.location.origin}/api/v1/plants/7/photos`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "X-CSRFToken": "secret-token" });
    const body = init?.body as FormData;
    expect((body.get("file") as File).name).toBe("monty.jpg");
    expect(await (body.get("file") as File).text()).toBe("jpeg bytes");
    expect(body.get("caption")).toBe("New leaf");
    expect(body.get("taken_at")).toBe("2026-05-01T12:30:00");
  });

  it("leaves out a caption and date it doesn't have", async () => {
    const fetch = stubFetch(new Response(JSON.stringify({ id: 5 }), { status: 201 }));

    await uploadPhoto(7, { file: new Blob(["x"]), filename: "a.jpg", takenAt: null });

    const body = fetch.mock.calls[0]?.[1]?.body as FormData;
    expect([...body.keys()]).toEqual(["file"]);
  });

  it("turns error responses into API errors", async () => {
    const error = { error: { code: "invalid_image", message: "No.", details: { field: "file" } } };
    stubFetch(new Response(JSON.stringify(error), { status: 422 }));

    const upload = uploadPhoto(7, { file: new Blob(["x"]), filename: "a.pdf" });

    await expect(upload).rejects.toBeInstanceOf(ApiError);
    await expect(upload).rejects.toMatchObject({ code: "invalid_image" });
  });
});
