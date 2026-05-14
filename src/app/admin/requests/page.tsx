'use client';

import React, { useEffect, useState } from 'react';
import { Search, Filter, Download, MoreVertical, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('/api/admin/data')
      .then(res => res.json())
      .then(data => setRequests(data.requests || []))
      .finally(() => setLoading(false));
  }, []);

  const filteredRequests = requests.filter(req => 
    req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.appliance_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-black">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-black">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary text-black">Service Requests</h1>
          <p className="text-gray-500 text-sm">Manage and track all customer repair requests.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download size={18} /> Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input 
            placeholder="Search by name, email, or appliance..." 
            className="pl-10 text-black" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2 text-black border-gray-200">
            <Filter size={18} /> Status
          </Button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-black">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Appliance Info</th>
                <th className="px-6 py-4 font-semibold">Date Submitted</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRequests.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-secondary text-black">{row.name}</div>
                    <div className="text-xs text-gray-400">{row.email}</div>
                    <div className="text-xs text-gray-400">{row.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-secondary text-black">{row.appliance_type}</div>
                    <div className="text-xs text-gray-400">{row.brand} {row.model}</div>
                  </td>
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
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       <button className="p-2 text-gray-400 hover:text-primary transition-colors">
                          <Eye size={18} />
                       </button>
                       <button className="p-2 text-gray-400 hover:text-secondary transition-colors">
                          <MoreVertical size={18} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRequests.length === 0 && (
            <p className="p-8 text-center text-gray-500 italic">No requests matching your search.</p>
          )}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-black">
           <p className="text-xs text-gray-500 font-medium">Showing {filteredRequests.length} results</p>
           <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled className="text-black border-gray-200">Previous</Button>
              <Button variant="outline" size="sm" disabled className="text-black border-gray-200">Next</Button>
           </div>
        </div>
      </div>
    </div>
  );
}
