import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadPageCode } from "./stalePages";

const gone = new TypeError("'text/html' is not a valid JavaScript MIME type for module script");

describe("loadPageCode", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns the page's code when it loads", async () => {
    const reload = vi.fn();

    await expect(loadPageCode(() => Promise.resolve({ page: 1 }), reload)).resolves.toEqual({
      page: 1,
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when the code is gone, without showing an error", async () => {
    const reload = vi.fn();

    const outcome = await Promise.race([
      loadPageCode(() => Promise.reject(gone), reload),
      new Promise((resolve) => {
        setTimeout(() => {
          resolve("waiting");
        }, 20);
      }),
    ]);

    expect(outcome).toBe("waiting");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the error when it still fails after the reload", async () => {
    const reload = vi.fn();
    sessionStorage.setItem("sunfleck:reloaded-for-update", "1");

    await expect(loadPageCode(() => Promise.reject(gone), reload)).rejects.toBe(gone);
    expect(reload).not.toHaveBeenCalled();
    // Reloading by hand later gets another try.
    expect(sessionStorage.getItem("sunfleck:reloaded-for-update")).toBeNull();
  });

  it("allows another reload for a later update once a page has loaded", async () => {
    const reload = vi.fn();
    sessionStorage.setItem("sunfleck:reloaded-for-update", "1");

    await loadPageCode(() => Promise.resolve({}), reload);
    void loadPageCode(() => Promise.reject(gone), reload);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
