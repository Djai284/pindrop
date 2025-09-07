import { z } from 'zod';

export const CoordsSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export type Coords = z.infer<typeof CoordsSchema>;

export const PrivacySchema = z.enum(['private', 'friends', 'public']);
export type Privacy = z.infer<typeof PrivacySchema>;

export const PinSchema = z.object({
  id: z.string(),
  title: z.string().default(''),
  description: z.string().default(''),
  photos: z.array(z.string()).default([]),
  coords: CoordsSchema,
  privacy: PrivacySchema.default('private'),
  createdAt: z.number(), // epoch ms
});

export type Pin = z.infer<typeof PinSchema>;
