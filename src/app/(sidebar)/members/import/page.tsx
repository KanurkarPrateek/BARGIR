'use client'
import { MemberImport } from '@/components/onboarding/member-import'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'

// Import Members: bring a whole member register in from Excel or CSV.
export default function ImportMembersPage() {
    return (
        <div className='max-w-3xl w-full mx-auto space-y-6 p-4'>
            <div>
                <h1 className='text-xl font-semibold'>Import Members</h1>
                <p className='text-muted-foreground text-sm'>
                    Upload your member list from Excel or CSV. Create your packages first under <Link href='/services' className='underline'>Package Management</Link> so running memberships can be matched.
                </p>
            </div>
            <Separator />
            <MemberImport />
        </div>
    )
}
