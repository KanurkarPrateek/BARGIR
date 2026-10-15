'use client'
import React, { useEffect } from 'react'
import { useReactToPrint } from "react-to-print";
import { useRef } from "react";
import { Button } from '@/components/ui/button';
import { ExpandedSalesResponse, GetSaleWithExpand } from '@/action/sales.action';

const Page = ({ params }: { params: any }) => {
    const unwrappedParams = React.use(params)
    const { sale_id } = unwrappedParams as { sale_id: string }
    const contentRef = useRef(null);
    const reactToPrintFn = useReactToPrint({ contentRef });

    return (
        <div className='max-w-5xl mx-auto px-4 py-4'>
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
            <div className='border border-gray-200 rounded-lg shadow-sm text-sm md:scale-100'>
                <Invoice ref={contentRef} sale_id={sale_id} />
            </div>
        </div>
    )
}

export default Page

const Invoice = ({
    ref,
    sale_id
}: { ref: any, sale_id: string }) => {

    const [saleData, setSaleData] = React.useState<ExpandedSalesResponse>()
    useEffect(() => {
        async function fetchData() {
            const sale = await GetSaleWithExpand(sale_id)
            setSaleData(sale)
        }
        fetchData()
    }, [])

    const invoiceData = {
        invoiceNumber: "INV-2025-0042",
        date: "May 6, 2025",
        termsAndConditions: [
            "Membership is non-transferable and non-refundable. The gym reserves the right to modify the terms of membership. Members must comply with all gym rules and regulations.",
        ]
    };

    // The gym that made the sale, so each gym's invoices carry its own details.
    const gym = (saleData as any)?.gym as { name: string; address: string; phone: string; email: string; gstin: string; invoiceTerms: string; logo: string } | undefined

    return (
        <div className='mx-auto bg-white text-black p-4 sm:p-8' ref={ref}>
            <div className="flex flex-col">
                {/* Header */}
                <div className="flex flex-wrap justify-between items-start gap-4 mb-10">
                    <div>
                        {gym?.logo && <img src={gym.logo} alt="" className="h-16 mb-4 object-contain" />}
                        <h1 className="text-black text-lg font-semibold">{gym?.name}</h1>
                        {gym?.address && <p className="text-gray-600">{gym.address}</p>}
                        {gym?.phone && <p className="text-gray-600">Contact: +91 {gym.phone}</p>}
                        {gym?.email && <p className="text-gray-600">{gym.email}</p>}
                        {gym?.gstin && <p className="text-gray-600">GSTIN: {gym.gstin}</p>}
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-semibold">INVOICE</h2>
                        {/* Stable per sale, so a reprinted invoice carries the same number. */}
                        <p className="text-gray-600">#{saleData?.id ? `INV-${saleData.id.slice(0, 8).toUpperCase()}` : ''}</p>
                        <p className="text-gray-600 w-40">Date: {saleData?.startDate}</p>
                    </div>
                </div>

                {/* Member Details */}
                <div className="mb-4">
                    <div className="">
                        <p className="">To,</p>
                        <p className="font-bold">{saleData?.member.name}</p>
                        <p className="">{saleData?.member.address}</p>
                        <p className="">Phone: {saleData?.member.phone}</p>
                    </div>
                </div>

                {/* Membership Details */}
                <div className="mb-4">
                    <h3 className="text-xl font-semibold border-b pb-2 ">Membership Details</h3>
                    <div className="flex flex-col space-y-2">
                        <div className="flex justify-between">
                            <span className="font-medium">Service:</span>
                            <span className='text-lg font-semibold'>{saleData?.service.name} membership</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium">Period:</span>
                            <span className='font-bold'>{saleData?.startDate} to {saleData?.endDate}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Summary */}
                <div className="mb-4">
                    <h3 className="text-xl font-semibold border-b pb-2 mb-3">Payment Summary</h3>
                    <div className="ml-2">
                        <div className="flex justify-between py-2">
                            <span>Total Amount:</span>
                            <span>₹{saleData?.amount}</span>
                        </div>
                        <div className="flex justify-between py-2">
                            <span>Discount:</span>
                            <span>-₹{saleData?.discount}</span>
                        </div>
                        <div className="flex justify-between py-2 font-semibold">
                            <span>Amount After Discount:</span>
                            <span>₹{saleData && (saleData?.amount - saleData?.discount)}</span>
                        </div>
                        <div className="flex justify-between py-2">
                            <span>Paid:</span>
                            <span>₹{saleData?.paid}</span>
                        </div>
                        <div className="flex justify-between py-2 font-bold text-lg border-t border-gray-200 mt-2 pt-2">
                            <span>Balance Due:</span>
                            <span >
                                ₹{saleData && (saleData?.amount - saleData?.discount - saleData?.paid)}</span>
                        </div>
                    </div>
                </div>

                {/* Thank You Message */}
                <div className="text-center my-2 py-2 border-t border-b border-gray-200">
                    <p className="text-gray-600">Thank you for choosing {gym?.name}! We appreciate your business and commitment to your fitness journey.</p>
                </div>
                {/* Terms and Conditions */}
                <div className="mb-8">
                    <h3 className="text-sm">Terms and Conditions</h3>
                    <ul className="text-xs text-gray-600">
                        {(gym?.invoiceTerms ? [gym.invoiceTerms] : invoiceData.termsAndConditions).map((term, index) => (
                            <li key={index}>{term}</li>
                        ))}
                    </ul>
                </div>


                {/* Footer */}
                <div className="text-center text-sm text-gray-500 ">
                    <p>If you have any questions regarding this invoice, please contact us.</p>
                    <p>{[gym?.phone && `+91 ${gym.phone}`, gym?.email].filter(Boolean).join(' | ')}</p>
                </div>
            </div>
        </div>
    );
};
