import { type Social, SocialSchema } from './schemas';
import { LINKEDIN_URL } from './social-urls';

export const social: Social = SocialSchema.parse({
  github: 'https://github.com/erikunha',
  linkedin: LINKEDIN_URL,
  email: 'erikhenriquealvescunha@gmail.com',
  site: 'https://www.erikunha.dev',
  handle: 'erikunha',
  whatsapp: 'https://wa.me/5519997049125',
});
