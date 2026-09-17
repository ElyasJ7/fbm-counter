import { clsx, type ClassValue } from 'clsx';

/** Merge class names; falsy values ignored. */
export function cn(...parts: ClassValue[]) {
  return clsx(parts);
}
