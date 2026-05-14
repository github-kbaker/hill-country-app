'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  ClipboardList, 
  CreditCard, 
  Settings, 
  LogOut,
  Menu,
  X,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isLoginPage = pathname === '/admin/login';

  // Basic "auth" check
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('admin_auth');
    if (!isAuthenticated && !isLoginPage) {
      router.push('/admin/login');
    }
  }, [isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Service Requests', href: '/admin/requests', icon: ClipboardList },
    { name: 'Payments', href: '/admin/payments', icon: CreditCard },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-secondary text-white transform transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-800">
            <Link href="/" className="flex flex-col">
              <span className="text-xl font-bold leading-tight uppercase tracking-tighter">
                Hill Country
              </span>
              <span className="text-primary font-bold text-sm leading-none">
                Admin Portal
              </span>
            </Link>
          </div>

          <nav className="flex-grow p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
                  `}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
          <button 
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-md"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center gap-4 ml-auto">
            <button className="p-2 text-gray-400 hover:text-primary transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs">
              AD
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
