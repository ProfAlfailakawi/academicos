type ClassInput = string | false | null | undefined | Record<string, boolean | undefined> | ClassInput[];
export function cn(...inputs: ClassInput[]): string {
  const out: string[] = [];
  const visit = (value: ClassInput) => {
    if (!value) return;
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else Object.entries(value).forEach(([key, enabled]) => enabled && out.push(key));
  };
  inputs.forEach(visit);
  return out.join(' ');
}
