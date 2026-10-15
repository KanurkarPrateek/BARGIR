'use client'
import React, { useEffect } from 'react'
import { useReactToPrint } from "react-to-print";
import { useRef } from "react";
import { Button } from '@/components/ui/button';
import { ExpandedSalesResponse, GetSaleWithExpand } from '@/action/sales.action';
import { brandColors } from '@/lib/brand';
import { paymentModeLabel, rupees } from '@/lib/membership';

const Page = ({ params }: { params: any }) => {
    const unwrappedParams = React.use(params)
    const { sale_id } = unwrappedParams as { sale_id: string }
    const contentRef = useRef(null);
    const reactToPrintFn = useReactToPrint({ contentRef });

    return (
        <div className='max-w-4xl mx-auto px-4 py-4'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <h1 className='font-bold mb-2'>Sales Invoice</h1>
                <div className='mb-2 flex flex-wrap gap-2'>
                    <a href={`/invoices/${sale_id}/pdf?download`}>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">Download PDF</Button>
                    </a>
                    <Button
                        onClick={reactToPrintFn}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        Print Invoice
                    </Button>
                    <Button
                        onClick={()=>navigator.share({ 
                            title: "Sales Invoice", 
                            text: `Dear customer, below is the link to the invoice for your recent purchase. Thank you for choosing us.\n\nLink: ${window.location.href}`, 
                        })}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        Share
                    </Button>
                </div>
            </div>
            <div className='overflow-hidden rounded-lg border border-gray-200 shadow-sm'>
                <Invoice ref={contentRef} sale_id={sale_id} />
            </div>
        </div>
    )
}

export default Page

const DEFAULT_TERMS = "Membership is non-transferable and non-refundable. The gym reserves the right to modify the terms of membership. Members must comply with all gym rules and regulations."

type Gym = { name: string; address: string; phone: string; email: string; gstin: string; invoiceTerms: string; logo: string; brandColor: string }

// Same layout as the PDF (src/lib/invoice-pdf.ts): a band in the gym's brand
// colour with its logo and details, then who it is for, the plan, totals,
// payments received and the terms.
const Invoice = ({ ref, sale_id }: { ref: any, sale_id: string }) => {
    const [sale, setSale] = React.useState<ExpandedSalesResponse & { gym: Gym; payments: { date: string; mode: string; amount: number }[] }>()
    useEffect(() => {
        GetSaleWithExpand(sale_id).then(setSale)
    }, [sale_id])

    const gym = sale?.gym
    const c = brandColors(gym?.brandColor)
    const number = sale ? `INV-${sale.id.slice(0, 8).toUpperCase()}` : ''
    const total = sale ? sale.amount - sale.discount : 0
    const due = sale ? Math.max(0, total - sale.paid) : 0

    return (
        // Keep the colours when printing.
        <div ref={ref} className='bg-white text-[#111] text-sm' style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            {/* Brand band */}
            <div className='flex flex-wrap items-start justify-between gap-6 px-6 py-6 sm:px-10' style={{ background: c.brand, color: c.onBrand }}>
                <div className='flex min-w-0 items-start gap-4'>
                    {gym?.logo && (
                        <div className='shrink-0 rounded-lg bg-white p-1.5 shadow-sm'>
                            <img src={gym.logo} alt='' className='size-14 object-contain' />
                        </div>
                    )}
                    <div className='min-w-0'>
                        <h1 className='text-xl font-bold leading-tight'>{gym?.name}</h1>
                        <div className='mt-1 space-y-0.5 text-xs opacity-90'>
                            {gym?.address && <p>{gym.address}</p>}
                            {gym?.phone && <p>Contact: +91 {gym.phone}</p>}
                            {gym?.email && <p>{gym.email}</p>}
                            {gym?.gstin && <p>GSTIN: {gym.gstin}</p>}
                        </div>
                    </div>
                </div>
                <div className='text-right'>
                    <h2 className='text-2xl font-extrabold tracking-[0.2em]'>INVOICE</h2>
                    <p className='mt-1 text-xs opacity-90'>#{number}</p>
                    <p className='text-xs opacity-90'>Date: {sale?.startDate}</p>
                </div>
            </div>

            <div className='space-y-7 px-6 py-7 sm:px-10'>
                {/* Billed to + status */}
                <div className='flex flex-wrap items-start justify-between gap-6'>
                    <div>
                        <p className='text-[11px] font-semibold uppercase tracking-wider' style={{ color: c.ink }}>Billed to</p>
                        <p className='mt-1 text-base font-bold'>{sale?.member.name}</p>
                        {sale?.member.memberCode && <p className='text-gray-600'>Member ID: {sale.member.memberCode}</p>}
                        <p className='text-gray-600'>Phone: {sale?.member.phone}</p>
                        {sale?.member.address && <p className='text-gray-600'>{sale.member.address}</p>}
                    </div>
                    {sale && (
                        <span className={`rounded-full border-2 px-3 py-1 text-xs font-bold tracking-wider ${due === 0 ? 'border-green-700 text-green-700' : 'border-amber-600 text-amber-700'}`}>
                            {due === 0 ? 'PAID' : `BALANCE DUE ${rupees(due)}`}
                        </span>
                    )}
                </div>

                {/* Items */}
                <table className='w-full text-left'>
                    <thead>
                        <tr style={{ background: c.soft, color: c.ink }}>
                            <th className='rounded-l-md px-3 py-2 text-xs font-semibold uppercase tracking-wider'>Description</th>
                            <th className='hidden px-3 py-2 text-xs font-semibold uppercase tracking-wider sm:table-cell'>Period</th>
                            <th className='rounded-r-md px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider'>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className='border-b border-gray-100'>
                            <td className='px-3 py-3'>
                                <p className='font-semibold'>{sale?.service.name} membership</p>
                                <p className='text-xs text-gray-500 sm:hidden'>{sale?.startDate} to {sale?.endDate}</p>
                            </td>
                            <td className='hidden px-3 py-3 text-gray-600 sm:table-cell'>{sale?.startDate} to {sale?.endDate}</td>
                            <td className='px-3 py-3 text-right tabular-nums'>{sale && rupees(sale.amount)}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Totals */}
                <div className='flex justify-end'>
                    <div className='w-full space-y-1.5 sm:w-72'>
                        <div className='flex justify-between'><span className='text-gray-600'>Subtotal</span><span className='tabular-nums'>{sale && rupees(sale.amount)}</span></div>
                        {!!sale?.discount && <div className='flex justify-between'><span className='text-gray-600'>Discount</span><span className='tabular-nums'>-{rupees(sale.discount)}</span></div>}
                        <div className='flex justify-between border-t border-gray-200 pt-1.5 font-semibold'><span>Total</span><span className='tabular-nums'>{sale && rupees(total)}</span></div>
                        <div className='flex justify-between'><span className='text-gray-600'>Paid</span><span className='tabular-nums'>{sale && rupees(sale.paid)}</span></div>
                        <div className='mt-2 flex justify-between rounded-md px-3 py-2 text-base font-bold' style={{ background: c.brand, color: c.onBrand }}>
                            <span>Balance Due</span><span className='tabular-nums'>{sale && rupees(due)}</span>
                        </div>
                    </div>
                </div>

                {/* Payments */}
                {!!sale?.payments.length && (
                    <div>
                        <p className='mb-2 text-[11px] font-semibold uppercase tracking-wider' style={{ color: c.ink }}>Payments received</p>
                        <table className='w-full'>
                            <tbody>
                                {sale.payments.map((p, i) => (
                                    <tr key={i} className='border-b border-gray-100 last:border-0'>
                                        <td className='py-1.5'>{p.date}</td>
                                        <td className='py-1.5 text-gray-600'>{paymentModeLabel(p.mode)}</td>
                                        <td className='py-1.5 text-right tabular-nums'>{rupees(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <p className='border-t border-gray-200 pt-5 text-center text-gray-600'>
                    Thank you for choosing <strong style={{ color: c.ink }}>{gym?.name}</strong>! We appreciate your commitment to your fitness journey. 💪
                </p>

                <div>
                    <p className='text-xs font-semibold'>Terms and Conditions</p>
                    <p className='mt-1 text-xs text-gray-500'>{gym?.invoiceTerms || DEFAULT_TERMS}</p>
                </div>
            </div>

            {/* Footer */}
            <div className='px-6 pb-4 text-center text-xs text-gray-500 sm:px-10'>
                <p>If you have any questions regarding this invoice, please contact us.</p>
                <p>{[gym?.phone && `+91 ${gym.phone}`, gym?.email].filter(Boolean).join(' | ')}</p>
            </div>
            <div className='h-2' style={{ background: c.brand }} />
        </div>
    );
};
