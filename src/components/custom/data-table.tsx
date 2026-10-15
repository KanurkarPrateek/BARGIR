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
        </div>
    )
}