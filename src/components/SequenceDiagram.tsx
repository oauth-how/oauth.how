import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import type { Flow } from "../simulation/schema";
import type { Speed } from "../simulation/engine";

interface Props {
  flow: Flow;
  index: number;
  speed: Speed;
}

const rowHeight = 29;
const headerHeight = 77;

export default function SequenceDiagram(props: Props) {
  const id = createUniqueId();
  const [allowMotion, setAllowMotion] = createSignal(false);
  const width = Math.max(430, 48 + props.flow.participants.length * 96);
  const height = headerHeight + props.flow.events.length * rowHeight;
  const lane = (index: number) =>
    50 + ((index + 0.5) * (width - 55)) / props.flow.participants.length;
  const position = (id: string) =>
    lane(
      props.flow.participants.findIndex((participant) => participant.id === id),
    );
  const selected = () => props.flow.events[props.index];
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
        style={{ "min-width": `${Math.ceil(width * 0.73)}px` }}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
      >
        <title id={`${id}-title`}>{props.flow.title} sequence diagram</title>
        <desc id={`${id}-description`}>
          {props.flow.participants.map(({ label }) => label).join(", ")}.
          Highlighted step {props.index + 1}: {selected()?.title}.
        </desc>
        <defs>
          <marker
            id={`${id}-arrow`}
            class="sequence-arrow"
            orient="auto"
            markerUnits="userSpaceOnUse"
            markerWidth="8"
            markerHeight="8"
            refX="8"
            refY="4"
          >
            <path d="M0 0L8 4 0 8z" />
          </marker>
          <marker
            id={`${id}-arrow-active`}
            class="sequence-arrow is-active"
            orient="auto"
            markerUnits="userSpaceOnUse"
            markerWidth="8"
            markerHeight="8"
            refX="8"
            refY="4"
          >
            <path d="M0 0L8 4 0 8z" />
          </marker>
        </defs>
        <For each={props.flow.participants}>
          {(participant, index) => (
            <g
              classList={{
                "sequence-actor": true,
                "is-active": active(participant.id),
              }}
            >
              <rect
                x={lane(index()) - 43}
                y="16"
                width="86"
                height="34"
                rx="7"
              />
              <text x={lane(index())} y="38" text-anchor="middle">
                {participant.shortLabel}
              </text>
              <path
                class="sequence-lane"
                d={`M${lane(index())} 50V${height - 10}`}
              />
            </g>
          )}
        </For>
        <For each={props.flow.events}>
          {(event, index) => {
            const y = () => headerHeight + index() * rowHeight - 9;
            const from = position(event.from);
            const to = position(event.to);
            const direction = Math.sign(to - from);
            const end = to - direction * 3;
            const path = () =>
              event.from === event.to
                ? `M${from} ${y() - 5}h-24v11h24`
                : `M${from} ${y()}H${end}`;
            return (
              <g
                classList={{
                  "sequence-row": true,
                  "is-active": index() === props.index,
                }}
              >
                <Show when={index() === props.index}>
                  <rect
                    class="sequence-band"
                    x="9"
                    y={y() - 12}
                    width={width - 18}
                    height="24"
                    rx="5"
                  />
                </Show>
                <text x="29" y={y() + 4} text-anchor="middle">
                  {String(index() + 1).padStart(2, "0")}
                </text>
                <path
                  class="sequence-message"
                  d={path()}
                  classList={{ browser: event.channel === "browser" }}
                  marker-end={`url(#${id}-arrow${index() === props.index ? "-active" : ""})`}
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
          cx={position(selected()?.to ?? props.flow.participants[0]?.id ?? "")}
          cy={headerHeight + props.index * rowHeight - 9}
          r="4.5"
          visibility={
            selected()?.from === selected()?.to ? "hidden" : "visible"
          }
        />
      </svg>
    </div>
  );
}
