/**
 * StructuredData Component Tests - Principal Level
 *
 * Tests cover:
 * - Person schema rendering
 * - WebSite schema rendering
 * - JSON-LD format validation
 * - Schema.org compliance
 * - Script tag attributes
 * - Data completeness
 */

import { render } from '@erikunha-portifolio/ui';
import { StructuredData } from './structured-data';

// Mock Next.js Script component
jest.mock('next/script', () => ({
  __esModule: true,
  default: ({
    id,
    type,
    dangerouslySetInnerHTML,
  }: {
    id?: string;
    type?: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) => (
    <script
      id={id}
      type={type}
      dangerouslySetInnerHTML={dangerouslySetInnerHTML}
      data-testid="structured-data-script"
    />
  ),
}));

describe('StructuredData Component', () => {
  describe('Person Schema', () => {
    it('renders Person schema by default', async () => {
      const Component = await StructuredData({});
      const { container } = render(Component);

      const script = container.querySelector('#structured-data-person');
      expect(script).toBeInTheDocument();
    });

    it('renders Person schema when type is explicitly set', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('#structured-data-person');
      expect(script).toBeInTheDocument();
    });

    it('sets correct script type for JSON-LD', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      expect(script?.getAttribute('type')).toBe('application/ld+json');
    });

    it('includes Schema.org context', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data['@context']).toBe('https://schema.org');
    });

    it('includes Person type', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data['@type']).toBe('Person');
    });

    it('includes person name', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.name).toBe('Erik Henrique Alves Cunha');
    });

    it('includes job title', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.jobTitle).toBe('Frontend Engineer');
    });

    it('includes person description', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.description).toContain('Frontend engineer');
      expect(data.description).toContain('React');
      expect(data.description).toContain('Next.js');
    });

    it('includes person URL', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.url).toBe('https://erikunha.dev');
    });

    it('includes sameAs social links', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.sameAs).toBeInstanceOf(Array);
      expect(data.sameAs).toContain('https://github.com/erikunha');
      expect(data.sameAs).toContain('https://linkedin.com/in/erikunha');
      expect(data.sameAs).toContain('https://twitter.com/erikunha');
    });

    it('includes all three social platforms', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.sameAs).toHaveLength(3);
    });

    it('includes knowsAbout skills array', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.knowsAbout).toBeInstanceOf(Array);
      expect(data.knowsAbout).toContain('React');
      expect(data.knowsAbout).toContain('Next.js');
      expect(data.knowsAbout).toContain('TypeScript');
      expect(data.knowsAbout).toContain('JavaScript');
    });

    it('includes web-specific skills', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.knowsAbout).toContain('Web Performance');
      expect(data.knowsAbout).toContain('Accessibility');
      expect(data.knowsAbout).toContain('CSS');
    });
  });

  describe('WebSite Schema', () => {
    it('renders WebSite schema when type is set', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const script = container.querySelector('#structured-data-website');
      expect(script).toBeInTheDocument();
    });

    it('sets correct script type for JSON-LD', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      expect(script?.getAttribute('type')).toBe('application/ld+json');
    });

    it('includes Schema.org context', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data['@context']).toBe('https://schema.org');
    });

    it('includes WebSite type', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data['@type']).toBe('WebSite');
    });

    it('includes website name', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.name).toBe('Erik Henrique Portfolio');
    });

    it('includes website URL', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.url).toBe('https://erikunha.dev');
    });

    it('includes nested author Person', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data.author).toBeDefined();
      expect(data.author['@type']).toBe('Person');
      expect(data.author.name).toBe('Erik Henrique Alves Cunha');
    });
  });

  describe('JSON-LD Format Validation', () => {
    it('generates valid JSON for Person schema', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;

      expect(() => JSON.parse(content || '')).not.toThrow();
    });

    it('generates valid JSON for WebSite schema', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;

      expect(() => JSON.parse(content || '')).not.toThrow();
    });

    it('does not include undefined or null values', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      const values = Object.values(data);
      expect(values).not.toContain(undefined);
      expect(values).not.toContain(null);
    });

    it('uses proper string escaping', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;

      // Should be properly escaped JSON
      expect(content).not.toContain('\\"\\n');
      expect(() => JSON.parse(content || '')).not.toThrow();
    });
  });

  describe('Schema.org Compliance', () => {
    it('Person schema has all required properties', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      // Required properties for Person
      expect(data['@context']).toBeDefined();
      expect(data['@type']).toBeDefined();
      expect(data.name).toBeDefined();
    });

    it('WebSite schema has all required properties', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      // Required properties for WebSite
      expect(data['@context']).toBeDefined();
      expect(data['@type']).toBeDefined();
      expect(data.name).toBeDefined();
      expect(data.url).toBeDefined();
    });

    it('uses correct @context URL', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      const content = script?.innerHTML;
      const data = content ? JSON.parse(content) : null;

      expect(data['@context']).toBe('https://schema.org');
      expect(data['@context']).not.toBe('http://schema.org'); // Should use HTTPS
    });
  });

  describe('Script Tag Attributes', () => {
    it('has unique ID for Person schema', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      expect(script?.getAttribute('id')).toBe('structured-data-person');
    });

    it('has unique ID for WebSite schema', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      expect(script?.getAttribute('id')).toBe('structured-data-website');
    });

    it('uses application/ld+json type', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const script = container.querySelector('script');
      expect(script?.getAttribute('type')).toBe('application/ld+json');
    });
  });

  describe('Edge Cases', () => {
    it('handles rendering only one script at a time', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      const scripts = container.querySelectorAll(
        'script[type="application/ld+json"]',
      );
      expect(scripts).toHaveLength(1);
    });

    it('does not render both schemas simultaneously', async () => {
      const Component = await StructuredData({ type: 'WebSite' });
      const { container } = render(Component);

      const personScript = container.querySelector('#structured-data-person');
      expect(personScript).not.toBeInTheDocument();
    });

    it('renders nothing visible in DOM', async () => {
      const Component = await StructuredData({ type: 'Person' });
      const { container } = render(Component);

      // Should only contain script tag, no visible elements
      const visibleElements = container.querySelectorAll(
        'div, span, p, h1, h2, h3, h4, h5, h6',
      );
      expect(visibleElements).toHaveLength(0);
    });
  });

  describe('Integration', () => {
    it('can be used multiple times on same page with different types', async () => {
      const Component1 = await StructuredData({ type: 'Person' });
      const Component2 = await StructuredData({ type: 'WebSite' });

      const { container: container1 } = render(Component1);
      const { container: container2 } = render(Component2);

      expect(container1.querySelector('script')).toBeInTheDocument();
      expect(container2.querySelector('script')).toBeInTheDocument();
    });

    it('maintains data integrity when re-rendered', async () => {
      const Component1 = await StructuredData({ type: 'Person' });
      const { container, rerender } = render(Component1);

      const script1 = container.querySelector('script');
      const content1 = script1?.innerHTML;

      const Component2 = await StructuredData({ type: 'Person' });
      rerender(Component2);

      const script2 = container.querySelector('script');
      const content2 = script2?.innerHTML;

      expect(content1).toBe(content2);
    });
  });
});
