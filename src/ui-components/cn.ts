import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes; later args win for conflicting utilities. */
export function cn(...parts: (string | undefined | null | false)[]): string {
  return twMerge(parts.filter(Boolean) as string[]);
}
