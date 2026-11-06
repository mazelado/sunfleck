import { afterEach, describe, expect, it, vi } from "vitest";

import { diagnosePlant } from "./diagnosis";
import { ApiError } from "./errors";

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

const photo = { file: new Blob(["leaf"]), filename: "leaf.jpg", takenAt: null };

describe("diagnosePlant", () => {
  it("sends the photo, the description and the CSRF token", async () => {
    document.cookie = "csrftoken=secret-token";
    const answer = { summary: "Too much water.", causes: [], next_steps: [] };
    const fetch = stubFetch(new Response(JSON.stringify(answer)));

    const result = await diagnosePlant(7, {
      photo,
      description: "Yellow leaves",
      keepPhoto: true,
    });

    expect(result).toEqual(answer);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`${window.location.origin}/api/v1/plants/7/diagnosis`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "X-CSRFToken": "secret-token" });
    const body = init?.body as FormData;
    expect((body.get("file") as File).name).toBe("leaf.jpg");
    expect(body.get("description")).toBe("Yellow leaves");
    expect(body.get("keep_photo")).toBe("true");
  });

  it("turns error responses into API errors", async () => {
    const error = { error: { code: "ai_unsupported", message: "No.", details: {} } };
    stubFetch(new Response(JSON.stringify(error), { status: 502 }));

    const diagnose = diagnosePlant(7, { photo, description: "", keepPhoto: false });

    await expect(diagnose).rejects.toBeInstanceOf(ApiError);
    await expect(diagnose).rejects.toMatchObject({ code: "ai_unsupported" });
  });
});
