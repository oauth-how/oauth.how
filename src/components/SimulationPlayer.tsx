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
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  ListTree,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Terminal,
} from "lucide-solid";
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

export default function SimulationPlayer(props: {
  flow: Flow;
  compact?: boolean;
}) {
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
    <div class="simulation" classList={{ "simulation-compact": props.compact }}>
      <div class="simulation-top">
        <div class="simulation-name">
          <ListTree size={18} strokeWidth={1.75} aria-hidden="true" />
          <strong>
            {props.compact ? props.flow.title : "Sequence and HTTP"}
          </strong>
        </div>
        <span class="simulation-status">
          <Radio size={15} strokeWidth={1.7} aria-hidden="true" />
          {props.compact ? "Interactive demo" : "Simulated traffic"}
        </span>
      </div>
      <fieldset class="simulation-controls" disabled={!ready()}>
        <legend class="sr-only">Playback controls</legend>
        <div class="control-buttons">
          <Show when={!props.compact}>
            <button
              type="button"
              class="sim-button"
              aria-label="Reset"
              title="Reset"
              onClick={() => dispatch({ type: "reset" })}
            >
              <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Reset</span>
            </button>
          </Show>
          <button
            type="button"
            class="sim-button"
            aria-label="Previous"
            title="Previous"
            disabled={state().index === 0}
            onClick={() => dispatch({ type: "previous" })}
          >
            <ChevronLeft size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>Previous</span>
          </button>
          <button
            type="button"
            class="sim-button play"
            disabled={count() < 2}
            onClick={() => dispatch({ type: "toggle" })}
          >
            <Show
              when={state().playing}
              fallback={<Play size={15} strokeWidth={1.8} aria-hidden="true" />}
            >
              <Pause size={15} strokeWidth={1.8} aria-hidden="true" />
            </Show>
            <span>{state().playing ? "Pause" : "Play"}</span>
          </button>
          <button
            type="button"
            class="sim-button"
            aria-label="Next"
            title="Next"
            disabled={state().index === count() - 1}
            onClick={() => dispatch({ type: "next" })}
          >
            <span>Next</span>
            <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <Show when={!props.compact}>
          <label class="sim-speed">
            <span>Speed</span>
            <span class="select-field">
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
              <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
            </span>
          </label>
        </Show>
      </fieldset>
      <div class="simulation-body">
        <div class="diagram-pane">
          <Show when={!props.compact}>
            <div class="diagram-heading">
              <span>Protocol trace</span>
              <span>
                {props.flow.participants.length} actors · {count()} steps
              </span>
            </div>
          </Show>
          <SequenceDiagram
            flow={props.flow}
            index={state().index}
            speed={state().speed}
            compact={Boolean(props.compact)}
          />
          <Show when={!props.compact}>
            <div class="diagram-key">
              <span>
                <i class="key-request" /> Request
              </span>
              <span>
                <i class="key-response" /> Response
              </span>
              <span>
                <CornerDownRight size={15} aria-hidden="true" /> Internal check
              </span>
            </div>
            <p class="diagram-note">
              Dashed messages travel through the browser.
            </p>
          </Show>
        </div>
        <div class="inspector">
          <Show when={!props.compact}>
            <label class="event-picker">
              <span>Jump to step</span>
              <span class="select-field">
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
                <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
              </span>
            </label>
          </Show>
          <div class="event-summary" aria-live="polite" aria-atomic="true">
            <p class="event-meta">
              <span class="event-step">
                Step {state().index + 1} of {count()}
              </span>
              <span class="event-channel">
                {channelLabels[event().channel]}
              </span>
            </p>
            <p class="event-title">{event().title}</p>
            <p class="event-route">
              {label(event().from)}
              {event().from !== event().to && (
                <>
                  <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                  <span class="sr-only"> to </span>
                  {label(event().to)}
                </>
              )}
            </p>
          </div>
          <Show when={!props.compact}>
            <p class="event-explanation">{event().explanation}</p>
            <Show when={event().security}>
              {(security) => (
                <p class="event-security">
                  <strong>
                    <ShieldCheck
                      size={16}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    Security
                  </strong>{" "}
                  {security()}
                </p>
              )}
            </Show>
          </Show>

          <Show when={event().request}>
            {(request) => (
              <div class="http-message" data-tone="request">
                <p>
                  <ArrowUpRight
                    size={16}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  HTTP request
                </p>
                <pre
                  tabIndex={props.compact ? 0 : undefined}
                  aria-label="HTTP request excerpt"
                >
                  <code>{formatRequest(request())}</code>
                </pre>
              </div>
            )}
          </Show>
          <Show when={(!props.compact || !event().request) && event().response}>
            {(response) => (
              <div class="http-message" data-tone="response">
                <p>
                  <ArrowDownLeft
                    size={16}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  HTTP response
                </p>
                <pre
                  tabIndex={props.compact ? 0 : undefined}
                  aria-label="HTTP response excerpt"
                >
                  <code>{formatResponse(response())}</code>
                </pre>
              </div>
            )}
          </Show>
          <Show when={props.compact && !event().request && !event().response}>
            <p class="preview-explanation">
              <Terminal size={16} strokeWidth={1.8} aria-hidden="true" />
              {event().explanation}
            </p>
          </Show>
          <Show when={!props.compact}>
            <ul class="event-references" aria-label="Specifications">
              <For each={event().references}>
                {(reference) => (
                  <li>
                    <a href={reference.url}>{reference.label}</a>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </div>
  );
}
