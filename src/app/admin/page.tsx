'use client';

import React, { useEffect, useState } from 'react';
import { 
  ClipboardList, 
  CreditCard, 
  Users, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [data, setData] = useState<{ requests: any[], payments: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/data')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-black">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  const totalRequests = data?.requests?.length || 0;
  const totalRevenue = (data?.payments?.reduce((acc, p) => acc + p.amount, 0) || 0) / 100;
  const pendingRequests = data?.requests?.filter(r => r.status === 'pending')?.length || 0;

  const stats = [
    { name: 'Total Requests', value: totalRequests.toString(), icon: ClipboardList, change: '+12%', changeType: 'increase' },
    { name: 'Total Revenue', value: `${totalRevenue.toLocaleString()}`, icon: CreditCard, change: '+8%', changeType: 'increase' },
    { name: 'Pending Repairs', value: pendingRequests.toString(), icon: Clock, change: '-2', changeType: 'decrease' },
    { name: 'Customer Satisfaction', value: '98%', icon: TrendingUp, change: '+1%', changeType: 'increase' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-secondary text-black">Dashboard Overview</h1>
        <p className="text-gray-500">Welcome back, Admin. Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-black">
            <div className="flex items-center justify-between mb-4 text-black">
              <div className="p-3 bg-primary/5 rounded-xl text-primary">
                <stat.icon size={24} />
              </div>
              <div className={`flex items-center text-sm font-bold ${
                stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change}
                {stat.changeType === 'increase' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              </div>
            </div>
            <p className="text-gray-500 text-sm font-medium">{stat.name}</p>
            <p className="text-2xl font-bold text-secondary mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-black">
        {/* Recent Requests */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-black">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between text-black">
            <h2 className="font-bold text-secondary text-lg">Recent Requests</h2>
            <Link href="/admin/requests" className="text-primary text-sm font-bold hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto text-black">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Customer</th>
                  <th className="px-6 py-4 font-semibold">Appliance</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-black">
                {data?.requests?.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors text-black">
                    <td className="px-6 py-4 font-medium text-secondary">{row.name}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{row.appliance_type}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        row.status === 'completed' ? 'bg-green-100 text-green-700' :
                        row.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!data?.requests || data.requests.length === 0) && (
              <p className="p-8 text-center text-gray-500 italic">No repair requests found.</p>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-black">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between text-black">
            <h2 className="font-bold text-secondary text-lg">Recent Payments</h2>
            <Link href="/admin/payments" className="text-primary text-sm font-bold hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto text-black">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Invoice #</th>
                  <th className="px-6 py-4 font-semibold">Customer</th>
                  <th className="px-6 py-4 font-semibold">Amount</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-black">
                {data?.payments?.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors text-black">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{row.invoice_number}</td>
                    <td className="px-6 py-4 font-medium text-secondary">{row.customer_name}</td>
                    <td className="px-6 py-4 text-secondary font-bold">${(row.amount / 100).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        row.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!data?.payments || data.payments.length === 0) && (
              <p className="p-8 text-center text-gray-500 italic">No payments found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
