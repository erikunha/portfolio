import { CompanyLinkCopySchema } from './schemas';

export const companyLinkCopy = CompanyLinkCopySchema.parse({
  disclosure: '(opens in a new tab)',
});
