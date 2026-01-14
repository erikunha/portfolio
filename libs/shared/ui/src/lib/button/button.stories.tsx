/**
 * Button Component Stories
 * Visual contract for all button variants and states
 * MANDATORY: All variants must be documented
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Components/Button',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    isLoading: {
      control: 'boolean',
    },
    isFullWidth: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

/**
 * Primary button - default variant for main actions
 */
export const Primary: Story = {
  args: {
    children: 'Primary Button',
    variant: 'primary',
  },
};

/**
 * Secondary button - alternative actions
 */
export const Secondary: Story = {
  args: {
    children: 'Secondary Button',
    variant: 'secondary',
  },
};

/**
 * Ghost button - subtle actions
 */
export const Ghost: Story = {
  args: {
    children: 'Ghost Button',
    variant: 'ghost',
  },
};

/**
 * Danger button - destructive actions
 */
export const Danger: Story = {
  args: {
    children: 'Danger Button',
    variant: 'danger',
  },
};

/**
 * Small size
 */
export const Small: Story = {
  args: {
    children: 'Small Button',
    size: 'sm',
  },
};

/**
 * Medium size (default)
 */
export const Medium: Story = {
  args: {
    children: 'Medium Button',
    size: 'md',
  },
};

/**
 * Large size
 */
export const Large: Story = {
  args: {
    children: 'Large Button',
    size: 'lg',
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  args: {
    children: 'Loading Button',
    isLoading: true,
  },
};

/**
 * Disabled state
 */
export const Disabled: Story = {
  args: {
    children: 'Disabled Button',
    disabled: true,
  },
};

/**
 * Full width button
 */
export const FullWidth: Story = {
  args: {
    children: 'Full Width Button',
    isFullWidth: true,
  },
  parameters: {
    layout: 'padded',
  },
};

/**
 * Button with left icon
 */
export const WithLeftIcon: Story = {
  args: {
    children: 'With Icon',
    leftIcon: <span>📧</span>,
  },
};

/**
 * Button with right icon
 */
export const WithRightIcon: Story = {
  args: {
    children: 'With Icon',
    rightIcon: <span>→</span>,
  },
};

/**
 * Button with both icons
 */
export const WithBothIcons: Story = {
  args: {
    children: 'With Icons',
    leftIcon: <span>←</span>,
    rightIcon: <span>→</span>,
  },
};

/**
 * All variants side by side
 */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

/**
 * All sizes side by side
 */
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
