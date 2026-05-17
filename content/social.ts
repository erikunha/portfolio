import { type Social, SocialSchema } from './schemas';

export const social: Social = SocialSchema.parse({
  github: 'https://github.com/erikunha',
  linkedin: 'https://www.linkedin.com/in/erikunha/',
  email: 'erikhenriquealvescunha@gmail.com',
  site: 'https://erikunha.dev',
  handle: 'erikunha',
  whatsapp: 'https://wa.me/5519998394086',
});
