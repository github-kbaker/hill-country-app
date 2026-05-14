import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Phone, Calendar } from 'lucide-react';

export const Hero = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-secondary">
      {/* Background with overlay */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10" />
        {/* Placeholder image background - in a real app would be a high-quality photo */}
        <div 
          className="w-full h-full bg-cover bg-center" 
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1556910103-1c02745aae4d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')" }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-20 pt-20 pb-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 text-sm font-bold mb-6 tracking-wide uppercase">
            Texas Hill Country's Trusted Choice
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1]">
            Expert Appliance <span className="text-primary">Repair</span> Services
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-10 leading-relaxed max-w-2xl">
            Reliable, same-day repairs for all major household appliances. Serving Kerrville, Fredericksburg, and surrounding areas. <span className="text-white font-bold underline decoration-primary underline-offset-4">Free service call with every repair.</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/schedule">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-bold rounded-lg shadow-lg shadow-primary/20">
                <Calendar className="mr-2" size={20} /> Schedule Repair
              </Button>
            </Link>
            <a href="tel:830-353-0845">
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-bold rounded-lg border-2 hover:bg-white/5 text-white border-white/20">
                <Phone className="mr-2" size={20} /> Call Now
              </Button>
            </a>
          </div>

          <div className="mt-12 flex flex-wrap gap-8 items-center text-gray-400">
             <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                <span className="text-sm font-medium">Licensed & Insured</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                <span className="text-sm font-medium">Same-Day Service</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                <span className="text-sm font-medium">90-Day Warranty</span>
             </div>
          </div>
        </div>
      </div>
    </section>
  );
};
