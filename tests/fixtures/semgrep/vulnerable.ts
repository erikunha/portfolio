import { exec } from 'node:child_process';

const ANTHROPIC_KEY =
  'sk-ant-api03-4ISu6Ooxjf89GsKUoIzjzkg8OloU2EGM_77qzvv1Tx8_y0KerI5ZspIdYWiQB-y5S-0KCcFS9IaAuZwNoWGK-2hjmScpJAA';

export function runUserCommand(userInput: string): void {
  exec(`ls ${userInput}`, () => {
    void ANTHROPIC_KEY;
  });
}
