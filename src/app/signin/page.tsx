'use client'
import { call } from '@/lib/action-result'
import { SignIn } from '@/action/staff.action'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import React, { useState } from 'react'
import { toast } from 'sonner'

const SignInPage = () => {
    const [login, setLogin] = useState('')
    const [password, setPassword] = useState('')
    const [busy, setBusy] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setBusy(true)
        try {
            window.location.href = await call(SignIn(login, password))
        } catch (error: any) {
            toast.error(error.message)
            setBusy(false)
        }
    }

    return (
        <div className='flex min-h-svh w-full items-center justify-center p-6 md:p-10'>
            <Card className='w-full max-w-sm'>
                <CardHeader>
                    <CardTitle className='text-2xl'>Gym sign in</CardTitle>
                    <CardDescription>For gym owners and staff.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className='flex flex-col gap-5'>
                        <div className='grid gap-2'>
                            <Label htmlFor='login'>Phone number</Label>
                            <Input id='login' autoComplete='username' value={login} onChange={(e) => setLogin(e.target.value)} required />
                        </div>
                        <div className='grid gap-2'>
                            <Label htmlFor='password'>Password</Label>
                            <Input id='password' type='password' autoComplete='current-password' value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>
                        <Button type='submit' disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
                        <p className='text-muted-foreground text-center text-sm'>
                            A gym member? <Link href='/login' className='underline'>Member login</Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

export default SignInPage
