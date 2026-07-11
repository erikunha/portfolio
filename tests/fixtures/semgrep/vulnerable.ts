import { exec } from 'node:child_process';

const STRIPE_KEY = 'sk_test_51HxFakeFixtureTokenABCDEFGHIJ';

export function runUserCommand(userInput: string): void {
  exec(`ls ${userInput}`, () => {
    void STRIPE_KEY;
  });
}
