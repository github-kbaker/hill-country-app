import { CheckCircle2, ShieldCheck, Clock, Award } from 'lucide-react';

const badges = [
  {
    icon: <CheckCircle2 className="w-10 h-10 text-primary" />,
    title: 'Satisfaction Guaranteed',
    description: 'We stand by our work with a 100% satisfaction guarantee.',
  },
  {
    icon: <ShieldCheck className="w-10 h-10 text-primary" />,
    title: 'Free Service Call',
    description: 'We waive the $105 service call fee when you choose us for repair.',
  },
  {
    icon: <Clock className="w-10 h-10 text-primary" />,
    title: 'Prompt & Reliable',
    description: 'Fast response times and clear communication for every appointment.',
  },
  {
    icon: <Award className="w-10 h-10 text-primary" />,
    title: 'Experienced Pros',
    description: 'Highly trained technicians specialized in all major appliance brands.',
  },
];

export const TrustBadges = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {badges.map((badge, index) => (
            <div key={index} className="flex flex-col items-center text-center p-6 rounded-2xl border border-gray-50 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
              <div className="mb-6 p-4 bg-primary/5 rounded-full ring-8 ring-primary/5">
                {badge.icon}
              </div>
              <h3 className="text-lg font-bold text-secondary mb-3">{badge.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {badge.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
