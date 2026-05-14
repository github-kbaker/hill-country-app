import React from 'react';
import Link from 'next/link';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function SuccessPage() {
  return (
    <div className="max-w-xl mx-auto py-20 px-6 text-center">
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100">
        <div className="bg-brand-lightGreen w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-green">
          <CheckCircle size={48} />
        </div>
        <h1 className="text-3xl font-bold text-brand-black mb-4">Payment Successful!</h1>
        <p className="text-gray-600 mb-8 text-lg">
          Thank you for your payment. Your transaction has been completed successfully and a receipt has been emailed to you.
        </p>
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center justify-center gap-2 w-full bg-brand-green hover:bg-green-700 text-white font-bold py-4 rounded-lg transition-colors">
            Return to Homepage <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
