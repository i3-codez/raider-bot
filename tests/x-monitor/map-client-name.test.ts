import { describe, expect, it } from "vitest";

import { mapHandleToClientName } from "../../src/domain/x-monitor/map-client-name.js";
import { X_CLIENTS } from "../../src/config/x-clients.js";

describe("mapHandleToClientName", () => {
  it("resolves every configured client handle", () => {
    for (const client of X_CLIENTS) {
      expect(mapHandleToClientName(client.handle, X_CLIENTS)).toBe(client.clientName);
    }
  });

  it("is case-insensitive", () => {
    expect(mapHandleToClientName("Meanwhile", X_CLIENTS)).toBe("Meanwhile");
    expect(mapHandleToClientName("MEANWHILE", X_CLIENTS)).toBe("Meanwhile");
  });

  it("returns undefined for an unknown handle", () => {
    expect(mapHandleToClientName("unknown_handle_xyz", X_CLIENTS)).toBeUndefined();
  });
});
