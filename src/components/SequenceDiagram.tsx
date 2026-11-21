import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { AppWindow, Braces, Network, Server, ShieldCheck } from "lucide-solid";
import type { Flow, FlowEvent } from "../simulation/schema";
import type { Speed } from "../simulation/engine";

interface Props {
  flow: Flow;
  index: number;
  speed: Speed;
  compact?: boolean;
}

const trafficTones = [
  "request",
  "response",
  "interaction",
  "internal",
] as const;

const actorIcons: Record<string, typeof AppWindow> = {
  browser: AppWindow,
  client: Braces,
  "authorization-server": ShieldCheck,
  api: Server,
};

function trafficTone(event: FlowEvent) {
  if (event.channel === "local") return "internal";
  if (event.request) return "request";
  if (event.response) return "response";
  return "interaction";
}

function rowLabel(event: FlowEvent) {
  if (event.request) return event.request.method;
  if (event.response) return String(event.response.status);
  if (event.kind === "authentication") return "AUTH";
  if (event.kind === "consent") return "CONSENT";
  return event.channel === "local" ? "CHECK" : "EVENT";
}

export default function SequenceDiagram(props: Props) {
  const id = createUniqueId();
  const [allowMotion, setAllowMotion] = createSignal(false);
  const rowHeight = 24;
  const headerHeight = 78;
  const width = Math.max(470, 88 + props.flow.participants.length * 95);
  const visibleCount = () =>
    props.compact
      ? Math.min(3, props.flow.events.length)
      : props.flow.events.length;
  const firstRow = () =>
    props.compact
      ? Math.min(
          Math.max(0, props.index - 1),
          props.flow.events.length - visibleCount(),
        )
      : 0;
  const visibleEvents = () =>
    props.flow.events.slice(firstRow(), firstRow() + visibleCount());
  const height = () => headerHeight + visibleCount() * rowHeight + 5;
  const lane = (index: number) =>
    86 + ((index + 0.5) * (width - 96)) / props.flow.participants.length;
  const position = (id: string) =>
    lane(
      props.flow.participants.findIndex((participant) => participant.id === id),
    );
  const row = (index: number) => headerHeight + index * rowHeight - 4;
  const selected = () => props.flow.events[props.index];
  const selectedTone = () => {
    const event = selected();
    return event && trafficTone(event);
  };
  const active = (id: string) =>
    selected()?.from === id || selected()?.to === id;
  let packet: SVGCircleElement | undefined;

  onMount(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAllowMotion(!preference.matches);
    update();
    preference.addEventListener("change", update);
    onCleanup(() => preference.removeEventListener("change", update));
  });

  createEffect(() => {
    const event = selected();
    if (!event || !allowMotion() || !packet?.animate || event.from === event.to)
      return;
    const offset = position(event.from) - position(event.to);
    const animation = packet.animate(
      [
        { transform: `translateX(${offset}px)`, opacity: 1 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      { duration: 580 / props.speed, easing: "ease-out" },
    );
    onCleanup(() => animation.cancel());
  });

  return (
    <div class="sequence-scroll">
      <svg
        class="sequence"
        style={{ "min-width": `${Math.ceil(width * 0.7)}px` }}
        viewBox={`0 0 ${width} ${height()}`}
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
      >
        <title id={`${id}-title`}>
          {props.compact
            ? "Authorization Code with PKCE preview"
            : `${props.flow.title} sequence diagram`}
        </title>
        <desc id={`${id}-description`}>
          {props.flow.participants.map(({ label }) => label).join(", ")}.
          Highlighted step {props.index + 1}: {selected()?.title}.
        </desc>
        <defs>
          <For each={trafficTones}>
            {(tone) => (
              <For each={[false, true]}>
                {(active) => (
                  <marker
                    id={`${id}-arrow-${tone}${active ? "-active" : ""}`}
                    class="sequence-arrow"
                    classList={{ "is-active": active }}
                    data-tone={tone}
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                    markerWidth="7"
                    markerHeight="7"
                    refX="7"
                    refY="3.5"
                  >
                    <path d="M0 0L7 3.5 0 7z" />
                  </marker>
                )}
              </For>
            )}
          </For>
        </defs>
        <For each={props.flow.participants}>
          {(participant, index) => (
            <g
              classList={{
                "sequence-actor": true,
                "is-active": active(participant.id),
              }}
            >
              <path
                class="sequence-lane"
                d={`M${lane(index())} 54V${height() - 10}`}
              />
              <rect
                x={lane(index()) - 43}
                y="8"
                width="86"
                height="47"
                rx="4"
              />
              <g
                transform={`translate(${lane(index()) - 9} 13)`}
                aria-hidden="true"
                class="sequence-actor-icon"
              >
                <Dynamic
                  component={actorIcons[participant.id] ?? Network}
                  size={18}
                  strokeWidth={1.75}
                />
              </g>
              <text x={lane(index())} y="45" text-anchor="middle">
                {participant.shortLabel}
              </text>
            </g>
          )}
        </For>
        <For each={visibleEvents()}>
          {(event, index) => {
            const absoluteIndex = () => firstRow() + index();
            const y = () => row(index());
            const isActive = () => absoluteIndex() === props.index;
            const from = position(event.from);
            const to = position(event.to);
            const end = to - Math.sign(to - from) * 3;
            const tone = trafficTone(event);
            const path = () =>
              from === to
                ? `M${from} ${y() - 5}h-23v11h23`
                : `M${from} ${y()}H${end}`;
            return (
              <g
                classList={{ "sequence-row": true, "is-active": isActive() }}
                data-tone={tone}
              >
                <Show when={isActive()}>
                  <rect
                    class="sequence-band"
                    x="5"
                    y={y() - 11}
                    width={width - 10}
                    height="22"
                    rx="3"
                  />
                  <path class="sequence-notch" d={`M7 ${y() - 8}v16`} />
                </Show>
                <text class="sequence-number" x="15" y={y() + 4}>
                  {String(absoluteIndex() + 1).padStart(2, "0")}
                </text>
                <text class="sequence-kind" x="42" y={y() + 3.5}>
                  {rowLabel(event)}
                </text>
                <path
                  class="sequence-message"
                  classList={{ browser: event.channel === "browser" }}
                  d={path()}
                  marker-end={`url(#${id}-arrow-${tone}${isActive() ? "-active" : ""})`}
                />
              </g>
            );
          }}
        </For>
        <circle
          ref={(element) => {
            packet = element;
          }}
          class="sequence-packet"
          data-tone={selectedTone()}
          cx={position(selected()?.to ?? props.flow.participants[0]?.id ?? "")}
          cy={row(props.index - firstRow())}
          r="3.5"
          visibility={
            selected()?.from === selected()?.to ? "hidden" : "visible"
          }
        />
      </svg>
    </div>
  );
}
