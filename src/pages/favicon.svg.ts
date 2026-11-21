import type { APIRoute } from "astro";
import artwork from "../../artwork/public/favicon.svg?raw";

export const GET: APIRoute = () =>
  new Response(artwork, { headers: { "Content-Type": "image/svg+xml" } });
