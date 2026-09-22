import { Lead } from '../models/Lead.js';
//import { Notification } from '../models/Notification.js';
import { Property } from '../models/Property.js';
//import type { LeadStatus } from '../config/constants.js';
//import { leadAnalytics, propertyAnalytics } from '../controllers/analyticsController.js';
import { Activity } from '../models/Activity.js';
import { captureLeadFromCriteria } from './ai/leadCapture.js';
import type { ExtractedCriteria } from '../types.js';


export async function
  saveUnavailableRequirement(
    customerId: string,
    customerName: String,
    criteria: ExtractedCriteria
  ){
    await captureLeadFromCriteria({
      customerId:customerId,
      customerName:customerName,
      criteria:criteria,
      source: "WEBSITE",
    });
  }
export async function checkPropertyForLeads(propertyId: string) {
  const property = await Property.findById(propertyId);

  if (!property || property.status !== "AVAILABLE") return;

  const leads = await Lead.find({
    status: { $in: ['NEW', "CONTACTED", "QUALIFIED", "FOLLOW_UP", "NURTURE"] }
  });

  for (const lead of leads) {
    if (
      lead.intent && lead.intent !== property.listingType
    ) continue;

    if (
      lead.propertyType && lead.propertyType !== property.propertyType
    ) continue;

    if (lead.preferredLocations?.length) {
      const locationMatch = lead.preferredLocations.some(
        (location: string) =>
          property.locality?.toLowerCase().includes(location.toLowerCase()) ||
          property.city?.toLowerCase().includes(location.toLowerCase())
      );
      if (!locationMatch) continue;
    }
    if (
      lead.budgetMax && property.price > lead.budgetMax
    ) continue;

    if (
      lead.budgetMin && property.price < lead.budgetMin
    ) continue;

    const alreadyNotified = await Activity.findOne({
      customerId: lead.customerId,
      leadId: lead._id,
      propertyId: property._id,
      type: "PROPERTY_AVAILABLE",
    });

    if (alreadyNotified) continue;

    await Activity.create({
      customerId: lead.customerId,
      leadId: lead._id,
      propertyId: property._id,
      type: "PROPERTY_AVAILABLE",
      description: `Matching property available:${property.title}`,
      metadata: {
        propertyId: property._id,
      },
    });

  }
}