import type { Locator } from '@playwright/test';

const IMAGE_DECODE_TIMEOUT_MS = 20_000;

export const IMAGE_NOT_DECODED = 'an image inside the captured region did not load and decode';

export async function waitForImagesDecoded(region: Locator): Promise<void> {
  await region.evaluate(
    async (root, [timeoutMs, message]) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(String(message))), Number(timeoutMs));
      });
      const decodeAll = async () => {
        for (const image of root.querySelectorAll('img')) {
          image.scrollIntoView({ block: 'center' });
          try {
            await image.decode();
          } catch (cause) {
            throw new Error(`${String(message)}: ${image.currentSrc || image.src}`, { cause });
          }
        }
      };
      try {
        await Promise.race([decodeAll(), timeout]);
      } finally {
        clearTimeout(timer);
      }
      root.scrollIntoView({ block: 'start' });
    },
    [IMAGE_DECODE_TIMEOUT_MS, IMAGE_NOT_DECODED] as const,
  );
}
