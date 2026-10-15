// components/GlobalLoader.tsx
'use client';
import React from 'react';
import { useLoading } from '@/hooks/use-loading';
import { Card } from '../ui/card';

const GlobalLoader: React.FC = () => {
    const { isLoading } = useLoading();

    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 bg-black/50  flex items-center justify-center z-50 ">
            <Card className='px-4 py-4'>
                <div className="animate-spin rounded-full h-16 w-16 border-l-4 border-b-4 border-blue-500"></div>
            </Card>
        </div>
    );
};

export default GlobalLoader;