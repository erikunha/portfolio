import { DS_ROUTES } from '@/app/(en)/design-system/_components/ds-nav';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';
import { expect, type Page, test } from './_helpers/test';
import { renderEverything } from './_helpers/words';

const PAGE_ROUTES = ['/', '/pt', '/links', '/links/en', '/cv', '/pt/cv', '/summary', '/pt/summary'];
const ROUTES = [...PAGE_ROUTES, ...DS_ROUTES];
const CDP_ENGINE = 'chromium';
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const WHOLE_TREE = -1;
const CLASS_ATTRIBUTE = 'class';
const ATTRIBUTE_PAIR = 2;
const TEXT_SAMPLE_LENGTH = 40;
const GENERATED_CONTENT = 'generated content';
const CONTROL_ROUTE = '/links/en';
const FOREIGN_GLYPH = '漢';
const STILL_DOCUMENT =
  'the document must hold still for one whole scan: a lazy island that replaces its placeholder mid-scan leaves nodes the browser no longer knows';

interface DomNode {
  nodeId: number;
  nodeType: number;
  localName: string;
  nodeValue: string;
  attributes?: string[];
  children?: DomNode[];
  pseudoElements?: DomNode[];
}

interface Scan {
  selfHostedGlyphs: number;
  machineFonts: string[];
}

const ownText = (node: DomNode): string =>
  (node.children ?? [])
    .filter((child) => child.nodeType === TEXT_NODE)
    .map((child) => child.nodeValue.trim())
    .join(' ')
    .trim();

function textBearers(node: DomNode): DomNode[] {
  const below = (node.children ?? []).flatMap(textBearers);
  const draws =
    node.nodeType === ELEMENT_NODE &&
    (ownText(node) !== '' || (node.pseudoElements ?? []).length > 0);
  return draws ? [node, ...below] : below;
}

function classOf(node: DomNode): string | undefined {
  const attributes = node.attributes ?? [];
  for (let index = 0; index < attributes.length; index += ATTRIBUTE_PAIR) {
    if (attributes[index] === CLASS_ATTRIBUTE) return attributes[index + 1];
  }
  return undefined;
}

function describeNode(node: DomNode): string {
  const className = classOf(node);
  const tag =
    className === undefined ? `<${node.localName}>` : `<${node.localName} class="${className}">`;
  return `${tag} ${ownText(node).slice(0, TEXT_SAMPLE_LENGTH) || GENERATED_CONTENT}`;
}

async function scanFonts(page: Page): Promise<Scan> {
  const client = await page.context().newCDPSession(page);
  const scan: Scan = { selfHostedGlyphs: 0, machineFonts: [] };
  try {
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    const { root } = await client.send('DOM.getDocument', { depth: WHOLE_TREE });
    for (const node of textBearers(root)) {
      const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId });
      for (const font of fonts) {
        if (font.isCustomFont) scan.selfHostedGlyphs += font.glyphCount;
        else scan.machineFonts.push(`${describeNode(node)} -> ${font.familyName}`);
      }
    }
  } finally {
    await client.detach();
  }
  return { ...scan, machineFonts: [...new Set(scan.machineFonts)].sort() };
}

test.describe('every glyph is drawn by a self-hosted face', { tag: '@cross-browser' }, () => {
  test.skip(
    ({ browserName }) => browserName !== CDP_ENGINE,
    'CSS.getPlatformFontsForNode is a Chromium DevTools call; __tests__/meta/glyph-coverage.test.ts holds the same property for every engine from the font files',
  );

  async function settledScan(page: Page): Promise<Scan> {
    let scan: Scan = { selfHostedGlyphs: 0, machineFonts: [] };
    await expect(async () => {
      scan = await scanFonts(page);
    }, STILL_DOCUMENT).toPass();
    return scan;
  }

  test('the scan reports a glyph no self-hosted face holds', async ({ page }) => {
    await freezeMotion(page);
    await gotoSettled(page, CONTROL_ROUTE);
    await page.evaluate((glyph) => {
      const probe = document.createElement('p');
      probe.textContent = glyph;
      document.body.append(probe);
    }, FOREIGN_GLYPH);
    const scan = await settledScan(page);
    expect(
      scan.machineFonts.filter((entry) => entry.startsWith(`<p> ${FOREIGN_GLYPH} -> `)),
      'a CJK ideograph is in neither face, so a scan that does not report it reports nothing',
    ).toHaveLength(1);
  });

  for (const route of ROUTES) {
    test(`${route} falls back to no font of the machine`, async ({ page }) => {
      await freezeMotion(page);
      await gotoSettled(page, route);
      await renderEverything(page);
      const scan = await settledScan(page);
      expect(scan.selfHostedGlyphs, 'the scan must reach rendered text').toBeGreaterThan(0);
      expect(
        scan.machineFonts,
        'a glyph the self-hosted face lacks is drawn by a font of the machine, so its width and shape differ per visitor and the layout moves: add the glyph to the face or use one it holds',
      ).toEqual([]);
    });
  }
});
