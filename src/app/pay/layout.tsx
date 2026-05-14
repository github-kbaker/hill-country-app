import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Pay Your Invoice",
  description: "Securely pay your Hill Country Appliance Repair invoice online using Stripe. Quick, easy, and secure payment processing.",
};

export default function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
