'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { repairRequestSchema, type RepairRequestValues } from '@/lib/validations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, Loader2, Camera } from 'lucide-react';

export const RepairRequestForm = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RepairRequestValues>({
    resolver: zodResolver(repairRequestSchema),
    defaultValues: {
      preferredTime: 'Morning',
    }
  });

  const onSubmit = async (data: RepairRequestValues) => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'image' && value?.[0]) {
          formData.append(key, value[0]);
        } else if (value !== undefined) {
          formData.append(key, value as string);
        }
      });

      const response = await fetch('/api/contact', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      setStatus('success');
      reset();
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-brand-lightGreen p-8 rounded-xl text-center border border-brand-green/20">
        <div className="flex justify-center mb-4 text-brand-green">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="text-2xl font-bold text-brand-black mb-2">Request Received!</h2>
        <p className="text-gray-600 mb-6">
          Thank you for reaching out. We have received your repair request and will contact you shortly to confirm your appointment.
        </p>
        <Button onClick={() => setStatus('idle')} variant="primary">
          Submit Another Request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Full Name</label>
          <Input {...register('name')} placeholder="John Doe" />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Phone Number</label>
          <Input {...register('phone')} placeholder="(830) 353-0845" />
          {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Email Address</label>
          <Input {...register('email')} type="email" placeholder="john@example.com" />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Service Address</label>
          <Input {...register('address')} placeholder="123 Hill Country Ln, Fredericksburg, TX" />
          {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
        </div>

        {/* Appliance Info */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Appliance Type</label>
          <Select {...register('applianceType')}>
            <option value="">Select an appliance</option>
            <option value="Refrigerator">Refrigerator</option>
            <option value="Washer">Washer</option>
            <option value="Dryer">Dryer</option>
            <option value="Dishwasher">Dishwasher</option>
            <option value="Oven/Range">Oven/Range</option>
            <option value="Ice Maker">Ice Maker</option>
            <option value="Other">Other</option>
          </Select>
          {errors.applianceType && <p className="text-xs text-red-500">{errors.applianceType.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Brand / Model (Optional)</label>
          <Input {...register('brand')} placeholder="e.g. Samsung / RF28R7351SR" />
        </div>

        {/* Appointment Details */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Preferred Date</label>
          <Input {...register('preferredDate')} type="date" min={new Date().toISOString().split('T')[0]} />
          {errors.preferredDate && <p className="text-xs text-red-500">{errors.preferredDate.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Preferred Time Window</label>
          <Select {...register('preferredTime')}>
            <option value="Morning">Morning (8 AM - 12 PM)</option>
            <option value="Afternoon">Afternoon (12 PM - 4 PM)</option>
            <option value="Evening">Evening (4 PM - 7 PM)</option>
          </Select>
          {errors.preferredTime && <p className="text-xs text-red-500">{errors.preferredTime.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Problem Description</label>
        <Textarea 
          {...register('description')} 
          placeholder="Please describe the issue you're experiencing with your appliance..."
          className="min-h-[120px]"
        />
        {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Photo of Issue or Model Tag (Optional)</label>
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Camera className="w-8 h-8 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-gray-400">PNG, JPG or JPEG (MAX. 5MB)</p>
            </div>
            <input type="file" className="hidden" accept="image/*" {...register('image')} />
          </label>
        </div>
      </div>

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full font-bold py-6 text-lg" disabled={status === 'loading'}>
        {status === 'loading' ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Submitting...
          </>
        ) : (
          'Schedule Repair Service'
        )}
      </Button>

      <p className="text-center text-xs text-gray-500">
        By submitting this form, you agree to be contacted by Hill Country Appliance Repair regarding your service request.
      </p>
    </form>
  );
};
