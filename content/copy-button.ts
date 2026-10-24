import type { CopyFeedback, CopyFeedbackState } from './schemas';

export const copyFeedback: Record<CopyFeedbackState, CopyFeedback> = {
  idle: { label: 'COPY', message: '' },
  success: { label: 'COPIED', message: 'Copied to clipboard.' },
  failure: { label: 'COPY FAILED', message: 'Copy failed. Select and copy the text manually.' },
  unavailable: {
    label: 'COPY UNAVAILABLE',
    message: 'Clipboard unavailable. Select and copy the text manually.',
  },
};
