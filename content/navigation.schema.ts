import { z } from 'zod';
import { SectionTextSchema } from './schema-primitives';

const DOCK_KEYS = ['home', 'work', 'shell', 'hire', 'menu'] as const;
const MENU_DOCK_KEY = 'menu';
const MIN_NAV_ITEMS = 1;

const NavTextSchema = SectionTextSchema;

const NavGroupSchema = z.object({
  id: NavTextSchema,
  title: NavTextSchema,
  dock: z.enum(DOCK_KEYS),
  sectionIds: z.array(NavTextSchema).min(MIN_NAV_ITEMS).readonly(),
});

const DockControlSchema = z
  .object({
    key: z.enum(DOCK_KEYS),
    label: NavTextSchema,
    sectionId: NavTextSchema.optional(),
    href: z.url().optional(),
    accessibleName: NavTextSchema.optional(),
    lang: NavTextSchema.optional(),
  })
  .refine(
    ({ key, sectionId, href }) =>
      key === MENU_DOCK_KEY ? !sectionId && !href : Boolean(sectionId) !== Boolean(href),
    {
      message:
        'A dock control targets exactly one section or one link; the menu control targets neither',
    },
  );

const SiteLinkSchema = z.object({
  label: NavTextSchema,
  index: NavTextSchema,
  href: z.string().regex(/^(\/(?!\/)\S*|https:\/\/\S+)$/),
  external: z.boolean(),
  accessibleName: NavTextSchema.optional(),
});

const NavigationCopySchema = z.object({
  drawerLabel: NavTextSchema,
  navLabel: NavTextSchema,
  title: NavTextSchema,
  openMenu: NavTextSchema,
  closeDrawer: NavTextSchema,
  dockLabel: NavTextSchema,
  motionOn: NavTextSchema,
  motionOff: NavTextSchema,
  langSwitchLabel: NavTextSchema,
  skipLabel: NavTextSchema,
  siteNavLabel: NavTextSchema,
  backToTopLabel: NavTextSchema,
});

export function createNavigationSchema(sectionIds: readonly string[]) {
  return z
    .object({
      copy: NavigationCopySchema,
      groups: z.array(NavGroupSchema).min(MIN_NAV_ITEMS).readonly(),
      dock: z.array(DockControlSchema).min(MIN_NAV_ITEMS).readonly(),
      siteLinks: z.array(SiteLinkSchema).readonly(),
    })
    .superRefine(({ groups, dock }, ctx) => {
      const grouped = groups.flatMap(({ sectionIds: members }) => members);
      if (grouped.join('|') !== sectionIds.join('|')) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Navigation groups must list every registry section exactly once, in registry order',
        });
      }
      const dockKeys = dock.map(({ key }) => key);
      if (new Set(dockKeys).size !== dockKeys.length) {
        ctx.addIssue({ code: 'custom', message: 'Dock control keys must be unique' });
      }
      if (!dockKeys.includes(MENU_DOCK_KEY)) {
        ctx.addIssue({ code: 'custom', message: 'The dock needs a menu control' });
      }
      for (const { dock: key } of groups) {
        if (!dockKeys.includes(key)) {
          ctx.addIssue({
            code: 'custom',
            message: `Group points at missing dock control "${key}"`,
          });
        }
      }
      for (const { sectionId } of dock) {
        if (sectionId && !sectionIds.includes(sectionId)) {
          ctx.addIssue({ code: 'custom', message: `Dock targets unknown section "${sectionId}"` });
        }
      }
    });
}
