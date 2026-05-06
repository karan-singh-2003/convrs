export function interpolate(
  template: string,
  data: Record<string, any>
): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    const value = data[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}
