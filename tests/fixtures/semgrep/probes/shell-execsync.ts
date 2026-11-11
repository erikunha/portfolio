import { execSync } from 'node:child_process';

// A different API: the rule's sink is exec, and execSync is not it.
export function repositoryStatus(): string {
  return execSync('git status').toString();
}
