import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContactSection } from '@/components/sections/ContactSection';

describe('contact timezone placeholder', () => {
  it('server-renders dashed clocks for erik and the visitor before the island fills them', () => {
    render(<ContactSection locale="en" />);
    expect(screen.getByText('erik · SAO --:--')).toBeTruthy();
    expect(screen.getByText('you · --- --:--')).toBeTruthy();
  });

  it('localizes the visitor row', () => {
    render(<ContactSection locale="pt" />);
    expect(screen.getByText('você · --- --:--')).toBeTruthy();
  });
});
