import { linksContent } from '@/content/links';

export function ChromeBar() {
  return (
    <div className="links-chrome">
      <span className="links-chrome-title">{linksContent.shellTitle}</span>
    </div>
  );
}
