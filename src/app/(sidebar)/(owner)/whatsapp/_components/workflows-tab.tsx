'use client'
import { call } from '@/lib/action-result'
import {
    DeleteWorkflow,
    GetWorkflows,
    RunWorkflowsNow,
    SaveWorkflow,
    SetWorkflowEnabled,
    WorkflowInput,
    WorkflowResponse,
} from '@/action/whatsapp.action'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { TRIGGERS, WorkflowTrigger, describeOffset } from '@/lib/whatsapp/constants'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import TemplateEditor from './template-editor'

const EMPTY: WorkflowInput = {
    name: '',
    trigger: 'membership_expiry',
    offsetDays: 0,
    template: '',
    enabled: true,
}

const triggerOf = (value: WorkflowTrigger) => TRIGGERS.find((t) => t.value === value)!

const WorkflowsTab = () => {
    const [workflows, setWorkflows] = useState<WorkflowResponse[]>([])
    const [editing, setEditing] = useState<WorkflowInput | null>(null)

    const load = async () => setWorkflows(await GetWorkflows())
    useEffect(() => {
        load()
    }, [])

    const save = async () => {
        if (!editing) return
        try {
            await call(SaveWorkflow(editing))
            toast.success('Workflow saved')
            setEditing(null)
            load()
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const toggle = async (workflow: WorkflowResponse, enabled: boolean) => {
        setWorkflows((list) => list.map((w) => (w.id === workflow.id ? { ...w, enabled } : w)))
        await SetWorkflowEnabled(workflow.id, enabled)
    }

    const remove = async (workflow: WorkflowResponse) => {
        if (!confirm(`Delete "${workflow.name}"?`)) return
        await DeleteWorkflow(workflow.id)
        load()
    }

    const runNow = async () => {
        const queued = await RunWorkflowsNow()
        toast.success(queued ? `${queued} message${queued === 1 ? '' : 's'} queued` : 'Nothing new to send today')
    }

    const trigger = editing && triggerOf(editing.trigger)
    // Stored as one signed number; edited as "N days before/after".
    const offsetDirection = !editing || editing.offsetDays === 0 ? 'on' : editing.offsetDays < 0 ? 'before' : 'after'
    const setOffset = (direction: string, days: number) => {
        const n = Math.max(1, Math.abs(days) || 1)
        setEditing((w) => w && { ...w, offsetDays: direction === 'on' ? 0 : direction === 'before' ? -n : n })
    }

    return (
        <div className='space-y-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <p className='text-muted-foreground text-sm'>
                    Each workflow sends its message by itself. Dated ones go out between 9 am and 9 pm.
                </p>
                <div className='flex gap-2'>
                    <Button variant='outline' onClick={runNow}>Run now</Button>
                    <Button onClick={() => setEditing(EMPTY)}>New workflow</Button>
                </div>
            </div>

            {workflows.length === 0 && (
                <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No workflows yet.</p>
            )}

            {workflows.map((workflow) => {
                const info = triggerOf(workflow.trigger)
                return (
                    <div key={workflow.id} className='space-y-2 rounded-lg border p-4'>
                        <div className='flex items-start justify-between gap-4'>
                            <div>
                                <p className='font-medium'>{workflow.name}</p>
                                <p className='text-muted-foreground text-sm'>
                                    {info.label}
                                    {info.hasOffset && ` · ${describeOffset(workflow.offsetDays)}`}
                                    {` · ${workflow.sentCount} sent`}
                                </p>
                            </div>
                            <Switch checked={workflow.enabled} onCheckedChange={(checked) => toggle(workflow, checked)} />
                        </div>
                        <p className='bg-muted rounded-md px-3 py-2 text-sm whitespace-pre-wrap'>{workflow.template}</p>
                        <div className='flex gap-2'>
                            <Button size='sm' variant='outline' onClick={() => setEditing(workflow)}>Edit</Button>
                            <Button size='sm' variant='ghost' className='text-destructive' onClick={() => remove(workflow)}>Delete</Button>
                        </div>
                    </div>
                )
            })}

            <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className='max-h-[90vh] overflow-y-auto'>
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? 'Edit workflow' : 'New workflow'}</DialogTitle>
                        <DialogDescription>Choose when the message goes out and what it says.</DialogDescription>
                    </DialogHeader>
                    {editing && trigger && (
                        <div className='space-y-4'>
                            <div className='space-y-2'>
                                <Label>Name</Label>
                                <Input
                                    placeholder='e.g. Renewal reminder'
                                    value={editing.name}
                                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label>When</Label>
                                <Select
                                    value={editing.trigger}
                                    onValueChange={(value) => setEditing({ ...editing, trigger: value as WorkflowTrigger })}
                                >
                                    <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {TRIGGERS.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className='text-muted-foreground text-xs'>{trigger.description}</p>
                            </div>
                            {trigger.hasOffset && (
                                <div className='flex items-center gap-2'>
                                    {offsetDirection !== 'on' && (
                                        <>
                                            <Input
                                                type='number'
                                                min={1}
                                                className='w-20'
                                                value={Math.abs(editing.offsetDays)}
                                                onChange={(e) => setOffset(offsetDirection, Number(e.target.value))}
                                            />
                                            <span className='text-sm'>days</span>
                                        </>
                                    )}
                                    <Select value={offsetDirection} onValueChange={(value) => setOffset(value, editing.offsetDays)}>
                                        <SelectTrigger className='w-40'><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='before'>before</SelectItem>
                                            <SelectItem value='on'>On the day</SelectItem>
                                            <SelectItem value='after'>after</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <TemplateEditor
                                value={editing.template}
                                onChange={(template) => setEditing({ ...editing, template })}
                                placeholders={trigger.placeholders}
                            />
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

export default WorkflowsTab
