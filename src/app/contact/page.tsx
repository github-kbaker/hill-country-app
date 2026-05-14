import { Phone, Mail, Clock, MapPin, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with Hill Country Appliance Repair. Call us at 830-353-0845 or send us a message for expert appliance repair in the Hill Country.",
};

export default function ContactPage() {
  return (
    <div className="bg-white">
      {/* Header */}
      <section className="bg-secondary text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Contact Us</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Have a question or need to schedule a repair? We're here to help. Reach out to us via phone or our contact form.
          </p>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-16">
            {/* Contact Info */}
            <div className="lg:w-1/3">
              <h2 className="text-2xl font-bold text-secondary mb-8">Get In Touch</h2>
              
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-lg text-primary">
                    <Phone size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary text-lg mb-1">Call Main</h3>
                    <a href="tel:830-353-0845" className="text-primary font-bold text-xl hover:underline">830-353-0845</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-secondary/10 p-3 rounded-lg text-secondary">
                    <Phone size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary text-lg mb-1 text-black">Refrigeration Only</h3>
                    <a href="tel:830-353-3177" className="text-secondary font-bold text-xl hover:underline">830-353-3177</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-lg text-primary">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary text-lg mb-1">Our Hours</h3>
                    <p className="text-gray-600">Monday - Friday: 8:00 AM - 5:00 PM</p>
                    <p className="text-gray-600">Saturday: By Appointment Only</p>
                    <p className="text-gray-600">Sunday: Closed</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-lg text-primary">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary text-lg mb-1">Based In</h3>
                    <p className="text-gray-600">Kerrville, Texas</p>
                    <p className="text-gray-600">Serving the entire Hill Country area.</p>
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-12 border-t border-gray-100">
                 <h3 className="font-bold text-secondary mb-4">Follow Us</h3>
                 <div className="flex space-x-4">
                    <a href="#" className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-primary hover:text-white transition-all text-xs font-bold">
                       FB
                    </a>
                 </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:w-2/3 bg-white p-8 md:p-12 rounded-3xl border border-gray-100 shadow-xl">
              <h2 className="text-2xl font-bold text-secondary mb-8">Send Us a Message</h2>
              <form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-secondary">Full Name</label>
                    <Input placeholder="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-secondary">Phone Number</label>
                    <Input placeholder="(830) 000-0000" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-secondary">Email Address</label>
                  <Input type="email" placeholder="john@example.com" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-secondary">Subject</label>
                  <Input placeholder="How can we help?" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-secondary">Message</label>
                  <Textarea placeholder="Tell us more about your inquiry..." className="min-h-[150px]" />
                </div>

                <Button className="w-full h-14 text-lg font-bold">
                   <Send className="mr-2" size={20} /> Send Message
                </Button>
                
                <p className="text-center text-gray-400 text-sm">
                   Need immediate assistance? Please call us directly.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
