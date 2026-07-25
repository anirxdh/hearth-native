/**
 * The only place the app reads the wall clock. @rua/core is clock-free
 * by design; screens and the repo get "today" from here so tests can stub
 * one module and the digest recomputes correctly on day boundaries.
 */
import { localDateForInstant, type LocalDate } from '@rua/core';

export function nowIso(): string {
  return new Date().toISOString();
}

export function timeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

export function today(): LocalDate {
  return localDateForInstant(nowIso(), timeZone());
}

export function greetingFor(hour: number, name: string | null): string {
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return name ? `Good ${part}, ${name}` : `Good ${part}`;
}
