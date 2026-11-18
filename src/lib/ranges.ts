import { MAX_PAGES } from './limits';

/** Strict, one-based inclusive syntax. Returns unique zero-based pages in requested order. */
export function parsePages(input: string, count: number): number[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PAGES) throw new Error('Nombre de pages non pris en charge.');
  if (!input.trim()) return Array.from({ length: count }, (_, i) => i);
  const output: number[] = [];
  const seen = new Set<number>();
  for (const part of input.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Saisissez des pages comme 1, 3-5. Séparez les pages par des virgules.');
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 1 || last > count || first > last) throw new Error(`Choisissez des pages comprises entre 1 et ${count}, dans des intervalles croissants.`);
    for (let p = first - 1; p < last; p++) if (!seen.has(p)) { seen.add(p); output.push(p); }
  }
  return output;
}

export function parseGroups(input: string, count: number): number[][] {
  if (!input.trim()) throw new Error('Indiquez les groupes de pages, par exemple 1-3 ; 4-6.');
  const parts = input.split(';');
  if (parts.some(part => !part.trim())) throw new Error('Un groupe de pages est vide. Séparez les groupes par un point-virgule.');
  return parts.map(part => parsePages(part, count));
}
