'use client';

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,\n} from '@tanstack/react-table';
import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,\n} from '@/components/ui/table';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,\n} from '@/components/ui/dropdown-menu';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Settings,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';\nimport { cn } from '@/utils/cn';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  pagination?: {
    pageIndex: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
  loading?: boolean;
  className?: string;
  enableRowSelection?: boolean;
  onRowSelectionChange?: (selectedRows: TData[]) => void;
  enableColumnVisibility?: boolean;
  enableSearch?: boolean;
  emptyMessage?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
  pagination,
  onPaginationChange,
  loading = false,
  className,
  enableRowSelection = false,
  onRowSelectionChange,
  enableColumnVisibility = true,
  enableSearch = true,
  emptyMessage = 'No results found.'
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});\n  const [globalFilter, setGlobalFilter] = useState('');

  // Enhanced columns with sorting icons
  const enhancedColumns = useMemo(() => {
    return columns.map(column => ({
      ...column,
      header: ({ column: headerColumn }: any) => {
        const originalHeader = typeof column.header === 'function' 
          ? column.header({ column: headerColumn })
          : column.header;

        if (!headerColumn.getCanSort()) {
          return originalHeader;
        }

        return (
          <Button
            variant="ghost"\n            size="sm"\n            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => headerColumn.toggleSorting(headerColumn.getIsSorted() === 'asc')}
          >
            <span>{originalHeader}</span>
            {headerColumn.getIsSorted() === 'desc' ? (\n              <ArrowDown className="ml-2 h-4 w-4" />
            ) : headerColumn.getIsSorted() === 'asc' ? (\n              <ArrowUp className="ml-2 h-4 w-4" />
            ) : (\n              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        );
      }
    }));
  }, [columns]);

  const table = useReactTable({
    data,
    columns: enhancedColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination: pagination ? {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize
      } : undefined
    },
    manualPagination: !!pagination,
    pageCount: pagination?.pageCount ?? -1,
    enableRowSelection,
    enableGlobalFilter: true,
  });

  // Handle row selection changes
  useState(() => {
    if (onRowSelectionChange) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
      onRowSelectionChange(selectedRows);
    }
  }, [rowSelection, onRowSelectionChange, table]);

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Controls */}\n      <div className="flex items-center justify-between">\n        <div className="flex flex-1 items-center space-x-2">
          {enableSearch && (\n            <div className="relative">\n              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}\n                className="pl-8 max-w-sm"
              />
            </div>
          )}
          
          {searchKey && (
            <Input
              placeholder={`Filter by ${searchKey}...`}\n              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn(searchKey)?.setFilterValue(event.target.value)
              }\n              className="max-w-sm"
            />
          )}
        </div>
        
        {enableColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>\n              <Button variant="outline" size="sm" className="ml-auto">\n                <Settings className="mr-2 h-4 w-4" />
                View
              </Button>
            </DropdownMenuTrigger>\n            <DropdownMenuContent align="end" className="w-[150px]">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}\n                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Selection Info */}
      {enableRowSelection && table.getFilteredSelectedRowModel().rows.length > 0 && (\n        <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/50 px-3 py-2 text-sm">
          <span>\n            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </span>
          <Button\n            variant="ghost"\n            size="sm"
            onClick={() => setRowSelection({})}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}\n      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>\n                <TableCell colSpan={columns.length} className="h-24 text-center">\n                  <div className="flex items-center justify-center">\n                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>\n                    <span className="ml-2">Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'cursor-pointer',
                    row.getIsSelected() && 'bg-muted/50'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}\n                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}\n      <div className="flex items-center justify-between space-x-2 py-4">\n        <div className="text-sm text-muted-foreground">
          {pagination ? (
            <>\n              Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}\n              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total} entries
            </>
          ) : (
            <>\n              {table.getFilteredSelectedRowModel().rows.length} of{' '}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </>
          )}
        </div>
        \n        <div className="flex items-center space-x-2">
          {pagination ? (
            <>
              <Button\n                variant="outline"\n                size="sm"
                onClick={() => onPaginationChange?.({
                  pageIndex: 0,
                  pageSize: pagination.pageSize
                })}
                disabled={pagination.pageIndex === 0}
              >\n                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button\n                variant="outline"\n                size="sm"
                onClick={() => onPaginationChange?.({
                  pageIndex: pagination.pageIndex - 1,
                  pageSize: pagination.pageSize
                })}
                disabled={pagination.pageIndex === 0}
              >\n                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button\n                variant="outline"\n                size="sm"
                onClick={() => onPaginationChange?.({
                  pageIndex: pagination.pageIndex + 1,
                  pageSize: pagination.pageSize
                })}
                disabled={pagination.pageIndex >= pagination.pageCount - 1}
              >\n                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button\n                variant="outline"\n                size="sm"
                onClick={() => onPaginationChange?.({
                  pageIndex: pagination.pageCount - 1,
                  pageSize: pagination.pageSize
                })}
                disabled={pagination.pageIndex >= pagination.pageCount - 1}
              >\n                <ChevronsRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button\n                variant="outline"\n                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >\n                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button\n                variant="outline"\n                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >\n                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}