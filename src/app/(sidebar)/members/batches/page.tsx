'use client'
import { BatchRow, DeleteBatch, GetBatches, SaveBatch } from '@/action/batch.action'
import { call } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Editing = { id?: string; name: string; startTime: string; endTime: string }

// View Batch: the time slots members come in. Members are put in a batch from
// their profile; View Member can then be filtered by batch.
const BatchesPage = () => {
    const [batches, setBatches] = useState<BatchRow[]>([])
    const [editing, setEditing] = useState<Editing | null>(null)
    const load = async () => setBatches(await GetBatches())
    useEffect(() => { load() }, [])

    const save = async () => {
        try {
            await call(SaveBatch(editing!))
            toast.success('Batch saved')
            setEditing(null)
            load()
        } catch (error: any) {
            toast.error(error.message)
        }
    }
    const remove = async (b: BatchRow) => {
        if (!confirm(`Delete batch ${b.name}? Its ${b.members} member(s) will have no batch.`)) return
        try { await call(DeleteBatch(b.id)); load() } catch (error: any) { toast.error(error.message) }
    }

    return (
        <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
            <div className='flex items-center justify-between'>
                <div>
                    <h1 className='text-xl font-semibold'>View Batch</h1>
                    <p className='text-muted-foreground text-sm'>Workout time slots, e.g. Morning 6–8 AM.</p>
                </div>
                <Button onClick={() => setEditing({ name: '', startTime: '06:00', endTime: '08:00' })}>Add Batch</Button>
            </div>
            <Separator />
            {batches.length === 0 && <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No batches yet.</p>}
            {batches.map((b) => (
                <div key={b.id} className='flex items-center gap-4 rounded-lg border p-4'>
                    <div>
                        <p className='font-medium'>{b.name}</p>
                        <p className='text-muted-foreground text-sm'>{b.startTime} – {b.endTime} · {b.members} member{b.members === 1 ? '' : 's'}</p>
                    </div>
                    <span className='ml-auto flex gap-2'>
                        <Link href={`/members?batch=${b.id}`}><Button size='sm' variant='outline'>Members</Button></Link>
                        <Button size='sm' variant='outline' onClick={() => setEditing(b)}>Edit</Button>
                        <Button size='sm' variant='ghost' className='text-destructive' onClick={() => remove(b)}>Delete</Button>
                    </span>
                </div>
            ))}
            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? 'Edit batch' : 'Add Batch'}</DialogTitle>
                        <DialogDescription>Use 24-hour times, e.g. 18:00 for 6 PM.</DialogDescription>
                    </DialogHeader>
                    {editing && (
                        <div className='space-y-4'>
                            <div className='space-y-2'><Label>Name</Label><Input placeholder='Morning' value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                            <div className='grid grid-cols-2 gap-4'>
                                <div className='space-y-2'><Label>Starts</Label><Input type='time' value={editing.startTime} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })} /></div>
                                <div className='space-y-2'><Label>Ends</Label><Input type='time' value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} /></div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setEditing(null)}>Cancel</Button>
                        <Button onClick={save}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default BatchesPage
