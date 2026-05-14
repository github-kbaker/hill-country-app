'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // For the purpose of this demo, use a simple hardcoded password
    // In production, this would use a real auth provider
    if (password === 'hillcountry2026') {
      localStorage.setItem('admin_auth', 'true');
      router.push('/admin');
    } else {
      setError('Invalid administrator password');
    }
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-8 text-center border-b border-gray-100">
          <div className="inline-flex p-4 bg-primary/10 rounded-full text-primary mb-4">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-2xl font-bold text-secondary uppercase tracking-tight">Admin Portal</h1>
          <p className="text-gray-500 text-sm mt-1">Please enter your credentials to continue</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-secondary">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input 
                type="password" 
                placeholder="••••••••" 
                className="pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full h-12 font-bold text-lg">
            Login to Dashboard
          </Button>

          <p className="text-center text-xs text-gray-400">
            Internal access only. Unauthorized access attempts are logged.
          </p>
        </form>
      </div>
    </div>
  );
}
