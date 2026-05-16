// components/responsive/MobileTitleBar.tsx
'use client';

export function MobileTitleBar() {
  return (
    <div className="window-chrome window-chrome--mobile">
      <div className="window-chrome__dots" aria-hidden="true">
        <span className="window-chrome__dot window-chrome__dot--red" />
        <span className="window-chrome__dot window-chrome__dot--yellow" />
        <span className="window-chrome__dot window-chrome__dot--green" />
      </div>
      <div className="window-chrome__title" aria-hidden="true">
        ERIK_CUNHA.SH
      </div>
      <div aria-hidden="true" />
    </div>
  );
}
