import { CheckCircle, Users, Award, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about Hill Country Appliance Repair, a family-owned business serving Fredericksburg, Kerrville, and the Texas Hill Country since 2021.",
};

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-secondary text-white overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20">
          <img 
            src="https://images.unsplash.com/photo-1556911220-e15024bb29a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
            alt="Kitchen" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">About Hill Country Appliance Repair</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            A family-owned business dedicated to providing top-quality appliance repair services to our neighbors in the Texas Hill Country.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <img 
                src="https://images.unsplash.com/photo-1581092160562-40aa08e78837?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                alt="Our Team" 
                className="rounded-2xl shadow-xl object-cover w-full h-[400px]"
              />
            </div>
            <div className="lg:w-1/2">
              <h2 className="text-primary font-bold text-sm uppercase tracking-widest mb-3">Our Story</h2>
              <h3 className="text-3xl font-bold text-secondary mb-6">Serving the Hill Country with Integrity</h3>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Hill Country Appliance Repair started with a simple mission: to provide honest, reliable, and affordable appliance repair services to the communities of Kerrville, Fredericksburg, and the surrounding areas.
                </p>
                <p>
                  As a family-owned and operated business, we understand how important your household appliances are to your daily routine. When your refrigerator stops cooling or your washer overflows, it's more than just an inconvenience—it's a disruption to your family's life.
                </p>
                <p>
                  That's why we've built our reputation on fast response times, expert diagnostics, and transparent pricing. We treat every customer like a neighbor because, in the Hill Country, that's exactly what you are.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-primary font-bold text-sm uppercase tracking-widest mb-3">Our Core Values</h2>
          <h3 className="text-3xl font-bold text-secondary mb-16">What Drives Our Business</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                icon: <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-6" />,
                title: 'Honesty',
                desc: 'We provide upfront pricing and honest assessments. If an appliance isn\'t worth fixing, we\'ll tell you.'
              },
              {
                icon: <Award className="w-12 h-12 text-primary mx-auto mb-6" />,
                title: 'Quality',
                desc: 'We use genuine replacement parts and back our work with a 90-day warranty on parts and labor.'
              },
              {
                icon: <Users className="w-12 h-12 text-primary mx-auto mb-6" />,
                title: 'Community',
                desc: 'We take pride in being a local business that supports and serves our Hill Country community.'
              }
            ].map((value, idx) => (
              <div key={idx} className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100">
                {value.icon}
                <h4 className="text-xl font-bold text-secondary mb-4">{value.title}</h4>
                <p className="text-gray-500 leading-relaxed">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto bg-primary p-12 rounded-3xl shadow-2xl">
            <h2 className="text-3xl font-bold text-white mb-6">Need a repair?</h2>
            <p className="text-white/80 mb-10 text-lg">
              Our technicians are ready to help. Schedule your service call today and let us get your appliances back in peak condition.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/schedule">
                <Button className="bg-white text-primary hover:bg-gray-100 font-bold h-14 px-8">Schedule Now</Button>
              </Link>
              <a href="tel:830-353-0845">
                <Button variant="outline" className="border-white text-white hover:bg-white/10 font-bold h-14 px-8">Call Us</Button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
