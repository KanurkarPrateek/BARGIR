'use client'
import { ChangePassword } from '@/action/auth.action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useLoading } from '@/hooks/use-loading'
import Link from 'next/link'
import React from 'react'
import { toast } from 'sonner'

type Props = {}

const page = (props: Props) => {
    const [formState, setFormState] = React.useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
    })
    const {showLoading, hideLoading} = useLoading()

    const member_id = localStorage.getItem('member_id')
    const handleSubmit = async () => {
        showLoading()
        if(formState.oldPassword === '' || formState.newPassword === '' || formState.confirmPassword === '') {
            toast.error('Please fill all the required fields')
            hideLoading()
            return
        }
        if(formState.newPassword !== formState.confirmPassword) {
            toast.error('New password and confirm password must be same')
            hideLoading()
            return
        }
        if(formState.newPassword.length < 8) {
            toast.error('New password must be at least 8 characters long')
            hideLoading()
            return
        }
        const res = await ChangePassword({
            oldPassword: formState.oldPassword,
            newPassword: formState.newPassword,
            member_id: localStorage && localStorage.getItem('member_id') || '',
        })
        if(res.success) {
            toast.success('Password changed successfully')
            hideLoading()
            window.location.href = '/user'
            return
        }
        toast.error('Failed to change password')
        hideLoading()
        return
    }
    return (
        <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
            <div className='flex items-center justify-between'>
                <h1 className='text-xl font-semibold'>Change Password</h1>

            </div>
            <Separator />
            <div className='space-y-6'>
                <div className="space-y-2">
                    <Label>
                        Old password <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        placeholder="Enter old password"
                        type="text"
                        required
                        value={formState.oldPassword}
                        onChange={(e) => setFormState({ ...formState, oldPassword: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>
                        New password <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        placeholder="Enter new password"
                        type="text"
                        required
                        value={formState.newPassword}
                        onChange={(e) => setFormState({ ...formState, newPassword: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>
                        Confirm password <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        placeholder="Enter confirm password"
                        type="text"
                        required
                        value={formState.confirmPassword}
                        onChange={(e) => setFormState({ ...formState, confirmPassword: e.target.value })}
                    />
                </div>
                <Button className='w-full sm:w-fit' onClick={handleSubmit}>
                    Update
                </Button>
            </div>
        </div>
    )
}

export default page