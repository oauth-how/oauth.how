import { describe, expect, it } from "vitest";
import {
  initialPlayback,
  transition,
  type PlaybackAction,
} from "../../src/simulation/engine";

const run = (count: number, ...actions: PlaybackAction[]) =>
  actions.reduce(
    (state, action) => transition(state, action, count),
    initialPlayback,
  );

describe("deterministic playback", () => {
  it("clamps navigation and ignores ticks while paused", () => {
    expect(run(3, { type: "previous" }, { type: "tick" })).toEqual(
      initialPlayback,
    );
    expect(run(3, { type: "select", index: 99 }, { type: "next" }).index).toBe(
      2,
    );
    expect(run(3, { type: "select", index: NaN })).toEqual(initialPlayback);
  });

  it("stops on the last event and restarts from the beginning on play", () => {
    expect(
      run(3, { type: "toggle" }, { type: "tick" }, { type: "tick" }),
    ).toEqual({ ...initialPlayback, index: 2 });
    expect(run(3, { type: "select", index: 2 }, { type: "toggle" })).toEqual({
      ...initialPlayback,
      playing: true,
    });
    expect(run(1, { type: "toggle" })).toEqual(initialPlayback);
  });

  it("pauses when stepping and preserves playback speed on reset", () => {
    expect(
      run(
        3,
        { type: "toggle" },
        { type: "speed", value: 2 },
        { type: "next" },
        { type: "tick" },
      ),
    ).toEqual({ index: 1, playing: false, speed: 2 });
    expect(run(3, { type: "speed", value: 0.5 }, { type: "reset" })).toEqual({
      ...initialPlayback,
      speed: 0.5,
    });
  });
});
