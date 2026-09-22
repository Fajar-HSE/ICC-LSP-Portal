import { paginate } from '../services/pagination.js';

export function usePage<T>(items: T[], page: number, pageSize: number): {
  pageItems: T[];
  totalPages: number;
  currentPage: number;
} {
  return paginate(items, page, pageSize);
}
