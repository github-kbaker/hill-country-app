import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { query, escape } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const applianceType = formData.get('applianceType') as string;
    const brand = formData.get('brand') as string;
    const model = formData.get('model') as string;
    const description = formData.get('description') as string;
    const preferredDate = formData.get('preferredDate') as string;
    const preferredTime = formData.get('preferredTime') as string;
    const image = formData.get('image') as File | null;

    // Persist to database
    try {
      query(`INSERT INTO app_repair_requests (name, email, phone, address, appliance_type, brand, model, description, preferred_date, preferred_time) VALUES (${escape(name)}, ${escape(email)}, ${escape(phone)}, ${escape(address)}, ${escape(applianceType)}, ${escape(brand)}, ${escape(model)}, ${escape(description)}, ${escape(preferredDate)}, ${escape(preferredTime)})`);
    } catch (dbError) {
      console.error('Failed to persist repair request:', dbError);
      // We continue even if DB fails, as email is the primary notification for now
    }

    // Placeholder for email transport
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const attachments = [];
    if (image && image.size > 0) {
      const buffer = Buffer.from(await image.arrayBuffer());
      attachments.push({
        filename: image.name,
        content: buffer,
      });
    }

    // Send notification to admin
    await transporter.sendMail({
      from: `"HCAR Website" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `New Repair Request from ${name}`,
      text: `
        Name: ${name}
        Email: ${email}
        Phone: ${phone}
        Address: ${address}
        Appliance: ${applianceType}
        Brand: ${brand}
        Model: ${model}
        Preferred Date: ${preferredDate}
        Preferred Time: ${preferredTime}
        
        Description:
        ${description}
      `,
      attachments,
    });

    // Send confirmation to customer
    await transporter.sendMail({
      from: `"Hill Country Appliance Repair" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Service Request Received - Hill Country Appliance Repair`,
      text: `Hello ${name},\n\nWe have received your repair request for your ${applianceType}. Our team will contact you shortly to confirm your appointment.\n\nThank you,\nHill Country Appliance Repair`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Contact API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
