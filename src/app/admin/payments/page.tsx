'use client';

import React, { useEffect, useState } from 'react';
import { Search, Filter, Download, MoreVertical, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('/api/admin/data')
      .then(res => res.json())
      .then(data => setPayments(data.payments || []))
      .finally(() => setLoading(false));
  }, []);

  const filteredPayments = payments.filter(p => 
    p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-black">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  const monthlyRevenue = payments.reduce((acc, p) => acc + p.amount, 0) / 100;

  return (
    <div className="space-y-6 text-black">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-black">
        <div>
          <h1 className="text-2xl font-bold text-secondary text-black">Stripe Transactions</h1>
          <p className="text-gray-500 text-sm">Monitor and manage all customer invoice payments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2 text-black border-gray-200">
            <Download size={18} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-black">
           <p className="text-gray-500 text-sm font-medium">Daily Revenue</p>
           <p className="text-2xl font-bold text-secondary mt-1 text-black">$0.00</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-black">
           <p className="text-gray-500 text-sm font-medium">Total Revenue</p>
           <p className="text-2xl font-bold text-secondary mt-1 text-black">${monthlyRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-black">
           <p className="text-gray-500 text-sm font-medium">Total Transactions</p>
           <p className="text-2xl font-bold text-secondary mt-1 text-black">{payments.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow text-black">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input 
            placeholder="Search transactions..." 
            className="pl-10 text-black" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 text-black">
          <Button variant="outline" className="flex items-center gap-2 text-black border-gray-200">
            <Filter size={18} /> Status
          </Button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-black">
        <div className="overflow-x-auto text-black">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold text-black">Invoice</th>
                <th className="px-6 py-4 font-semibold text-black">Customer</th>
                <th className="px-6 py-4 font-semibold text-black">Amount</th>
                <th className="px-6 py-4 font-semibold text-black">Date</th>
                <th className="px-6 py-4 font-semibold text-black">Status</th>
                <th className="px-6 py-4 font-semibold text-right text-black">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-black">
              {filteredPayments.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 text-black">
                    <div className="font-mono text-xs font-bold text-primary">{row.invoice_number}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{row.stripe_session_id ? row.stripe_session_id.substring(0, 15) : 'Manual'}...</div>
                  </td>
                  <td className="px-6 py-4 text-black">
                    <div className="font-medium text-secondary">{row.customer_name}</div>
                  </td>
                  <td className="px-6 py-4 text-black">
                    <div className="text-sm font-bold text-secondary">${(row.amount / 100).toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-black">
                    <div className="flex items-center gap-1.5 text-black">
                      {row.status === 'paid' ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                      ) : (
                        <Clock size={16} className="text-yellow-500" />
                      )}
                      <span className={`font-bold ${
                        row.status === 'paid' ? 'text-green-700' : 'text-yellow-700'
                      }`}>
                        {row.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-gray-400 hover:text-secondary transition-colors">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPayments.length === 0 && (
            <p className="p-8 text-center text-gray-500 italic">No payments found.</p>
          )}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-black">
           <p className="text-xs text-gray-500 font-medium">Showing {filteredPayments.length} results</p>
           <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled className="text-black border-gray-200">Previous</Button>
              <Button variant="outline" size="sm" disabled className="text-black border-gray-200">Next</Button>
           </div>
        </div>
      </div>
    </div>
  );
}
