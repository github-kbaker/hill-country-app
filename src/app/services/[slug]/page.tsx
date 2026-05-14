import { notFound } from 'next/navigation';
import { 
  Refrigerator, 
  WashingMachine, 
  Waves, 
  Flame, 
  Zap, 
  Microwave,
  CheckCircle,
  Phone,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Metadata } from 'next';

const services = {
  'refrigerator': {
    name: 'Refrigerator Repair',
    icon: <Refrigerator size={48} />,
    description: 'Expert diagnostics and repair for all types of refrigeration units, including French door, side-by-side, and bottom freezer models.',
    issues: ['Not cooling', 'Ice maker not working', 'Leaking water', 'Excessive noise', 'Constant running'],
    brands: ['Sub-Zero', 'LG', 'Samsung', 'Whirlpool', 'GE Profile', 'KitchenAid']
  },
  'washer-dryer': {
    name: 'Washer & Dryer Repair',
    icon: <WashingMachine size={48} />,
    description: 'Comprehensive service for top-load and front-load washers, as well as gas and electric dryers.',
    issues: ['Not draining', 'Not spinning', 'No heat in dryer', 'Leaking', 'Violent shaking'],
    brands: ['Maytag', 'Whirlpool', 'Kenmore', 'Samsung', 'LG', 'Speed Queen']
  },
  'dishwasher': {
    name: 'Dishwasher Repair',
    icon: <Waves size={48} />,
    description: 'Fast repair for dishwashers that aren\'t cleaning properly or have mechanical failures.',
    issues: ['Dishes coming out dirty', 'Not draining', 'Leaking from door', 'Not starting', 'Strange noises'],
    brands: ['Bosch', 'KitchenAid', 'Whirlpool', 'Miele', 'GE', 'Frigidaire']
  },
  'oven-range': {
    name: 'Oven & Range Repair',
    icon: <Flame size={48} />,
    description: 'Specialized service for gas and electric ranges, ovens, and cooktops.',
    issues: ['Oven not heating', 'Burners won\'t ignite', 'Temperature inaccurate', 'Self-clean failure', 'Glass cooktop cracks'],
    brands: ['Wolf', 'Viking', 'GE Monogram', 'Thermador', 'Whirlpool', 'Jenn-Air']
  },
  'ice-maker': {
    name: 'Ice Maker Repair',
    icon: <Zap size={48} />,
    description: 'Fixing dedicated ice machines and built-in refrigerator ice makers.',
    issues: ['No ice production', 'Thin ice', 'Leaking', 'Funny tasting ice', 'Jamming'],
    brands: ['Scotsman', 'Hoshizaki', 'Manitowoc', 'U-Line', 'Whirlpool', 'KitchenAid']
  },
  'other': {
    name: 'Other Appliance Repair',
    icon: <Microwave size={48} />,
    description: 'We also service microwaves, garbage disposals, trash compactors, and more.',
    issues: ['Microwave not heating', 'Disposal jammed', 'Compactor won\'t cycle', 'Exhaust fan issues'],
    brands: ['All Major Brands']
  }
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const service = services[params.slug as keyof typeof services];
  if (!service) return { title: 'Service Not Found' };

  return {
    title: service.name,
    description: service.description,
  };
}

export default function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const service = services[params.slug as keyof typeof services];

  if (!service) {
    notFound();
  }

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-secondary text-white py-20">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center gap-8">
          <div className="bg-primary/20 p-6 rounded-2xl text-primary">
            {service.icon}
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-4">{service.name}</h1>
            <p className="text-xl text-gray-300 max-w-2xl">{service.description}</p>
          </div>
        </div>
      </section>

      {/* Details */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-2xl font-bold text-secondary mb-8">Common Issues We Fix</h2>
              <ul className="space-y-4 mb-12">
                {service.issues.map((issue) => (
                  <li key={issue} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-gray-700 font-medium">{issue}</span>
                  </li>
                ))}
              </ul>

              <h2 className="text-2xl font-bold text-secondary mb-8">Brands We Service</h2>
              <div className="flex flex-wrap gap-3">
                {service.brands.map((brand) => (
                  <span key={brand} className="px-4 py-2 bg-gray-100 rounded-full text-secondary font-bold text-sm">
                    {brand}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-10 rounded-3xl border border-gray-100 shadow-sm">
               <h3 className="text-2xl font-bold text-secondary mb-6">Schedule Your {service.name}</h3>
               <p className="text-gray-600 mb-8 leading-relaxed">
                 Don't let a broken {service.name.toLowerCase()} disrupt your day. Our expert technicians are ready to provide fast, reliable service with a satisfaction guarantee.
               </p>
               <div className="space-y-4 mb-10">
                  <div className="flex items-center gap-3 text-secondary font-bold">
                    <CheckCircle className="text-primary" size={20} />
                    <span>Free service call with repair</span>
                  </div>
                  <div className="flex items-center gap-3 text-secondary font-bold">
                    <CheckCircle className="text-primary" size={20} />
                    <span>Prompt, same-day response</span>
                  </div>
                  <div className="flex items-center gap-3 text-secondary font-bold">
                    <CheckCircle className="text-primary" size={20} />
                    <span>90-day parts & labor warranty</span>
                  </div>
               </div>
               <div className="flex flex-col gap-4">
                  <Link href="/schedule">
                    <Button className="w-full h-14 text-lg font-bold">
                      <Calendar className="mr-2" size={20} /> Schedule Now
                    </Button>
                  </Link>
                  <a href="tel:830-353-0845">
                    <Button variant="outline" className="w-full h-14 text-lg font-bold border-secondary text-secondary">
                      <Phone className="mr-2" size={20} /> Call 830-353-0845
                    </Button>
                  </a>
               </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
