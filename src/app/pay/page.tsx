'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, ShieldCheck } from 'lucide-react';

const invoicePaymentSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  customerName: z.string().min(2, 'Name is required'),
  customerEmail: z.string().email('Invalid email address'),
  amount: z.string().refine((val) => !isNaN(Number(val)) && parseFloat(val) > 0, {
    message: 'Amount must be a positive number',
  }),
});

type InvoicePaymentValues = z.infer<typeof invoicePaymentSchema>;

export default function PayInvoicePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InvoicePaymentValues>({
    resolver: zodResolver(invoicePaymentSchema),
  });

  const onSubmit = async (data: InvoicePaymentValues) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(parseFloat(data.amount) * 100), // Convert to cents
          invoiceNumber: data.invoiceNumber,
          customerEmail: data.customerEmail,
          customerName: data.customerName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to initiate payment');
      }

      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-16 px-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <div className="bg-brand-lightGreen w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-green">
            <CreditCard size={32} />
          </div>
          <h1 className="text-3xl font-bold text-brand-black mb-2">Pay Your Invoice</h1>
          <p className="text-gray-600">Secure payment processing via Stripe</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Invoice Number</label>
            <Input {...register('invoiceNumber')} placeholder="e.g. INV-12345" />
            {errors.invoiceNumber && <p className="text-xs text-red-500">{errors.invoiceNumber.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Customer Name</label>
            <Input {...register('customerName')} placeholder="Your Name" />
            {errors.customerName && <p className="text-xs text-red-500">{errors.customerName.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address</label>
            <Input {...register('customerEmail')} type="email" placeholder="email@example.com" />
            {errors.customerEmail && <p className="text-xs text-red-500">{errors.customerEmail.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input {...register('amount')} className="pl-7" placeholder="0.00" step="0.01" type="number" />
            </div>
            {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full font-bold py-6 text-lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Redirecting to Stripe...
              </>
            ) : (
              'Pay Securely Now'
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-4">
            <ShieldCheck size={16} className="text-brand-green" />
            <span>Secure SSL Encryption & PCI Compliant</span>
          </div>
        </form>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Questions about your bill? <a href="tel:830-353-0845" className="text-brand-green font-semibold">Call 830-353-0845</a>
        </p>
      </div>
    </div>
  );
}
