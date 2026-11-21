import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import {
  decodeSample,
  verifySample,
  type ValidationResult,
} from "../lib/token-experiment";
import { samples } from "../lib/token-samples";
import "../styles/tokens.css";

type Scenario = keyof typeof samples;
const scenarios = Object.keys(samples) as Scenario[];
const json = (value: unknown) => JSON.stringify(value, null, 2);
const showTime = (time: number) =>
  new Date(time * 1000).toISOString().replace(".000Z", "Z");

export default function TokenInspector() {
  const [ready, setReady] = createSignal(false);
  const [scenario, setScenario] = createSignal<Scenario>("valid");
  const [result, setResult] = createSignal<ValidationResult>();
  const [pending, setPending] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const sample = createMemo(() => samples[scenario()]);
  const decoded = createMemo(() => decodeSample(sample().token));
  let revision = 0;
  onMount(() => setReady(true));

  function select(value: string) {
    const next = scenarios.find((key) => key === value);
    if (!next) return;
    revision += 1;
    setScenario(next);
    setResult(undefined);
    setPending(false);
    setFailed(false);
  }

  async function verify() {
    const activeRevision = revision;
    setPending(true);
    setFailed(false);
    try {
      const outcome = await verifySample(sample().token, sample().now);
      if (revision === activeRevision) setResult(outcome);
    } catch {
      if (revision === activeRevision) setFailed(true);
    } finally {
      if (revision === activeRevision) setPending(false);
    }
  }

  return (
    <div class="token-inspector">
      <div class="token-controls">
        <label>
          <span>Sample</span>
          <select
            disabled={!ready()}
            value={scenario()}
            onChange={(event) => select(event.currentTarget.value)}
          >
            <For each={scenarios}>
              {(key) => <option value={key}>{samples[key].label}</option>}
            </For>
          </select>
        </label>
        <span class="token-clock">
          <span>Lab clock</span>
          <time dateTime={showTime(sample().now)}>
            {showTime(sample().now)}
          </time>
        </span>
        <button
          type="button"
          class="button primary"
          disabled={!ready() || pending()}
          onClick={() => void verify()}
        >
          {pending() ? "Verifying…" : "Verify token"}
        </button>
      </div>

      <details class="token-raw">
        <summary>View compact token</summary>
        <pre>
          <code>{sample().token}</code>
        </pre>
      </details>

      <div class="token-fields">
        <div>
          <h3>Decoded header</h3>
          <pre>
            <code>{json(decoded().header)}</code>
          </pre>
        </div>
        <div>
          <h3>Decoded claims</h3>
          <pre>
            <code>{json(decoded().payload)}</code>
          </pre>
        </div>
      </div>

      <div class="token-result" role="status">
        <Show
          when={result()}
          fallback={
            <p>
              {failed()
                ? "Verification needs Web Crypto over HTTPS or localhost."
                : "Decoded values are untrusted until verified."}
            </p>
          }
        >
          {(outcome) => {
            const value = outcome();
            return (
              <p classList={{ accepted: value.ok, rejected: !value.ok }}>
                <strong>{value.ok ? "Accepted." : "Rejected."}</strong>{" "}
                {value.ok
                  ? "The signature is valid and the claims satisfy the library API’s lab policy."
                  : `${value.signature === "valid" ? "The signature is valid. " : ""}${value.reason}`}
              </p>
            );
          }}
        </Show>
      </div>
    </div>
  );
}
