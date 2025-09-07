import { z } from 'zod';

export const CoordsSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export type Coords = z.infer<typeof CoordsSchema>;

export const PrivacySchema = z.enum(['private', 'friends', 'public']);
export type Privacy = z.infer<typeof PrivacySchema>;

export const CategorySchema = z.enum(['art', 'cafe', 'study', 'smoke', 'landmark', 'nature', 'other']);
export type Category = z.infer<typeof CategorySchema>;

// Comment type for pins (local-only)
export const PinCommentSchema = z.object({
  id: z.string(),
  user: z.string(),
  text: z.string(),
  createdAt: z.number(), // epoch ms
});
export type PinComment = z.infer<typeof PinCommentSchema>;

export const PinSchema = z.object({
  id: z.string(),
  title: z.string().default(''),
  description: z.string().default(''),
  photos: z.array(z.string()).default([]),
  categories: z.array(CategorySchema).default([]),
  coords: CoordsSchema,
  privacy: PrivacySchema.default('private'),
  createdAt: z.number(), // epoch ms
  // Owner username (local-only multi-user simulation)
  owner: z.string().default('me'),
  // Local comments (mock users)
  comments: z.array(PinCommentSchema).default([]),
  // Instagram-like hearts
  likesCount: z.number().default(0),
  myLiked: z.boolean().default(false),
});

export type Pin = z.infer<typeof PinSchema>;
