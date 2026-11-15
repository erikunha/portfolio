import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

const LABEL = 'Message';
const TYPED = 'hello';

describe('the shared component test setup', () => {
  it('registers the jest-dom matchers', () => {
    render(<button type="button">send</button>);
    expect(screen.getByRole('button', { name: 'send' })).toBeInTheDocument();
  });

  it('types through user-event into a labelled field', async () => {
    const user = userEvent.setup();
    render(
      <label>
        {LABEL}
        <input />
      </label>,
    );
    const field = screen.getByLabelText(LABEL);
    await user.type(field, TYPED);
    expect(field).toHaveValue(TYPED);
  });
});
