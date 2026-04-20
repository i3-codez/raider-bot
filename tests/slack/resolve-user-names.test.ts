import { describe, expect, it, vi } from "vitest";

import { resolveUserNames } from "../../src/slack/lib/resolve-user-names.js";

describe("resolveUserNames", () => {
  it("prefers display_name, falls back to real_name, then to the raw id", async () => {
    const info = vi.fn(async ({ user }: { user: string }) => {
      if (user === "U_DISPLAY") {
        return { user: { profile: { display_name: "Alex", real_name: "Alex Raider" } } };
      }
      if (user === "U_REAL_ONLY") {
        return { user: { profile: { display_name: "", real_name: "Jordan Ops" } } };
      }
      return { user: { profile: {} } };
    });

    const map = await resolveUserNames({ users: { info } }, ["U_DISPLAY", "U_REAL_ONLY", "U_NOTHING"]);

    expect(map.get("U_DISPLAY")).toBe("Alex");
    expect(map.get("U_REAL_ONLY")).toBe("Jordan Ops");
    expect(map.get("U_NOTHING")).toBe("U_NOTHING");
  });

  it("deduplicates repeated ids and falls back to the id on API failure", async () => {
    const info = vi.fn(async ({ user }: { user: string }) => {
      if (user === "U_OK") {
        return { user: { profile: { display_name: "OK User" } } };
      }
      throw new Error("missing_scope");
    });

    const map = await resolveUserNames({ users: { info } }, ["U_OK", "U_FAIL", "U_OK"]);

    expect(info).toHaveBeenCalledTimes(2);
    expect(map.get("U_OK")).toBe("OK User");
    expect(map.get("U_FAIL")).toBe("U_FAIL");
  });
});
