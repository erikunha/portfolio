import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { communityEvent } from '@/content/community';
import { credentials } from '@/content/credentials';
import { education, educationTags } from '@/content/education';
import { CredentialsSection } from './CredentialsSection';

describe('career tag groups', () => {
  it('keeps certifications and education in separate named groups', () => {
    render(<CredentialsSection />);
    const certifications = within(screen.getByRole('group', { name: 'Certifications' }));
    const education = within(screen.getByRole('group', { name: 'Education' }));
    expect(certifications.getAllByRole('listitem')).toHaveLength(3);
    expect(certifications.getByText('cert/ANGULAR_DEV')).toBeTruthy();
    expect(certifications.getByText('IELTS_GENERAL_TRAINING')).toBeTruthy();
    expect(certifications.getByText('WES_VERIFIED')).toBeTruthy();
    expect(certifications.queryByText('edu/MBA_AI_ENG')).toBeNull();
    expect(education.getAllByRole('listitem')).toHaveLength(3);
    expect(education.getByText('edu/MBA_AI_ENG')).toBeTruthy();
    expect(education.getByText('Instituto Infnet (online)')).toBeTruthy();
    expect(education.getByText('expected Dec 2027')).toBeTruthy();
    expect(education.getByText('CICCC, Vancouver')).toBeTruthy();
    expect(education.getByText('2023-2024')).toBeTruthy();
    expect(education.getByText('UNISAL, Campinas')).toBeTruthy();
    expect(education.getByText('2015-2020')).toBeTruthy();
    expect(education.queryByText('WES_VERIFIED')).toBeNull();
  });

  it('renders community separately with canonical talk count and CFP status', () => {
    render(<CredentialsSection />);
    const community = within(screen.getByRole('group', { name: 'Community' }));
    expect(community.getByText('community/DEVOPSDAYS_CAMPINAS · 2024 · ORGANIZER')).toBeTruthy();
    expect(community.getAllByRole('listitem')).toHaveLength(3);
    for (const bullet of communityEvent.bullets) {
      expect(community.getByText(bullet)).toBeTruthy();
    }
    expect(community.getByText(`status: ${communityEvent.statusLine}`)).toBeTruthy();
  });

  it('links the event heading to the event page with an accessible new-tab label', () => {
    render(<CredentialsSection />);
    const community = within(screen.getByRole('group', { name: 'Community' }));
    const links = community.getAllByRole('link');
    expect(
      links,
      'the community group renders one link, the event page: the program and organizers reference line is not in the approved prototype',
    ).toHaveLength(1);
    const anchor = links[0];
    expect(anchor?.getAttribute('href')).toBe(communityEvent.link.href);
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(within(anchor as HTMLElement).getByText(communityEvent.newTabLabel)).toBeTruthy();
    expect(
      community.getByRole('link', {
        name: new RegExp(`${communityEvent.name}.*opens in a new tab`),
      }),
    ).toBe(anchor);
  });

  it('can repeat the groups without duplicate heading IDs', () => {
    const { container } = render(
      <>
        <CredentialsSection />
        <CredentialsSection />
      </>,
    );
    const headings = [...container.querySelectorAll('h3[id]')];
    expect(headings).toHaveLength(6);
    expect(new Set(headings.map((heading) => heading.id)).size).toBe(headings.length);
    for (const group of container.querySelectorAll('[role="group"]')) {
      const label = group.getAttribute('aria-labelledby');
      expect(headings.some((heading) => heading.id === label)).toBe(true);
    }
  });

  it('names the resume degrees and keeps the home badges short', () => {
    expect(education.map((entry) => entry.degree)).toEqual([
      'MBA (Lato Sensu), AI Engineering, Machine Learning and Deep Learning',
      'Web Development Co-op Diploma',
      'B.S. Information Systems',
    ]);
    expect(educationTags.map((entry) => entry.badge)).toEqual([
      'Instituto Infnet (online)',
      'CICCC, Vancouver',
      'UNISAL, Campinas',
    ]);
    expect(credentials.map((entry) => entry.label)).toEqual([
      'ANGULAR_DEV',
      'ENGLISH',
      'INTL_DEGREE',
    ]);
  });
});
