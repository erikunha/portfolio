export type AskInteractionStatus = 'completed' | 'errored' | 'aborted' | 'refused';

export type GuardFinding = {
  kind: 'leak' | 'length' | 'empty';
  detail: string;
};

export type PostHocVerdict = {
  clean: boolean;
  findings: GuardFinding[];
};
