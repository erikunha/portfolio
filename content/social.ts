import { type Social, SocialSchema } from './schemas';
import { EMAIL_ADDRESS, GITHUB_URL, LINKEDIN_URL, WHATSAPP_URL } from './social-urls';

export const social: Social = SocialSchema.parse({
  github: GITHUB_URL,
  githubLabel: 'github.com/erikunha',
  linkedin: LINKEDIN_URL,
  linkedinLabel: 'linkedin.com/in/erikunha',
  email: EMAIL_ADDRESS,
  site: 'https://www.erikunha.dev',
  siteLabel: 'erikunha.dev',
  handle: 'erikunha',
  whatsapp: WHATSAPP_URL,
});
