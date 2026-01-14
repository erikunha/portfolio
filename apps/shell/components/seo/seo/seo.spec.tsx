/**
 * SEO Component Tests - Principal Level
 *
 * Tests cover:
 * - Default SEO metadata configuration
 * - Custom metadata overrides
 * - OpenGraph metadata setup
 * - Twitter Card configuration
 * - Integration with next-seo library
 */

import { render } from '@erikunha-portifolio/ui';
import { DEFAULT_SEO, SEO } from './seo';

// Mock next-seo and capture props
let capturedProps: Record<string, unknown> | null = null;

jest.mock('next-seo', () => ({
  NextSeo: (props: unknown) => {
    capturedProps = props as Record<string, unknown>;
    return null;
  },
}));

describe('SEO Component', () => {
  beforeEach(() => {
    capturedProps = null;
  });

  describe('Default Metadata', () => {
    it('renders with default SEO values', () => {
      render(<SEO />);

      expect(capturedProps).toBeDefined();
      expect(capturedProps?.title).toBe(DEFAULT_SEO.title);
      expect(capturedProps?.description).toBe(DEFAULT_SEO.description);
      expect(capturedProps?.canonical).toBe(DEFAULT_SEO.url);
    });

    it('uses default title when not provided', () => {
      render(<SEO />);

      expect(capturedProps?.title).toBe(DEFAULT_SEO.title);
    });

    it('uses default description when not provided', () => {
      render(<SEO />);

      expect(capturedProps?.description).toBe(DEFAULT_SEO.description);
    });

    it('uses default URL when not provided', () => {
      render(<SEO />);

      expect(capturedProps?.canonical).toBe(DEFAULT_SEO.url);
    });

    it('configures OpenGraph with default image', () => {
      render(<SEO />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      expect(openGraph).toBeDefined();
      const images = openGraph?.images as Array<{ url: string }>;
      expect(images).toBeDefined();
      expect(images[0]?.url).toBe(DEFAULT_SEO.image);
    });
  });

  describe('Custom Metadata', () => {
    it('renders custom title', () => {
      const customTitle = 'Custom Page Title';
      render(<SEO title={customTitle} />);

      expect(capturedProps?.title).toBe(customTitle);
    });

    it('renders custom description', () => {
      const customDescription = 'Custom page description for SEO';
      render(<SEO description={customDescription} />);

      expect(capturedProps?.description).toBe(customDescription);
    });

    it('renders custom URL', () => {
      const customUrl = 'https://erikunha.dev/about';
      render(<SEO url={customUrl} />);

      expect(capturedProps?.canonical).toBe(customUrl);
    });

    it('renders custom image', () => {
      const customImage = 'https://erikunha.dev/custom-og-image.jpg';
      render(<SEO image={customImage} />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      const images = openGraph?.images as Array<{ url: string }>;
      expect(images[0]?.url).toBe(customImage);
    });

    it('allows overriding all metadata at once', () => {
      const custom = {
        title: 'About Me',
        description: 'Learn about Erik Henrique',
        url: 'https://erikunha.dev/about',
        image: 'https://erikunha.dev/about-og.jpg',
      };

      render(<SEO {...custom} />);

      expect(capturedProps?.title).toBe(custom.title);
      expect(capturedProps?.description).toBe(custom.description);
      expect(capturedProps?.canonical).toBe(custom.url);
      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      const images = openGraph?.images as Array<{ url: string }>;
      expect(images[0]?.url).toBe(custom.image);
    });

    it('preserves additional props passed to NextSeo', () => {
      const noindex = true;
      render(<SEO noindex={noindex} />);

      expect(capturedProps?.noindex).toBe(true);
    });
  });

  describe('OpenGraph Metadata', () => {
    it('sets OpenGraph type to website', () => {
      render(<SEO />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      expect(openGraph?.type).toBe('website');
    });

    it('includes OpenGraph URL', () => {
      const url = 'https://erikunha.dev/projects';
      render(<SEO url={url} />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      expect(openGraph?.url).toBe(url);
    });

    it('includes OpenGraph title', () => {
      const title = 'My Projects';
      render(<SEO title={title} />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      expect(openGraph?.title).toBe(title);
    });

    it('includes OpenGraph description', () => {
      const description = 'View my portfolio projects';
      render(<SEO description={description} />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      expect(openGraph?.description).toBe(description);
    });

    it('includes OpenGraph image with correct dimensions', () => {
      render(<SEO />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      const images = openGraph?.images as Array<{
        width: number;
        height: number;
      }>;
      expect(images[0]?.width).toBe(1200);
      expect(images[0]?.height).toBe(630);
    });

    it('includes OpenGraph image alt text', () => {
      const title = 'Portfolio Projects';
      render(<SEO title={title} />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      const images = openGraph?.images as Array<{ alt: string }>;
      expect(images[0]?.alt).toBe(title);
    });

    it('includes site name', () => {
      render(<SEO />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      expect(openGraph?.siteName).toBe(DEFAULT_SEO.siteName);
    });
  });

  describe('Twitter Card Metadata', () => {
    it('includes Twitter handle', () => {
      render(<SEO />);

      const twitter = capturedProps?.twitter as Record<string, string>;
      expect(twitter?.handle).toBe('@erikunha');
    });

    it('includes Twitter site', () => {
      render(<SEO />);

      const twitter = capturedProps?.twitter as Record<string, string>;
      expect(twitter?.site).toBe('@erikunha');
    });

    it('uses summary_large_image card type', () => {
      render(<SEO />);

      const twitter = capturedProps?.twitter as Record<string, string>;
      expect(twitter?.cardType).toBe('summary_large_image');
    });
  });

  describe('Additional Meta Tags', () => {
    it('includes viewport meta tag', () => {
      render(<SEO />);

      const metaTags = capturedProps?.additionalMetaTags as Array<{
        name: string;
        content: string;
      }>;
      const viewport = metaTags?.find((tag) => tag.name === 'viewport');
      expect(viewport).toBeDefined();
      expect(viewport?.content).toBe('width=device-width, initial-scale=1');
    });

    it('includes author meta tag', () => {
      render(<SEO />);

      const metaTags = capturedProps?.additionalMetaTags as Array<{
        name: string;
        content: string;
      }>;
      const author = metaTags?.find((tag) => tag.name === 'author');
      expect(author).toBeDefined();
      expect(author?.content).toBe('Erik Henrique Alves Cunha');
    });

    it('includes keywords meta tag', () => {
      render(<SEO />);

      const metaTags = capturedProps?.additionalMetaTags as Array<{
        name: string;
        content: string;
      }>;
      const keywords = metaTags?.find((tag) => tag.name === 'keywords');
      expect(keywords).toBeDefined();
      expect(keywords?.content).toContain('frontend engineer');
      expect(keywords?.content).toContain('react developer');
    });
  });

  describe('Link Tags', () => {
    it('includes favicon link', () => {
      render(<SEO />);

      const linkTags = capturedProps?.additionalLinkTags as Array<{
        rel: string;
        href: string;
      }>;
      const favicon = linkTags?.find((tag) => tag.rel === 'icon');
      expect(favicon).toBeDefined();
      expect(favicon?.href).toBe('/favicon.ico');
    });

    it('includes apple-touch-icon', () => {
      render(<SEO />);

      const linkTags = capturedProps?.additionalLinkTags as Array<{
        rel: string;
        href: string;
        sizes?: string;
      }>;
      const appleTouchIcon = linkTags?.find(
        (tag) => tag.rel === 'apple-touch-icon',
      );
      expect(appleTouchIcon).toBeDefined();
      expect(appleTouchIcon?.href).toBe('/apple-touch-icon.png');
      expect(appleTouchIcon?.sizes).toBe('180x180');
    });

    it('includes manifest link', () => {
      render(<SEO />);

      const linkTags = capturedProps?.additionalLinkTags as Array<{
        rel: string;
        href: string;
      }>;
      const manifest = linkTags?.find((tag) => tag.rel === 'manifest');
      expect(manifest).toBeDefined();
      expect(manifest?.href).toBe('/site.webmanifest');
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined values gracefully', () => {
      render(<SEO title={undefined} description={undefined} />);

      // Should fall back to defaults
      expect(capturedProps?.title).toBe(DEFAULT_SEO.title);
      expect(capturedProps?.description).toBe(DEFAULT_SEO.description);
    });

    it('handles special characters in metadata', () => {
      const specialTitle =
        'Erik\'s Portfolio - "Frontend Engineer" & Developer';
      render(<SEO title={specialTitle} />);

      expect(capturedProps?.title).toBe(specialTitle);
    });

    it('handles very long descriptions', () => {
      const longDescription = 'A'.repeat(500);
      render(<SEO description={longDescription} />);

      expect(capturedProps?.description).toBe(longDescription);
    });

    it('handles URL with query parameters', () => {
      const urlWithQuery =
        'https://erikunha.dev/projects?category=frontend&tag=react';
      render(<SEO url={urlWithQuery} />);

      expect(capturedProps?.canonical).toBe(urlWithQuery);
    });
  });

  describe('Integration', () => {
    it('renders without errors', () => {
      expect(() => render(<SEO />)).not.toThrow();
    });

    it('passes all required NextSeo props', () => {
      render(<SEO />);

      expect(capturedProps).toHaveProperty('title');
      expect(capturedProps).toHaveProperty('description');
      expect(capturedProps).toHaveProperty('canonical');
      expect(capturedProps).toHaveProperty('openGraph');
      expect(capturedProps).toHaveProperty('twitter');
      expect(capturedProps).toHaveProperty('additionalMetaTags');
      expect(capturedProps).toHaveProperty('additionalLinkTags');
    });

    it('maintains consistency between title and og:title', () => {
      const title = 'Test Page';
      render(<SEO title={title} />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      expect(capturedProps?.title).toBe(title);
      expect(openGraph?.title).toBe(title);
    });

    it('maintains consistency between description and og:description', () => {
      const description = 'Test description';
      render(<SEO description={description} />);

      const openGraph = capturedProps?.openGraph as Record<string, unknown>;
      expect(capturedProps?.description).toBe(description);
      expect(openGraph?.description).toBe(description);
    });
  });
});
