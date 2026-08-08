import React from 'react';
import type { Metadata } from 'next';
import LeadDetail from '@/components/admin/lead/LeadDetail';

export const metadata: Metadata = {
  title: 'Lead Detail — Hill Country Appliance Repair Admin',
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Invalid lead id</p>
      </div>
    );
  }
  return <LeadDetail leadId={id} />;
}
