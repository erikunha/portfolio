import { z } from 'zod';
import { LocalizedTextSchema } from './schema-primitives';

export const LinksProfileSchema = z.object({
  name: z.string().min(1),
  avatar: z.string().min(1),
  taglines: z.object({
    pt: z.array(z.string().min(1)).min(1),
    en: z.array(z.string().min(1)).min(1),
  }),
  host: LocalizedTextSchema,
  stack: z.string().min(1),
});

export const LinksChannelSchema = z.object({
  id: z
    .string()
    .regex(
      /^UC[A-Za-z0-9_-]{22}$/,
      'a YouTube channel id is "UC" plus 22 url-safe chars. The RSS feed at /feeds/videos.xml?channel_id= is keyed on this and returns a bare feed with no <entry> elements for a wrong id, which reads exactly like a channel with no videos: the page would render its empty state forever instead of failing.',
    ),
  handle: z.string().regex(/^@[A-Za-z0-9._-]+$/, 'a channel handle starts with @'),
  name: z.string().min(1),
});

export const LinksPlaylistSchema = z.object({
  id: z.string().min(1),
  tag: z.string().min(1),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema,
  playlistId: z.string().min(1).optional(),
});

export const LinksPillSchema = z.object({
  id: z.string().min(1),
  icon: z.enum(['portfolio', 'github', 'linkedin', 'instagram', 'tiktok', 'email']),
  label: LocalizedTextSchema,
  href: z
    .string()
    .min(
      1,
      'an empty href is a dead pill: omit the field entirely instead. A pill with no href is filtered out of the footer by LinksFooter, which is how a destination nobody has confirmed yet stays off a public page rather than shipping as a guessed handle.',
    )
    .optional(),
});

export const LinksUpcomingSchema = z.object({
  label: LocalizedTextSchema,
  topic: LocalizedTextSchema,
  slot: LocalizedTextSchema,
});

export const LinksCopySchema = z.object({
  whoami: z.string().min(1),
  hostLabel: LocalizedTextSchema,
  stackLabel: LocalizedTextSchema,
  watchHeading: LocalizedTextSchema,
  profilesHeading: LocalizedTextSchema,
  contactHeading: LocalizedTextSchema,
  emailHint: LocalizedTextSchema,
  videosWord: LocalizedTextSchema,
  viewsWord: LocalizedTextSchema,
  latestHeading: LocalizedTextSchema,
  historyCommand: z.string().min(1),
  historyEmpty: LocalizedTextSchema,
  historyOnlyLatest: LocalizedTextSchema,
  thumbPlaceholder: LocalizedTextSchema,
  seeAllVideos: LocalizedTextSchema,
  playlistsHeading: LocalizedTextSchema,
  qrHeading: LocalizedTextSchema,
  qrCommand: z.string().min(1),
  qrBody: LocalizedTextSchema,
  subscribe: LocalizedTextSchema,
  subscribedCta: LocalizedTextSchema,
  watch: LocalizedTextSchema,
  copyLink: LocalizedTextSchema,
  copyDone: LocalizedTextSchema,
  copyFailed: LocalizedTextSchema,
  copyFailedMessage: LocalizedTextSchema,
  opensInNewTab: LocalizedTextSchema,
  newBadge: LocalizedTextSchema,
  feedUnavailable: LocalizedTextSchema,
  pageHeading: LocalizedTextSchema,
});

export const LinksContentSchema = z.object({
  shellTitle: z.string().min(1),
  siteUrl: z.url(),
  siteLabel: z.string().min(1),
  profile: LinksProfileSchema,
  channel: LinksChannelSchema,
  upcoming: LinksUpcomingSchema,
  playlists: z.array(LinksPlaylistSchema).min(1),
  pills: z.array(LinksPillSchema).min(1),
  copy: LinksCopySchema,
  meta: z.object({
    title: LocalizedTextSchema,
    description: LocalizedTextSchema,
  }),
});

export type LinksProfile = z.infer<typeof LinksProfileSchema>;
export type LinksChannel = z.infer<typeof LinksChannelSchema>;
export type LinksPlaylist = z.infer<typeof LinksPlaylistSchema>;
export type LinksPill = z.infer<typeof LinksPillSchema>;
export type LinksCopy = z.infer<typeof LinksCopySchema>;
export type LinksContent = z.infer<typeof LinksContentSchema>;
