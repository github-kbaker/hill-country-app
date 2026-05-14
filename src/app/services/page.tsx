import { ServiceGrid } from '@/components/layout/ServiceGrid';
import { TrustBadges } from '@/components/layout/TrustBadges';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Our Services",
  description: "Comprehensive appliance repair services in the Hill Country. We fix refrigerators, washers, dryers, dishwashers, ovens, and more.",
};

export default function ServicesPage() {
  return (
    <div className="bg-white">
      {/* Header */}
      <section className="bg-secondary text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Our Services</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Professional repair for all major household appliances. Fast, reliable, and guaranteed.
          </p>
        </div>
      </section>

      <ServiceGrid />
      <TrustBadges />

      {/* Brand Section */}
      <section className="py-24 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-secondary mb-12">Brands We Service</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center grayscale opacity-50">
             {/* Text labels as placeholders for actual logos */}
             <div className="font-black text-2xl tracking-tighter">WHIRLPOOL</div>
             <div className="font-black text-2xl tracking-tighter text-blue-800">LG</div>
             <div className="font-black text-2xl tracking-tighter text-blue-600">SAMSUNG</div>
             <div className="font-black text-2xl tracking-tighter">GE</div>
             <div className="font-black text-2xl tracking-tighter text-red-700">KITCHENAID</div>
             <div className="font-black text-2xl tracking-tighter">MAYTAG</div>
             <div className="font-black text-2xl tracking-tighter">KENMORE</div>
             <div className="font-black text-2xl tracking-tighter">FRIGIDAIRE</div>
             <div className="font-black text-2xl tracking-tighter">BOSCH</div>
             <div className="font-black text-2xl tracking-tighter text-blue-900">SUB-ZERO</div>
             <div className="font-black text-2xl tracking-tighter">VIKING</div>
             <div className="font-black text-2xl tracking-tighter">AMANA</div>
          </div>
          <p className="mt-16 text-gray-500 max-w-2xl mx-auto">
            Don't see your brand? Don't worry. Our technicians are trained to work on virtually all makes and models of major home appliances.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-primary text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Need immediate service?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/schedule">
              <Button className="bg-white text-primary hover:bg-gray-100 font-bold h-14 px-10">Schedule Online</Button>
            </Link>
            <a href="tel:830-353-0845" className="flex items-center justify-center gap-2 bg-secondary text-white px-10 py-4 rounded-md font-bold h-14 hover:bg-black transition-all">
               <Phone size={20} /> 830-353-0845
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
