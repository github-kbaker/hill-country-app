import { z } from 'zod';

export const repairRequestSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  email: z.string().email('Please enter a valid email address'),
  address: z.string().min(5, 'Please enter your full service address'),
  applianceType: z.string().min(1, 'Please select an appliance type'),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().min(10, 'Please provide a brief description of the problem'),
  preferredDate: z.string().min(1, 'Please select a preferred date'),
  preferredTime: z.enum(['Morning', 'Afternoon', 'Evening']),
  image: z.any().optional(),
});

export type RepairRequestValues = z.infer<typeof repairRequestSchema>;
