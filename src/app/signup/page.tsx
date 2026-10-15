'use client'
import { IsSignUpOpen, SignUpGym } from '@/action/onboarding.action'
import { call } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { capitalizeWords } from '@/lib/utils'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

// "Start your gym": a gym owner creates their own account in one form and
// goes straight into the setup wizard.
const SignUpPage = () => {
    const [form, setForm] = useState({ gymName: '', ownerName: '', phone: '', password: '' })
    const [open, setOpen] = useState(true)
    const [busy, setBusy] = useState(false)
    useEffect(() => { IsSignUpOpen().then(setOpen) }, [])

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setBusy(true)
        try {
            window.location.href = await call(SignUpGym(form))
        } catch (error: any) {
            toast.error(error.message)
            setBusy(false)
        }
    }

    return (
        <div className='flex min-h-svh w-full items-center justify-center p-6 md:p-10'>
            <Card className='w-full max-w-sm'>
                <CardHeader>
                    <CardTitle className='text-2xl'>Start your gym</CardTitle>
                    <CardDescription>Create your account. Setup takes about 5 minutes.</CardDescription>
                </CardHeader>
                <CardContent>
                    {!open ? (
                        <p className='text-sm'>New gyms are added by the platform admin. Please contact support. <Link href='/signin' className='underline'>Sign in</Link></p>
                    ) : (
                        <form onSubmit={submit} className='flex flex-col gap-4'>
                            <div className='grid gap-2'><Label htmlFor='gymName'>Gym name</Label><Input id='gymName' required value={form.gymName} onChange={(e) => setForm({ ...form, gymName: e.target.value })} /></div>
                            <div className='grid gap-2'><Label htmlFor='ownerName'>Your name</Label><Input id='ownerName' required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: capitalizeWords(e.target.value) })} /></div>
                            <div className='grid gap-2'><Label htmlFor='phone'>Your mobile number</Label><Input id='phone' type='tel' required placeholder='You sign in with this' value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                            <div className='grid gap-2'><Label htmlFor='password'>Password</Label><Input id='password' type='password' required placeholder='At least 8 characters' value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                            <Button type='submit' disabled={busy}>{busy ? 'Creating…' : 'Create my gym'}</Button>
                            <p className='text-muted-foreground text-center text-sm'>Already have an account? <Link href='/signin' className='underline'>Sign in</Link></p>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default SignUpPage
