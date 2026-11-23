import { IMAGE_NOT_DECODED, waitForImagesDecoded } from './_helpers/images';
import { expect, test } from './_helpers/test';

const BROKEN_SOURCE = 'data:image/png;base64,bm90LWFuLWltYWdl';

test('a broken image fails the decode wait with the named cause and its source', async ({
  page,
}) => {
  await page.setContent(`<main><img alt="broken" src="${BROKEN_SOURCE}"></main>`);
  const failure = await waitForImagesDecoded(page.locator('main')).then(
    () => null,
    (error: Error) => error.message,
  );
  expect(failure).toContain(IMAGE_NOT_DECODED);
  expect(failure).toContain(BROKEN_SOURCE);
});
