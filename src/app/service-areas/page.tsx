import { MapPin, Phone, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Service Areas",
  description: "Hill Country Appliance Repair serves Kerrville, Fredericksburg, Ingram, Hunt, Comfort, Center Point, Bandera, and the surrounding Texas Hill Country.",
};

const areas = [
  {
    name: 'Kerrville',
    description: 'Our primary hub. We serve all neighborhoods in Kerrville.',
    zipCodes: '78028, 78029'
  },
  {
    name: 'Fredericksburg',
    description: 'Full service appliance repair for the Fredericksburg community.',
    zipCodes: '78624'
  },
  {
    name: 'Ingram',
    description: 'Prompt service for residents and businesses in Ingram.',
    zipCodes: '78025'
  },
  {
    name: 'Hunt',
    description: 'We travel to Hunt for all your major appliance needs.',
    zipCodes: '78024'
  },
  {
    name: 'Comfort',
    description: 'Expert repairs available throughout the Comfort area.',
    zipCodes: '78013'
  },
  {
    name: 'Center Point',
    description: 'Serving Center Point with reliable home appliance service.',
    zipCodes: '78010'
  },
  {
    name: 'Bandera',
    description: 'Quality appliance repair for the Cowboy Capital of the World.',
    zipCodes: '78003'
  },
];

export default function ServiceAreasPage() {
  return (
    <div className="bg-white">
      {/* Header */}
      <section className="bg-secondary text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Service Areas</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            We bring expert appliance repair directly to your doorstep across the Texas Hill Country.
          </p>
        </div>
      </section>

      {/* Map & List Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-16">
            {/* List */}
            <div className="lg:w-1/2">
              <h2 className="text-3xl font-bold text-secondary mb-8">Communities We Serve</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {areas.map((area) => (
                  <div key={area.name} className="p-6 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-gray-50 transition-all" id={area.name.toLowerCase().replace(' ', '-')}>
                    <div className="flex items-center gap-3 mb-3">
                      <MapPin className="text-primary" size={20} />
                      <h3 className="text-xl font-bold text-secondary">{area.name}</h3>
                    </div>
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                      {area.description}
                    </p>
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      ZIP: {area.zipCodes}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-12 p-8 bg-primary/5 rounded-2xl border border-primary/10">
                <h4 className="text-lg font-bold text-secondary mb-4 flex items-center gap-2">
                  <CheckCircle className="text-primary" size={20} />
                  Don't see your town?
                </h4>
                <p className="text-gray-600">
                  We generally serve a 30-mile radius around Kerrville. If you're nearby but not listed, give us a call at <a href="tel:830-353-0845" className="text-primary font-bold hover:underline">830-353-0845</a> to see if we can make it to your location.
                </p>
              </div>
            </div>

            {/* Map Section */}
            <div className="lg:w-1/2 h-[600px] bg-gray-100 rounded-2xl overflow-hidden relative border border-gray-200 shadow-lg">
               <iframe 
                 src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d110196.26252902376!2d-99.21447285!3d30.04758745!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8659560f6071855b%3A0xb3e56687000e3f05!2sKerrville%2C%20TX!5e0!3m2!1sen!2sus!4v1715712000000!5m2!1sen!2sus" 
                 width="100%" 
                 height="100%" 
                 style={{ border: 0 }} 
                 allowFullScreen={true} 
                 loading="lazy" 
                 referrerPolicy="no-referrer-when-downgrade"
                 title="Hill Country Service Area"
                 className="grayscale contrast-125 opacity-80"
               ></iframe>
               <div className="absolute top-6 left-6 right-6 pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-md p-6 rounded-xl shadow-xl border border-gray-100 max-w-xs pointer-events-auto">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-primary p-2 rounded-lg text-white">
                        <MapPin size={20} />
                      </div>
                      <h3 className="font-bold text-secondary">Service Area</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      We provide mobile service to homes throughout Kerrville, Fredericksburg, and surrounding communities.
                    </p>
                    <div className="text-xs font-bold text-primary uppercase tracking-widest">
                      30 Mile Radius Around Kerrville
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-secondary mb-8">Ready to Schedule in Your Area?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/schedule">
              <Button size="lg" className="font-bold h-14 px-10">Schedule Online</Button>
            </Link>
            <a href="tel:830-353-0845">
              <Button variant="outline" size="lg" className="font-bold h-14 px-10 border-secondary text-secondary">Call 830-353-0845</Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
