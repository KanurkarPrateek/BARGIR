'use client'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import React from 'react'
import ConnectionCard from './_components/connection-card'
import MessageLog from './_components/message-log'
import OffersTab from './_components/offers-tab'
import WorkflowsTab from './_components/workflows-tab'

const WhatsappPage = () => {
    return (
        <div className='max-w-3xl w-full mx-auto space-y-6 p-4'>
            <div>
                <h1 className='text-xl font-semibold'>WhatsApp Management</h1>
                <p className='text-muted-foreground text-sm'>
                    Automatic messages for enquiries and memberships, and offers sent to everyone by name.
                </p>
            </div>
            <Separator />
            <ConnectionCard />
            <Tabs defaultValue='workflows'>
                <TabsList>
                    <TabsTrigger value='workflows'>Workflows</TabsTrigger>
                    <TabsTrigger value='offers'>Offers</TabsTrigger>
                    <TabsTrigger value='log'>Sent messages</TabsTrigger>
                </TabsList>
                <TabsContent value='workflows' className='pt-4'>
                    <WorkflowsTab />
                </TabsContent>
                <TabsContent value='offers' className='pt-4'>
                    <OffersTab />
                </TabsContent>
                <TabsContent value='log' className='pt-4'>
                    <MessageLog />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default WhatsappPage
