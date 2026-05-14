import Link from 'next/link';
import { Phone, Mail, Clock, MapPin, Share2 } from 'lucide-react';

const serviceLinks = [
  { name: 'Refrigerator Repair', href: '/services/refrigerator' },
  { name: 'Washer & Dryer Repair', href: '/services/washer-dryer' },
  { name: 'Dishwasher Repair', href: '/services/dishwasher' },
  { name: 'Oven & Range Repair', href: '/services/oven-range' },
  { name: 'Ice Maker Repair', href: '/services/ice-maker' },
  { name: 'Other Appliances', href: '/services/other' },
];

const areaLinks = [
  { name: 'Fredericksburg', href: '/service-areas#fredericksburg' },
  { name: 'Kerrville', href: '/service-areas#kerrville' },
  { name: 'Ingram', href: '/service-areas#ingram' },
  { name: 'Hunt', href: '/service-areas#hunt' },
  { name: 'Comfort', href: '/service-areas#comfort' },
  { name: 'Bandera', href: '/service-areas#bandera' },
];

export const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground pt-16 pb-24 md:pb-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Company Info */}
          <div>
            <Link href="/" className="flex flex-col mb-6">
              <span className="text-xl font-bold text-white leading-tight uppercase tracking-tighter">
                Hill Country
              </span>
              <span className="text-primary font-bold text-sm leading-none">
                Appliance Repair
              </span>
            </Link>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Professional, family-owned appliance repair services serving the Texas Hill Country with honesty and integrity.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-primary transition-colors text-xs font-bold">
                FACEBOOK
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-bold mb-6 border-b border-gray-800 pb-2">Our Services</h3>
            <ul className="space-y-3">
              {serviceLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-gray-400 hover:text-primary text-sm transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Service Areas */}
          <div>
            <h3 className="text-lg font-bold mb-6 border-b border-gray-800 pb-2">Service Areas</h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
              {areaLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-gray-400 hover:text-primary text-sm transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-bold mb-6 border-b border-gray-800 pb-2">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start">
                <Phone className="text-primary mr-3 mt-1 shrink-0" size={18} />
                <div className="text-sm">
                  <p className="font-bold text-white">Main Service:</p>
                  <a href="tel:830-353-0845" className="text-gray-400 hover:text-primary transition-colors">830-353-0845</a>
                </div>
              </li>
              <li className="flex items-start">
                <Phone className="text-primary mr-3 mt-1 shrink-0" size={18} />
                <div className="text-sm">
                  <p className="font-bold text-white">Refrigeration Only:</p>
                  <a href="tel:830-353-3177" className="text-gray-400 hover:text-primary transition-colors">830-353-3177</a>
                </div>
              </li>
              <li className="flex items-start">
                <Clock className="text-primary mr-3 mt-1 shrink-0" size={18} />
                <div className="text-sm">
                  <p className="font-bold text-white">Hours:</p>
                  <p className="text-gray-400">Mon - Fri: 8am - 5pm</p>
                  <p className="text-gray-400">Sat: By Appointment</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-xs mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Hill Country Appliance Repair. All rights reserved.
          </p>
          <div className="flex space-x-6 text-xs text-gray-500">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
 
