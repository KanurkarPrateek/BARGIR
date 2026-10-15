'use client'
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "../ui/input"
import { IconSearch } from "@tabler/icons-react"
import { useState, useMemo, ReactNode } from "react"
import { LoaderCircleIcon } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

interface Props {
    dataRows: any[],
    columns: {
        accessorKey: string,
        header: string,
        headerClassName?: string,
        cellClassName?: string
    }[],
    actionColumns?: {
        accessorKey: string,
        header: string,
        headerClassName?: string,
        cellClassName?: string,
        cellContent?: React.ReactNode,
        cellContentGetRow?: (row: any) => React.ReactNode,
        onClick?: (rowId: any) => void,
        onClickGetRow?: (row: any) => void
    }[],
    isLoading?: boolean,
    onItemClick?: (row: any) => void
}

export function DataTable({
    dataRows,
    columns,
    actionColumns,
    isLoading,
    onItemClick,
    ...props
}: Props) {
    const [searchTerm, setSearchTerm] = useState("")
    const isMobile = useIsMobile()

    const filteredRows = useMemo(() => {
        if (!searchTerm) return dataRows

        return dataRows.filter(row => {
            return columns.some(column => {
                const value = row[column.accessorKey]
                // Convert to string if not already and handle null/undefined
                const stringValue = value !== null && value !== undefined
                    ? String(value)
                    : ''
                return stringValue.toLowerCase().includes(searchTerm.toLowerCase())
            })
        })
    }, [dataRows, columns, searchTerm])

    return (
        <div className="space-y-4">
            <div className="relative">
                <Input
                    className="peer ps-8 pe-12"
                    placeholder="Search across all columns..."
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-sm peer-disabled:opacity-50">
                    <IconSearch className="size-4" />
                </span>
            </div>
            {isMobile ? (
                <MobileCards rows={filteredRows} columns={columns} actionColumns={actionColumns} isLoading={isLoading} onItemClick={onItemClick} />
            ) : (
            <div className="overflow-hidden rounded-lg border">
                <Table className="max-h-[100px]">
                    <TableHeader className="bg-input/30 sticky top-0 z-10">
                        <TableRow >
                            <TableHead className="">No.</TableHead>
                            {
                                columns.map((column) => (
                                    <TableHead className={column.headerClassName} key={column.accessorKey}>
                                        {column.header}
                                    </TableHead>
                                ))
                            }
                            {
                                actionColumns && (
                                    actionColumns.map((column, index) => (
                                        <TableHead className={column.headerClassName} key={index}>
                                            {column.header}
                                        </TableHead>
                                    ))
                                )
                            }
                        </TableRow>
                    </TableHeader>
                    {
                        isLoading ? (
                            <TableBody className="flex-row gap-2 items-center justify-center p-4">
                                <TableRow>
                                    <TableCell colSpan={columns.length + 1 + (actionColumns?.length ?? 0)}>
                                        <div className="w-full flex items-center justify-center p-4 gap-4">
                                            <LoaderCircleIcon
                                                className="-ms-1 animate-spin"
                                                size={16}
                                                aria-hidden="true"
                                            /> Loading
                                        </div>
                                    </TableCell>
                                </TableRow>

                            </TableBody>
                        ) : (
                            <TableBody className="">
                                {filteredRows.length > 0 ? (
                                    filteredRows.map((row: any, index: number) => (
                                        <TableRow key={row.id ?? index}  className="cursor-pointer hover:bg-muted">
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            {
                                                columns.map((column) => (
                                                    <TableCell
                                                        key={column.accessorKey}
                                                        className={column.cellClassName}
                                                        onClick={() => onItemClick && onItemClick(row)}
                                                    >
                                                        {row[column.accessorKey]}
                                                    </TableCell>
                                                ))
                                            }
                                            {
                                                actionColumns && (
                                                    actionColumns.map((column, index) => (
                                                        <TableCell className={column.cellClassName} key={index}>
                                                            <div onClick={() => {
                                                                column.onClick && column.onClick(row[column.accessorKey])
                                                                column.onClickGetRow && column.onClickGetRow(row)
                                                            }}>
                                                                {(column.cellContentGetRow) ? column.cellContentGetRow(row) : column.cellContent}
                                                            </div>
                                                        </TableCell>
                                                    )
                                                    ))
                                            }
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center"
                                        >
                                            No results found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        )
                    }

                    {/* <TableFooter>
                    </TableFooter> */}
                </Table>
            </div>
            )}
        </div>
    )
}

// On a phone each row becomes a card: the name on top, the other columns as
// label / value pairs, and the row's buttons along the bottom.
function MobileCards({ rows, columns, actionColumns, isLoading, onItemClick }: Omit<Props, "dataRows"> & { rows: any[] }) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-4 rounded-lg border p-6">
                <LoaderCircleIcon className="animate-spin" size={16} aria-hidden="true" /> Loading
            </div>
        )
    }
    if (rows.length === 0) return <p className="text-muted-foreground rounded-lg border p-6 text-center text-sm">No results found</p>
    // The person is the most useful title: "Member Name" before "Service Name".
    const title = columns.find((c) => /member name|^name$/i.test(c.header)) ?? columns.find((c) => /name/i.test(c.header)) ?? columns[0]
    const rest = columns.filter((c) => c !== title)
    return (
        <ul className="space-y-3">
            {rows.map((row, index) => (
                <li key={row.id ?? index} className="rounded-lg border p-4">
                    <div className={onItemClick ? "cursor-pointer" : ""} onClick={() => onItemClick && onItemClick(row)}>
                        <p className="font-medium">{row[title.accessorKey]}</p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            {rest.map((column) => (
                                <div key={column.accessorKey} className="min-w-0">
                                    <dt className="text-muted-foreground text-xs">{column.header}</dt>
                                    <dd className="break-words">{row[column.accessorKey] ?? "—"}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    {actionColumns && actionColumns.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                            {actionColumns.map((column, i) => (
                                <div key={i} className="flex items-center gap-1.5" onClick={() => {
                                    column.onClick && column.onClick(row[column.accessorKey])
                                    column.onClickGetRow && column.onClickGetRow(row)
                                }}>
                                    {/* Some buttons are icon-only; the column name says what they do. */}
                                    {column.header && <span className="text-muted-foreground text-xs">{column.header}</span>}
                                    {column.cellContentGetRow ? column.cellContentGetRow(row) : column.cellContent}
                                </div>
                            ))}
                        </div>
                    )}
                </li>
            ))}
        </ul>
    )
}