import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const start = vi.hoisted(() => vi.fn());
vi.mock('@/lib/vitals/report.client', () => ({ startVitalsReporting: start }));

import { VitalsReporter } from './VitalsReporter.client';

describe('VitalsReporter', () => {
  it('renders nothing and starts reporting once it mounts', () => {
    const { container } = render(<VitalsReporter />);

    expect(container).toBeEmptyDOMElement();
    expect(start).toHaveBeenCalledTimes(1);
  });
});
