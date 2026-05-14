import React from 'react';
import { RepairRequestForm } from '@/components/forms/RepairRequestForm';
import { ShieldCheck, Clock, CheckCircle } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Schedule Repair",
  description: "Book your appliance repair appointment online. Fast service in the Hill Country with a 90-day warranty on parts and labor.",
};

export default function SchedulePage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-brand-black mb-4">Schedule Your Repair</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Complete the form below to request a service appointment. Our team will review your request and call you to confirm a specific time slot.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <RepairRequestForm />
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-brand-lightGreen p-6 rounded-2xl border border-brand-green/10">
            <h3 className="font-bold text-brand-black mb-4 flex items-center gap-2">
              <ShieldCheck className="text-brand-green" size={20} />
              Why Choose Us?
            </h3>
            <ul className="space-y-4 text-sm text-gray-700">
              <li className="flex gap-3">
                <CheckCircle className="text-brand-green shrink-0" size={16} />
                <span><strong>Free Service Call</strong> with any repair.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle className="text-brand-green shrink-0" size={16} />
                <span><strong>90-Day Warranty</strong> on parts and labor.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle className="text-brand-green shrink-0" size={16} />
                <span><strong>Local Experts</strong> serving the Hill Country for years.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle className="text-brand-green shrink-0" size={16} />
                <span><strong>All Major Brands</strong> serviced by certified technicians.</span>
              </li>
            </ul>
          </div>

          <div className="bg-brand-black text-white p-6 rounded-2xl">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Clock className="text-accent" size={20} />
              Need Urgent Help?
            </h3>
            <p className="text-sm text-gray-300 mb-6">
              For emergency service or same-day availability, please call us directly.
            </p>
            <div className="space-y-4">
              <a href="tel:830-353-0845" className="block text-center bg-brand-green hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors">
                Call Main: 830-353-0845
              </a>
              <a href="tel:830-353-3177" className="block text-center bg-white hover:bg-gray-100 text-brand-black font-bold py-3 rounded-lg transition-colors">
                Refrigeration: 830-353-3177
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
