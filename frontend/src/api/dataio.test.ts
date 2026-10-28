import { afterEach, describe, expect, it, vi } from "vitest";

import { importExport } from "./dataio";
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

describe("importExport", () => {
  it("sends the file and the CSRF token", async () => {
    document.cookie = "csrftoken=secret-token";
    const fetch = stubFetch(new Response(JSON.stringify({ plants: 2 })));

    const summary = await importExport(new File(["zip"], "export.zip"));

    expect(summary).toEqual({ plants: 2 });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`${window.location.origin}/api/v1/import`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "X-CSRFToken": "secret-token" });
    expect(((init?.body as FormData).get("file") as File).name).toBe("export.zip");
  });

  it("turns error responses into API errors", async () => {
    const error = { error: { code: "household_not_empty", message: "No.", details: {} } };
    stubFetch(new Response(JSON.stringify(error), { status: 409 }));

    const result = importExport(new File(["zip"], "export.zip"));

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ code: "household_not_empty" });
  });
});
