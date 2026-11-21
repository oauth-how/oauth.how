export const speeds = [0.5, 1, 1.5, 2] as const;
export type Speed = (typeof speeds)[number];

export interface PlaybackState {
  index: number;
  playing: boolean;
  speed: Speed;
}

export type PlaybackAction =
  | { type: "next" | "previous" | "toggle" | "tick" | "reset" }
  | { type: "select"; index: number }
  | { type: "speed"; value: Speed };

export const initialPlayback: PlaybackState = {
  index: 0,
  playing: false,
  speed: 1,
};

export function transition(
  state: PlaybackState,
  action: PlaybackAction,
  count: number,
): PlaybackState {
  const last = Math.max(0, count - 1);
  const select = (index: number): PlaybackState => ({
    ...state,
    index: Math.max(0, Math.min(index, last)),
    playing: false,
  });

  switch (action.type) {
    case "next":
      return select(state.index + 1);
    case "previous":
      return select(state.index - 1);
    case "select":
      return Number.isInteger(action.index) ? select(action.index) : state;
    case "reset":
      return select(0);
    case "speed":
      return { ...state, speed: action.value };
    case "toggle":
      if (last === 0) return state;
      if (state.playing) return { ...state, playing: false };
      return {
        ...state,
        index: state.index === last ? 0 : state.index,
        playing: true,
      };
    case "tick": {
      if (!state.playing) return state;
      const index = Math.min(last, state.index + 1);
      return { ...state, index, playing: index < last };
    }
  }
}
