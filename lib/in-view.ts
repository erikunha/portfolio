export const WHEN_UNSUPPORTED = { Ignore: 'ignore', Intersecting: 'intersecting' } as const;

export type InViewEntry = Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>;

export type InViewCallback = (entries: readonly InViewEntry[], stop: () => void) => void;

export type InViewInit = Pick<IntersectionObserverInit, 'root' | 'rootMargin' | 'threshold'> & {
  whenUnsupported?: (typeof WHEN_UNSUPPORTED)[keyof typeof WHEN_UNSUPPORTED];
};

const release = () => undefined;

export function supportsInView(): boolean {
  return typeof IntersectionObserver !== 'undefined';
}

export function observeInView(
  target: Element | readonly Element[],
  callback: InViewCallback,
  init: InViewInit = {},
): () => void {
  const targets: readonly Element[] = target instanceof Element ? [target] : target;
  const { whenUnsupported = WHEN_UNSUPPORTED.Ignore, ...observerInit } = init;
  if (!supportsInView()) {
    if (whenUnsupported === WHEN_UNSUPPORTED.Intersecting) {
      callback(
        targets.map((element) => ({ target: element, isIntersecting: true })),
        release,
      );
    }
    return release;
  }
  const stop = () => observer.disconnect();
  const observer = new IntersectionObserver((entries) => callback(entries, stop), observerInit);
  for (const element of targets) observer.observe(element);
  return stop;
}
