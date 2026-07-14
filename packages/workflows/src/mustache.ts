/**
 * Single-brace template interpolation, ported from the nonlinear reference:
 * `{Variable Name}` tokens are replaced from a data map. Deliberately simple,
 * deterministic, and dependency-free - no logic, no partials, no escaping
 * surprises. Unknown tokens are left in place so a half-filled document is
 * visibly half-filled, never silently wrong.
 */

export function detectMustaches(text: string): string[] {
  if (!text) return [];
  const matches: string[] = [];
  const variableRegex = /\{([^}]+)\}/g;
  let match;
  while ((match = variableRegex.exec(text)) !== null) {
    const variableName = match[1]!.trim();
    if (variableName && !matches.includes(variableName)) {
      matches.push(variableName);
    }
  }
  return matches;
}

export function render(template: string, data: Record<string, string>): string {
  if (!template) return '';
  let renderedText = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g');
    renderedText = renderedText.replace(regex, () => value);
  }
  return renderedText;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
