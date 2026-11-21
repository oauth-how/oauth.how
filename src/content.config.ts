import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";
import { isFlowId, flows } from "./simulation/flows";
import { tracks } from "./lib/curriculum";
import { referenceSchema } from "./simulation/schema";

const lessons = defineCollection({
  loader: glob({ base: "./src/content/lessons", pattern: "*.mdx" }),
  schema: z.strictObject({
    title: z.string().min(1),
    description: z.string().min(1),
    track: z.enum(tracks),
    order: z.number().int().positive(),
    simulation: z
      .custom<keyof typeof flows>(isFlowId, "Unknown simulation ID.")
      .optional(),
    references: z.array(referenceSchema).min(1),
  }),
});

export const collections = { lessons };
