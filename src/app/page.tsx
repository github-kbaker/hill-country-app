import { Hero } from '@/components/layout/Hero';
import { TrustBadges } from '@/components/layout/TrustBadges';
import { ServiceGrid } from '@/components/layout/ServiceGrid';
import { Phone, MapPin, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Hill Country Appliance Repair | Fredericksburg & Kerrville TX",
  description: "Expert appliance repair services in Fredericksburg, Kerrville, and surrounding areas. Free service call with repair! 20+ years of experience fixing refrigerators, washers, and more.",
};

export default function Home() {
  return (
    <>
      <Hero />
      <TrustBadges />
      <ServiceGrid />

      {/* About Section Preview */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2 relative">
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full z-0" />
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-secondary/5 rounded-full z-0" />
              <img 
                src="https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                alt="Technician at work" 
                className="relative z-10 rounded-2xl shadow-2xl object-cover w-full h-[500px]"
              />
              <div className="absolute bottom-8 left-8 z-20 bg-white p-6 rounded-xl shadow-xl border border-gray-100 max-w-xs hidden md:block">
                <p className="text-secondary font-bold text-lg mb-1">Local & Family Owned</p>
                <p className="text-gray-500 text-sm">Serving our neighbors in the Hill Country for years.</p>
              </div>
            </div>
            <div className="lg:w-1/2">
              <h2 className="text-primary font-bold text-sm uppercase tracking-widest mb-3">Our Story</h2>
              <h3 className="text-3xl md:text-4xl font-bold text-secondary mb-6">Experienced Repair You Can Count On</h3>
              <p className="text-gray-600 mb-8 leading-relaxed text-lg">
                Hill Country Appliance Repair was founded on the principles of honesty, quality, and community service. We know how disruptive a broken appliance can be to your daily life, which is why we offer prompt, expert service to get your home back in order.
              </p>
              
              <ul className="space-y-4 mb-10">
                {[
                  'Upfront, transparent pricing',
                  'Factory trained technicians',
                  'Same-day service available',
                  'Genuine replacement parts'
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="text-primary shrink-0" size={20} />
                    <span className="font-medium text-secondary">{item}</span>
                  </li>
                ))}
              </ul>

              <Link href="/about">
                <Button variant="outline" className="font-bold">Learn More About Us</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Service Area Section */}
      <section className="py-24 bg-secondary text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-16">
            <div className="lg:w-1/3">
              <h2 className="text-primary font-bold text-sm uppercase tracking-widest mb-3">Service Area</h2>
              <h3 className="text-3xl md:text-4xl font-bold mb-6 text-white">Where We Work</h3>
              <p className="text-gray-400 mb-8 leading-relaxed">
                We provide mobile appliance repair services across the heart of the Texas Hill Country. If you're in our service area, we'll come to you!
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <MapPin className="text-primary shrink-0 mt-1" size={24} />
                  <div>
                    <p className="font-bold text-lg text-white">Serving:</p>
                    <p className="text-gray-400">Fredericksburg, Kerrville, Ingram, Hunt, Comfort, Center Point, and Bandera.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Phone className="text-primary shrink-0 mt-1" size={24} />
                  <div>
                    <p className="font-bold text-lg text-white">Call to Schedule:</p>
                    <a href="tel:830-353-0845" className="text-primary font-bold text-xl hover:underline">830-353-0845</a>
                  </div>
                </div>
              </div>

              <Link href="/service-areas" className="inline-block mt-10">
                <Button className="font-bold">View Full Map</Button>
              </Link>
            </div>
            
            <div className="lg:w-2/3 h-[450px] bg-gray-800 rounded-2xl overflow-hidden relative border border-gray-700 shadow-2xl">
               <iframe 
                 src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d110196.26252902376!2d-99.21447285!3d30.04758745!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8659560f6071855b%3A0xb3e56687000e3f05!2sKerrville%2C%20TX!5e0!3m2!1sen!2sus!4v1715712000000!5m2!1sen!2sus" 
                 width="100%" 
                 height="100%" 
                 style={{ border: 0 }} 
                 allowFullScreen={true} 
                 loading="lazy" 
                 referrerPolicy="no-referrer-when-downgrade"
                 title="Hill Country Service Area Map"
                 className="grayscale contrast-125 opacity-70"
               ></iframe>
               <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-secondary/80 to-transparent flex items-end p-8">
                  <div className="bg-white/90 backdrop-blur-md p-4 rounded-lg shadow-lg border border-gray-100 max-w-xs pointer-events-auto">
                    <p className="text-secondary font-bold text-sm">Mobile Service Hub</p>
                    <p className="text-gray-500 text-xs">Centrally located in Kerrville to serve the entire Hill Country.</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-primary overflow-hidden relative">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-white/10 rounded-full z-0" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">Ready to get your appliance fixed?</h2>
          <p className="text-white/80 text-xl mb-12 max-w-2xl mx-auto font-medium">
             Don't let a broken appliance slow you down. Schedule your repair online or call us today!
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href="/schedule">
              <Button size="lg" className="h-16 px-10 text-xl font-bold bg-white text-primary hover:bg-gray-100 border-none shadow-xl">
                Schedule Repair Online
              </Button>
            </Link>
            <a href="tel:830-353-0845">
              <Button size="lg" variant="outline" className="h-16 px-10 text-xl font-bold border-2 border-white text-white hover:bg-white/10">
                Call 830-353-0845
              </Button>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
