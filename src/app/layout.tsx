import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StickyCallBar } from "@/components/layout/StickyCallBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://hillcountryappliancerepair.com'),
  title: {
    default: "Hill Country Appliance Repair | Fredericksburg & Kerrville TX",
    template: "%s | Hill Country Appliance Repair"
  },
  description: "Expert appliance repair services in Fredericksburg, Kerrville, and surrounding areas. Refrigerators, washers, dryers, and more. Free service call with repair!",
  keywords: ["appliance repair", "kerrville", "fredericksburg", "refrigerator repair", "washer repair", "dryer repair", "hill country repair", "appliance service"],
  authors: [{ name: "Hill Country Appliance Repair" }],
  creator: "Hill Country Appliance Repair",
  publisher: "Hill Country Appliance Repair",
  formatDetection: {
    email: false,
    address: true,
    telephone: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://hillcountryappliancerepair.com/",
    siteName: "Hill Country Appliance Repair",
    title: "Hill Country Appliance Repair | Fredericksburg & Kerrville TX",
    description: "Expert appliance repair services in Fredericksburg, Kerrville, and surrounding areas. Free service call with repair!",
    images: [
      {
        url: "/og-image.jpg", // We should probably add this image
        width: 1200,
        height: 630,
        alt: "Hill Country Appliance Repair",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hill Country Appliance Repair | Fredericksburg & Kerrville TX",
    description: "Expert appliance repair services in Fredericksburg, Kerrville, and surrounding areas.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
        <Header />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
        <StickyCallBar />
      </body>
    </html>
  );
}
