import { type HTMLAttributes, type ReactElement, useCallback, useState } from 'react';

type RegionAttributes = HTMLAttributes<HTMLParagraphElement> & { 'data-testid'?: string };

interface Announcement {
  id: number;
  text: string;
}

const INITIAL_ANNOUNCEMENT: Announcement = { id: 0, text: '' };

export function useAnnouncer(attributes?: RegionAttributes): {
  announce: (text: string) => void;
  region: ReactElement;
} {
  const [announcement, setAnnouncement] = useState(INITIAL_ANNOUNCEMENT);
  const announce = useCallback((text: string) => {
    setAnnouncement((previous) => ({ id: previous.id + 1, text }));
  }, []);
  const region = (
    <p {...attributes} className="sr-only" role="status">
      <span key={announcement.id}>{announcement.text}</span>
    </p>
  );
  return { announce, region };
}
