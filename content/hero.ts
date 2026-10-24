import { profile } from './profile';
import { workAuthorization } from './visa';

export const heroTagline = `${profile.title} · ${profile.technologyLine}`;
export const heroCurrentEmployer = profile.currentEmployer.name;
export const heroPlatformChip = profile.currentEmployer.context;

export const heroAuthorization = `${workAuthorization.worldwide} · WORLDWIDE`;
