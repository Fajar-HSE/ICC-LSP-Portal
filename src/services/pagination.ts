export interface PageResult<T> {
  pageItems: T[];
  totalPages: number;
  currentPage: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages,
    currentPage,
  };
}
