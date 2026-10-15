'use client'
import { call } from '@/lib/action-result'
import { ChangeMyPassword, GetGymProfile, GymProfile, UpdateGymProfile } from '@/action/staff.action'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

// Longest side of the stored logo, in pixels.
const LOGO_MAX_PX = 256

const SettingsPage = () => {
    const [profile, setProfile] = useState<GymProfile>({ name: '', address: '', phone: '', email: '', gstin: '', invoiceTerms: '', logo: '' })
    const [current, setCurrent] = useState('')
    const [next, setNext] = useState('')
    const logoInput = useRef<HTMLInputElement>(null)

    useEffect(() => {
        GetGymProfile().then((data) => data && setProfile(data))
    }, [])

    const field = (key: keyof GymProfile) => ({
        value: profile[key],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, [key]: e.target.value }),
    })

    // Shrinks the chosen image in the browser so it is small enough to store
    // with the gym's details and quick to load on every page.
    const chooseLogo = (file: File) => {
        const image = new Image()
        image.onload = () => {
            const scale = Math.min(1, LOGO_MAX_PX / Math.max(image.width, image.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(image.width * scale)
            canvas.height = Math.round(image.height * scale)
            canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
            setProfile((current) => ({ ...current, logo: canvas.toDataURL('image/png') }))
            URL.revokeObjectURL(image.src)
        }
        image.onerror = () => toast.error('That file is not an image')
        image.src = URL.createObjectURL(file)
    }

    const save = async () => {
        try {
            await call(UpdateGymProfile(profile))
            toast.success('Saved')
            // The sidebar shows the gym's name.
            window.location.reload()
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const changePassword = async () => {
        try {
            await call(ChangeMyPassword(current, next))
            toast.success('Password changed')
            setCurrent('')
            setNext('')
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    return (
        <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
            <div>
                <h1 className='text-xl font-semibold'>Gym Settings</h1>
                <p className='text-muted-foreground text-sm'>Your logo and details appear in the app, on invoices and in WhatsApp messages.</p>
            </div>
            <Separator />
            <Card>
                <CardHeader><CardTitle>Gym details</CardTitle></CardHeader>
                <CardContent className='space-y-4'>
                    <div className='space-y-2'>
                        <Label>Logo</Label>
                        <div className='flex items-center gap-4'>
                            <div className='bg-muted flex size-16 items-center justify-center overflow-hidden rounded-md border'>
                                {profile.logo
                                    ? <img src={profile.logo} alt='Gym logo' className='size-full object-contain' />
                                    : <span className='text-muted-foreground text-xs'>No logo</span>}
                            </div>
                            <input
                                ref={logoInput}
                                type='file'
                                accept='image/png,image/jpeg,image/webp'
                                className='hidden'
                                onChange={(e) => e.target.files?.[0] && chooseLogo(e.target.files[0])}
                            />
                            <Button variant='outline' onClick={() => logoInput.current?.click()}>Choose image</Button>
                            {profile.logo && <Button variant='ghost' onClick={() => setProfile({ ...profile, logo: '' })}>Remove</Button>}
                        </div>
                    </div>
                    <div className='space-y-2'><Label>Gym name</Label><Input {...field('name')} /></div>
                    <div className='space-y-2'><Label>Address</Label><Input {...field('address')} /></div>
                    <div className='space-y-2'><Label>Contact number</Label><Input type='tel' placeholder='10 digit mobile number' {...field('phone')} /></div>
                    <div className='space-y-2'><Label>Email</Label><Input type='email' {...field('email')} /></div>
                    <div className='space-y-2'><Label>GST number <span className='text-muted-foreground font-normal'>(optional)</span></Label><Input {...field('gstin')} /></div>
                    <div className='space-y-2'><Label>Invoice terms <span className='text-muted-foreground font-normal'>(printed at the bottom of invoices)</span></Label><Input placeholder='e.g. Membership is non-transferable and non-refundable.' {...field('invoiceTerms')} /></div>
                    <Button onClick={save}>Save</Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Change your password</CardTitle>
                    <CardDescription>At least 8 characters.</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <div className='space-y-2'><Label>Current password</Label><Input type='password' value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
                    <div className='space-y-2'><Label>New password</Label><Input type='password' value={next} onChange={(e) => setNext(e.target.value)} /></div>
                    <Button variant='outline' disabled={!current || !next} onClick={changePassword}>Change password</Button>
                </CardContent>
            </Card>
        </div>
    )
}

export default SettingsPage
