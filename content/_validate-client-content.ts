import { z } from 'zod';
import { brandByLocale } from './brand';
import { ContactContentSchema } from './contact';
import { contactCopy } from './contact-copy';
import { copyFeedback } from './copy-button';
import { dmesgLines } from './dmesg';
import { errorsContent } from './errors';
import { heroClientContent } from './hero-client';
import { NAVIGATION } from './navigation';
import {
  BrandSchema,
  CopyFeedbackSchema,
  createNavigationSchema,
  DmesgLineSchema,
  ErrorsContentSchema,
  HeroClientContentSchema,
  SectionRegistrySchema,
  ShellCommandsSchema,
  ShellUiSchema,
  TerminalChromeSchema,
  WorldMapSchema,
} from './schemas';
import { SECTION_REGISTRY } from './section-registry';
import SHELL_RESPONSES from './shell-commands';
import { shellUi } from './shell-ui';
import { SITE_LOCALE, type SiteLocale } from './site-locale';
import { EMAIL_ADDRESS, LINKEDIN_URL } from './social-urls';
import { contactChrome, shellChrome } from './terminal-chrome';
import { worldMap } from './world-map';

const LOCALES = Object.values(SITE_LOCALE) as SiteLocale[];

z.array(DmesgLineSchema).parse(dmesgLines);
ShellCommandsSchema.parse(SHELL_RESPONSES);
for (const locale of LOCALES) {
  ShellUiSchema.parse(shellUi[locale]);
  TerminalChromeSchema.parse(shellChrome[locale]);
  TerminalChromeSchema.parse(contactChrome[locale]);
  createNavigationSchema(SECTION_REGISTRY.map(({ id }) => id)).parse(NAVIGATION[locale]);
  ContactContentSchema.parse(contactCopy[locale]);
  ErrorsContentSchema.parse(errorsContent[locale]);
  BrandSchema.parse(brandByLocale[locale]);
  HeroClientContentSchema.parse(heroClientContent[locale]);
  for (const feedback of Object.values(copyFeedback[locale])) CopyFeedbackSchema.parse(feedback);
}
SectionRegistrySchema.parse(SECTION_REGISTRY);
z.object({ email: z.email(), linkedin: z.url() }).parse({
  email: EMAIL_ADDRESS,
  linkedin: LINKEDIN_URL,
});
WorldMapSchema.parse(worldMap);
