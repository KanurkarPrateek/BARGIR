'use client'
import { GetGroupSettings, GetWhatsappGroups, GroupSettings, SaveGroupSettings } from '@/action/whatsapp.action'
import { call } from '@/lib/action-result'
import type { WhatsappGroup } from '@/lib/whatsapp/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

// The gym's WhatsApp group: new members are added to it from the gym's number.
const GroupCard = () => {
    const [settings, setSettings] = useState<GroupSettings | null>(null)
    const [groups, setGroups] = useState<WhatsappGroup[] | null>(null)
    const [problem, setProblem] = useState('')
    const [groupId, setGroupId] = useState('')
    const [autoAdd, setAutoAdd] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        GetGroupSettings().then((s) => { setSettings(s); setGroupId(s.groupId ?? ''); setAutoAdd(s.groupId ? s.autoAdd : true) })
    }, [])

    const loadGroups = async () => {
        setProblem('')
        try {
            setGroups(await call(GetWhatsappGroups()))
        } catch (error: any) {
            setProblem(error.message)
        }
    }

    const save = async (id: string, auto: boolean) => {
        setSaving(true)
        try {
            const name = groups?.find((g) => g.id === id)?.name ?? settings?.groupName ?? null
            await call(SaveGroupSettings(id || null, name, auto))
            setSettings({ groupId: id || null, groupName: id ? name : null, autoAdd: !!id && auto })
            toast.success(id ? (auto ? `New members will be added to ${name}` : 'Group saved; members are added only with the button on their profile') : 'Group removed')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSaving(false)
        }
    }

    if (!settings) return null
    return (
        <Card>
            <CardHeader>
                <CardTitle>WhatsApp group</CardTitle>
                <CardDescription>
                    New members are added to the gym&apos;s group from your linked number. Your number must be an
                    admin of the group. If someone&apos;s privacy settings don&apos;t allow it, they get the group&apos;s invite link instead.
                </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
                {settings.groupId && (
                    <p className='text-sm'>
                        Group: <strong>{settings.groupName}</strong> ·{' '}
                        {settings.autoAdd ? 'new members are added automatically' : 'added only with the button on a member’s profile'}
                    </p>
                )}
                {groups === null ? (
                    <Button variant='outline' onClick={loadGroups}>{settings.groupId ? 'Change group' : 'Choose group'}</Button>
                ) : (
                    <div className='space-y-3'>
                        {groups.length === 0 && <p className='text-muted-foreground text-sm'>Your number is not in any group yet. Create one in WhatsApp, then choose it here.</p>}
                        {groups.length > 0 && (
                            <div className='space-y-2'>
                                <Label htmlFor='wa-group'>Group</Label>
                                <select id='wa-group' className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm' value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                                    <option value=''>No group</option>
                                    {groups.map((g) => (
                                        <option key={g.id} value={g.id} disabled={!g.isAdmin}>
                                            {g.name} ({g.size} people){g.isAdmin ? '' : ' — your number is not an admin'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className='flex items-center gap-2'>
                            <Switch id='wa-auto' checked={autoAdd} onCheckedChange={setAutoAdd} disabled={!groupId} />
                            <Label htmlFor='wa-auto'>Add new members automatically</Label>
                        </div>
                        <Button onClick={() => save(groupId, autoAdd)} disabled={saving}>Save group</Button>
                    </div>
                )}
                {problem && <p className='text-destructive text-sm'>{problem}</p>}
            </CardContent>
        </Card>
    )
}

export default GroupCard
