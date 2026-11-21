import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  initialPlayback,
  speeds,
  transition,
  type PlaybackAction,
} from "../simulation/engine";
import { formatRequest, formatResponse } from "../simulation/http";
import type { Flow } from "../simulation/schema";
import SequenceDiagram from "./SequenceDiagram";
import "../styles/simulation.css";

const channelLabels = {
  browser: "Browser channel",
  "back-channel": "Back channel",
  local: "Internal check",
} as const;

export default function SimulationPlayer(props: { flow: Flow }) {
  const [ready, setReady] = createSignal(false);
  const [state, setState] = createSignal(initialPlayback);
  const count = () => props.flow.events.length;
  const event = createMemo(() => props.flow.events[state().index]!);
  const label = (id: string) =>
    props.flow.participants.find((actor) => actor.id === id)?.label ?? id;
  const dispatch = (action: PlaybackAction) =>
    setState((previous) => transition(previous, action, count()));
  onMount(() => setReady(true));

  createEffect(() => {
    const playback = state();
    if (!playback.playing) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "tick" }),
      1950 / playback.speed,
    );
    onCleanup(() => window.clearTimeout(timer));
  });

  return (
    <div class="simulation">
      <div class="simulation-top">
        <div>
          <strong>{props.flow.title}</strong>
          <span>Simulated traffic</span>
        </div>
        <fieldset class="simulation-controls" disabled={!ready()}>
          <legend class="sr-only">Playback controls</legend>
          <button
            type="button"
            class="sim-button"
            onClick={() => dispatch({ type: "reset" })}
          >
            Reset
          </button>
          <button
            type="button"
            class="sim-button"
            disabled={state().index === 0}
            onClick={() => dispatch({ type: "previous" })}
          >
            Previous
          </button>
          <button
            type="button"
            class="sim-button play"
            disabled={count() < 2}
            onClick={() => dispatch({ type: "toggle" })}
          >
            {state().playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            class="sim-button"
            disabled={state().index === count() - 1}
            onClick={() => dispatch({ type: "next" })}
          >
            Next
          </button>
          <label class="sim-speed">
            Speed
            <select
              value={state().speed}
              onChange={(change) => {
                const speed = speeds.find(
                  (value) => value === Number(change.currentTarget.value),
                );
                if (speed !== undefined)
                  dispatch({ type: "speed", value: speed });
              }}
            >
              <For each={speeds}>
                {(speed) => (
                  <option value={speed} selected={speed === state().speed}>
                    {speed}×
                  </option>
                )}
              </For>
            </select>
          </label>
        </fieldset>
      </div>
      <div class="simulation-body">
        <div class="diagram-pane">
          <SequenceDiagram
            flow={props.flow}
            index={state().index}
            speed={state().speed}
          />
          <div class="diagram-key">
            <span>
              <i class="dashed" /> Browser channel
            </span>
            <span>
              <i /> Back channel
            </span>
            <span>
              <b aria-hidden="true">↪</b> Internal check
            </span>
          </div>
        </div>
        <div class="inspector">
          <label class="event-picker">
            Jump to step
            <select
              disabled={!ready()}
              value={state().index}
              onChange={(change) =>
                dispatch({
                  type: "select",
                  index: Number(change.currentTarget.value),
                })
              }
            >
              <For each={props.flow.events}>
                {(event, index) => (
                  <option value={index()}>
                    {index() + 1}. {event.title}
                  </option>
                )}
              </For>
            </select>
          </label>
          <div class="event-summary" aria-live="polite" aria-atomic="true">
            <p class="event-meta">
              Step {state().index + 1} of {count()}{" "}
              <span>{channelLabels[event().channel]}</span>
            </p>
            <p class="event-title">{event().title}</p>
            <p class="event-route">
              {label(event().from)}
              {event().from !== event().to && (
                <>
                  {" "}
                  <span aria-hidden="true">→</span>
                  <span class="sr-only"> to </span> {label(event().to)}
                </>
              )}
            </p>
          </div>
          <p>{event().explanation}</p>
          <Show when={event().security}>
            {(security) => (
              <p class="event-security">
                <strong>Security</strong> {security()}
              </p>
            )}
          </Show>
          <Show when={event().request}>
            {(request) => (
              <div class="http-message">
                <p>HTTP request</p>
                <pre>
                  <code>{formatRequest(request())}</code>
                </pre>
              </div>
            )}
          </Show>
          <Show when={event().response}>
            {(response) => (
              <div class="http-message">
                <p>HTTP response</p>
                <pre>
                  <code>{formatResponse(response())}</code>
                </pre>
              </div>
            )}
          </Show>
          <ul class="event-references" aria-label="Specifications">
            <For each={event().references}>
              {(reference) => (
                <li>
                  <a href={reference.url}>{reference.label}</a>
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>
    </div>
  );
}
