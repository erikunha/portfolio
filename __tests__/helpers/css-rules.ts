import type { Root, Rule } from 'postcss';

function selectorList(rule: Rule): string[] {
  return rule.selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function rulesWithSelector(root: Root, selector: string): Rule[] {
  const found: Rule[] = [];
  root.walkRules((rule) => {
    if (selectorList(rule).includes(selector)) found.push(rule);
  });
  return found;
}

export function rulesInMedia(root: Root, params: RegExp, selector: string): Rule[] {
  const found: Rule[] = [];
  root.walkAtRules('media', (atRule) => {
    if (!params.test(atRule.params)) return;
    atRule.each((node) => {
      if (node.type === 'rule' && selectorList(node).includes(selector)) found.push(node);
    });
  });
  return found;
}

export function declValue(rule: Rule | undefined, prop: string): string | undefined {
  if (!rule) return undefined;
  for (const node of rule.nodes) {
    if (node.type === 'decl' && node.prop === prop) return node.value;
  }
  return undefined;
}
