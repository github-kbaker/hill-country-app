'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'About', href: '/about' },
  { name: 'Services', href: '/services' },
  { name: 'Service Areas', href: '/service-areas' },
  { name: 'Contact', href: '/contact' },
  { name: 'Pay Invoice', href: '/pay-invoice' },
];

export const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex flex-col">
              <span className="text-xl md:text-2xl font-bold text-secondary leading-tight uppercase tracking-tighter">
                Hill Country
              </span>
              <span className="text-primary font-bold text-sm md:text-base leading-none">
                Appliance Repair
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex space-x-8 items-center">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-gray-600 hover:text-primary font-medium transition-colors"
              >
                {link.name}
              </Link>
            ))}
            <Link href="/schedule">
              <Button className="font-bold">
                Schedule Online
              </Button>
            </Link>
          </nav>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-primary hover:bg-gray-100 focus:outline-none"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 py-4 px-4 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md"
              onClick={() => setIsOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <Link href="/schedule" className="block px-3 py-2" onClick={() => setIsOpen(false)}>
            <Button className="w-full font-bold">
              Schedule Online
            </Button>
          </Link>
          <div className="pt-4 pb-2 border-t border-gray-100 flex flex-col space-y-2 px-3">
             <a href="tel:830-353-0845" className="flex items-center text-primary font-bold">
                <Phone size={18} className="mr-2" /> 830-353-0845
             </a>
             <a href="tel:830-353-3177" className="flex items-center text-secondary font-bold">
                <Phone size={18} className="mr-2" /> 830-353-3177 (Refrig)
             </a>
          </div>
        </div>
      )}
    </header>
  );
};
