import { describe, expect, it } from "vitest";
import { newId } from "../src/game/core/ids";

describe("client UUIDv7", () => {
  it("is a valid v7 uuid and time-ordered", () => {
    const ids = Array.from({ length: 200 }, () => newId());
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    expect([...ids].sort()).toEqual(ids.map((x) => x)); // lexicographic == chronological within same ms batch tolerance
  });
});
