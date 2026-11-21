import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import solid from "@astrojs/solid-js";

export default defineConfig({
  site: "https://oauth.how",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [mdx(), solid(), sitemap()],
});
