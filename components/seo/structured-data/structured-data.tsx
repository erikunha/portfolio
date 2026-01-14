export interface StructuredDataProps {
  type?: 'Person' | 'WebSite';
}

export async function StructuredData({ type = 'Person' }: StructuredDataProps) {
  if (type === 'Person') {
    const personData = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Erik Henrique Alves Cunha',
      jobTitle: 'Frontend Engineer',
      description:
        'Frontend engineer specializing in React, Next.js, and TypeScript',
      url: 'https://erikunha.dev',
      sameAs: [
        'https://github.com/erikunha',
        'https://linkedin.com/in/erikunha',
        'https://twitter.com/erikunha',
      ],
      knowsAbout: [
        'React',
        'Next.js',
        'TypeScript',
        'JavaScript',
        'Web Performance',
        'Accessibility',
        'CSS',
        'Node.js',
      ],
    };

    return (
      <script
        id="structured-data-person"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personData) }}
      />
    );
  }

  const websiteData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Erik Henrique Portfolio',
    url: 'https://erikunha.dev',
    author: {
      '@type': 'Person',
      name: 'Erik Henrique Alves Cunha',
    },
  };

  return (
    <script
      id="structured-data-website"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }}
    />
  );
}
