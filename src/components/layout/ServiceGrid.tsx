import Link from 'next/link';
import { 
  Refrigerator, 
  WashingMachine, 
  Trash2, 
  Microwave, 
  Flame, 
  Waves,
  ChevronRight,
  Zap
} from 'lucide-react';

const services = [
  {
    name: 'Refrigerator Repair',
    description: 'Fixing leaks, cooling issues, ice makers, and noisy compressors.',
    icon: <Refrigerator className="w-8 h-8" />,
    href: '/services/refrigerator',
  },
  {
    name: 'Washer & Dryer',
    description: 'Repairs for drum issues, drain problems, and heating elements.',
    icon: <WashingMachine className="w-8 h-8" />,
    href: '/services/washer-dryer',
  },
  {
    name: 'Dishwasher Repair',
    description: 'Expert service for cleaning issues, leaks, and control boards.',
    icon: <Waves className="w-8 h-8" />,
    href: '/services/dishwasher',
  },
  {
    name: 'Oven & Range',
    description: 'Gas and electric stove repairs, including igniters and thermostats.',
    icon: <Flame className="w-8 h-8" />,
    href: '/services/oven-range',
  },
  {
    name: 'Ice Maker Repair',
    description: 'Restoring proper ice production and fixing water valves.',
    icon: <Zap className="w-8 h-8" />,
    href: '/services/ice-maker',
  },
  {
    name: 'Microwave & More',
    description: 'Servicing microwaves, disposals, and other kitchen appliances.',
    icon: <Microwave className="w-8 h-8" />,
    href: '/services/other',
  },
];

export const ServiceGrid = () => {
  return (
    <section className="py-24 bg-gray-50" id="services">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-primary font-bold text-sm uppercase tracking-widest mb-3">Our Expertise</h2>
          <p className="text-3xl md:text-4xl font-bold text-secondary mb-6">Repair Services for All Major Appliances</p>
          <p className="text-gray-600 leading-relaxed">
            We service all major brands including Whirlpool, LG, Samsung, GE, KitchenAid, and more. 
            No job is too big or too small for our expert technicians.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <Link 
              key={index} 
              href={service.href}
              className="group bg-white p-8 rounded-2xl border border-gray-100 hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col"
            >
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                {service.icon}
              </div>
              <h3 className="text-xl font-bold text-secondary mb-3">{service.name}</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6 flex-grow">
                {service.description}
              </p>
              <div className="flex items-center text-primary font-bold text-sm uppercase tracking-wider group-hover:translate-x-1 transition-transform duration-300">
                Learn More <ChevronRight size={16} className="ml-2" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
