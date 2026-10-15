'use client'
import { ImportMembers, ImportResult, ImportRow } from '@/action/onboarding.action'
import { call } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { format } from 'date-fns'
import React, { useRef, useState } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

// Column titles people actually use in their registers, mapped to our fields.
const HEADERS: Record<keyof ImportRow, string[]> = {
    name: ['name', 'membername', 'fullname'],
    phone: ['phone', 'mobile', 'mobileno', 'mobilenumber', 'phonenumber', 'contact', 'contactno', 'whatsapp'],
    gender: ['gender', 'sex'],
    dob: ['dob', 'dateofbirth', 'birthdate', 'birthday'],
    joinDate: ['joiningdate', 'joindate', 'doj', 'dateofjoining', 'joined'],
    package: ['package', 'plan', 'membership', 'packagename', 'planname'],
    startDate: ['startdate', 'planstart', 'packagestart', 'from', 'validfrom'],
    paid: ['paid', 'amountpaid', 'payment', 'amount', 'fees'],
    email: ['email', 'emailid', 'mail'],
    machineId: ['machineid', 'biometricid', 'fingerprintid', 'idonmachine', 'enrollid'],
}
const key = (title: string) => title.toLowerCase().replace(/[^a-z]/g, '')
const CHUNK = 100

function readRows(sheet: XLSX.WorkSheet): ImportRow[] {
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true })
    return raw.map((record) => {
        const row: Record<string, string> = {}
        for (const [title, value] of Object.entries(record)) {
            const field = (Object.keys(HEADERS) as (keyof ImportRow)[]).find((f) => HEADERS[f].includes(key(title)))
            if (!field) continue
            row[field] = value instanceof Date ? format(value, 'dd-MM-yyyy') : String(value).trim()
        }
        return row as unknown as ImportRow
    }).filter((row) => row.name || row.phone)
}

export function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([
        ['Name', 'Phone', 'Gender', 'Date of birth', 'Joining date', 'Package', 'Start date', 'Paid', 'Email', 'Machine ID'],
        ['Rahul Sharma', '9876543210', 'Male', '15-08-1995', '01-04-2026', 'Monthly Gym', '01-10-2026', '1000', 'rahul@example.com', '12'],
        ['Priya Patil', '9876543211', 'Female', '', '10-01-2026', 'Quarterly Gym', '10-09-2026', '2000', '', ''],
    ])
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Members')
    XLSX.writeFile(book, 'members-template.xlsx')
}

// Upload an Excel or CSV member register; shows what was read, then imports
// it in chunks with a progress bar and lists any rows that need fixing.
export function MemberImport({ onDone }: { onDone?: (result: ImportResult) => void }) {
    const input = useRef<HTMLInputElement>(null)
    const [rows, setRows] = useState<ImportRow[]>([])
    const [fileName, setFileName] = useState('')
    const [progress, setProgress] = useState<number | null>(null)
    const [result, setResult] = useState<ImportResult | null>(null)

    const read = async (file: File) => {
        try {
            const book = XLSX.read(await file.arrayBuffer(), { cellDates: true })
            const parsed = readRows(book.Sheets[book.SheetNames[0]])
            if (parsed.length === 0) throw new Error('No members found. The first row must hold column titles like Name and Phone.')
            setRows(parsed); setFileName(file.name); setResult(null)
        } catch (error: any) {
            toast.error(error.message ?? 'Could not read that file')
        }
        if (input.current) input.current.value = ''
    }

    const run = async () => {
        const total: ImportResult = { created: 0, withSubscription: 0, problems: [] }
        setProgress(0)
        try {
            for (let i = 0; i < rows.length; i += CHUNK) {
                // Row 1 of the sheet is the column titles, so data starts at row 2.
                const part = await call(ImportMembers(rows.slice(i, i + CHUNK), i + 2))
                total.created += part.created; total.withSubscription += part.withSubscription; total.problems.push(...part.problems)
                setProgress(Math.round(((i + CHUNK) / rows.length) * 100))
            }
            setResult(total); setRows([])
            toast.success(`${total.created} member${total.created === 1 ? '' : 's'} imported`)
            onDone?.(total)
        } catch (error: any) {
            toast.error(error.message)
        }
        setProgress(null)
    }

    return (
        <div className='space-y-4'>
            <input ref={input} type='file' accept='.xlsx,.xls,.csv' className='hidden' onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
            <div className='flex flex-wrap gap-2'>
                <Button onClick={() => input.current?.click()}>Choose Excel or CSV file</Button>
                <Button variant='outline' onClick={downloadTemplate}>Download template</Button>
            </div>
            <p className='text-muted-foreground text-sm'>
                Only <strong>Name</strong> and <strong>Phone</strong> are needed. Add <strong>Package</strong> and <strong>Start date</strong> to bring in running
                memberships too (the package must exist with the same name). Column titles can be in any order. Nobody is messaged during import.
            </p>

            {rows.length > 0 && (
                <div className='space-y-3 rounded-lg border p-4'>
                    <p className='font-medium'>{rows.length} member{rows.length === 1 ? '' : 's'} found in {fileName}</p>
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                            <thead className='text-muted-foreground text-left'>
                                <tr><th className='pr-3'>Name</th><th className='pr-3'>Phone</th><th className='pr-3'>Package</th><th className='pr-3'>Start</th><th>Paid</th></tr>
                            </thead>
                            <tbody>
                                {rows.slice(0, 8).map((r, i) => (
                                    <tr key={i}><td className='pr-3'>{r.name}</td><td className='pr-3'>{r.phone}</td><td className='pr-3'>{r.package || '—'}</td><td className='pr-3'>{r.startDate || '—'}</td><td>{r.paid || '—'}</td></tr>
                                ))}
                            </tbody>
                        </table>
                        {rows.length > 8 && <p className='text-muted-foreground mt-1 text-xs'>and {rows.length - 8} more</p>}
                    </div>
                    {progress === null
                        ? <Button onClick={run}>Import {rows.length} member{rows.length === 1 ? '' : 's'}</Button>
                        : <div className='space-y-1'><Progress value={progress} /><p className='text-muted-foreground text-xs'>Importing…</p></div>}
                </div>
            )}

            {result && (
                <div className='space-y-2 rounded-lg border p-4 text-sm'>
                    <p><strong>{result.created}</strong> imported, <strong>{result.withSubscription}</strong> with a running package.</p>
                    {result.problems.length > 0 && (
                        <>
                            <p className='text-destructive'>{result.problems.length} row{result.problems.length === 1 ? '' : 's'} need attention:</p>
                            <ul className='max-h-56 space-y-1 overflow-y-auto'>
                                {result.problems.map((p) => <li key={p.row}>Row {p.row} · {p.name}: {p.reason}</li>)}
                            </ul>
                            <p className='text-muted-foreground'>Fix those rows in your file, delete the rest, and import it again.</p>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
