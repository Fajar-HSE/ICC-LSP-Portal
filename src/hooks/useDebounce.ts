import { debounce } from '../utils/dom.js';

export function debounced<T extends (...args: never[]) => void>(fn: T, ms = 150): T {
  return debounce(fn, ms);
}
