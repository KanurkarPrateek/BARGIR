'use client'
import { GetSetupState, SetupState } from '@/action/onboarding.action'
import { GetSessionInfo } from '@/action/staff.action'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'

// Reminds the owner of the setup steps still open, until they finish the wizard.
export function SetupBanner() {
    const [state, setState] = useState<SetupState | null>(null)
    const [owner, setOwner] = useState(false)
    useEffect(() => {
        GetSessionInfo().then((s) => setOwner(!!s && s.role !== 'staff'))
        GetSetupState().then(setState)
    }, [])
    if (!owner || !state || state.setupDone) return null
    const todo = [
        state.packages === 0 && 'add your packages',
        state.members === 0 && 'import your members',
        state.machines === 0 && 'connect your biometric machine',
    ].filter(Boolean)
    return (
        <div className='mx-4 flex flex-wrap items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900 lg:mx-6 dark:bg-blue-950 dark:text-blue-100'>
            <span><strong>Finish setting up your gym.</strong> {todo.length ? `Still to do: ${todo.join(', ')}.` : 'A few steps left.'}</span>
            <Link href='/setup' className='ml-auto'><Button size='sm'>Continue setup</Button></Link>
        </div>
    )
}
