import { cn } from "@/lib/utils";

interface ListPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
}

const getPageNumbers = (currentPage: number, totalPages: number) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
};

const ListPagination = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'items',
  className,
}: ListPaginationProps) => {
  if (totalPages <= 1) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className={cn("flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{startItem}-{endItem}</span> of{' '}
        <span className="font-medium text-foreground">{totalItems}</span> {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>

        {pages.map((page, index) => {
          const previousPage = pages[index - 1];
          const showEllipsis = index > 0 && previousPage !== page - 1;

          return (
            <div key={page} className="flex items-center gap-2">
              {showEllipsis ? <span className="text-sm text-muted-foreground">…</span> : null}
              <button
                type="button"
                onClick={() => onPageChange(page)}
                className={cn(
                  "min-w-9 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  page === currentPage
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-muted"
                )}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ListPagination;
