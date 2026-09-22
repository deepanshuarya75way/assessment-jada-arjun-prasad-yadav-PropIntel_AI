import mongoose, { Schema } from 'mongoose';
import { FURNISHING } from '../config/constants.js';

const LeadSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedAgent: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true },
    phone: String,
    source: {
      type: String,
      enum: ['WEBSITE', 'GOOGLE_ADS', 'META_ADS', 'INSTAGRAM', 'WHATSAPP', 'PHONE', 'REFERRAL', 'PROPERTY_PORTAL', 'OTHER'],
      default: 'WEBSITE',
    },
    intent: {
      type: String,
      enum: ['BUY', 'RENT', 'SELL', 'INVEST', 'INFORMATION', 'PRICE_QUERY', 'SITE_VISIT', 'FINANCING', 'PROPERTY_COMPARISON', 'FOLLOW_UP'],
      default: 'BUY',
    },
    propertyType: { type: String, enum: ['1BHK', '2BHK', '3BHK', '4BHK', 'PLOT', 'VILLA', 'OFFICE', ''] },
    preferredCity:String,
    preferredLocations: { type: [String], default: [] },
    budgetMin: Number,
    budgetMax: Number,
    timeline: String,
    //parking:{
    //  type:Boolean,
    //  default:false,
    //}
    //furnishing: {
    //  type:string,
    //  enum:['UNFURNISHED','SEMI_FURNISHED','FULLY_FURNISHED',""],
    //  default:"",
    //}
    requirements: { type: [String], default: [] },
    leadScore: { type: Number, default: 0, index: true },
    leadTemperature: { type: String, enum: ['HOT', 'WARM', 'NURTURE', 'COLD'], default: 'COLD', index: true },
    status: {
      type: String,
      enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'SITE_VISIT', 'NEGOTIATION', 'CONVERTED', 'LOST', 'NURTURE'],
      default: 'NEW',
      index: true,
    },
    engagementCount: { type: Number, default: 0 },
    lastContactedAt: Date,
    nextFollowUpAt: Date,
    sentiment: { type: String, enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'], default: 'NEUTRAL' },
    interestedProperties: [{ type: Schema.Types.ObjectId, ref: 'Property' }],
  },
  { timestamps: true, collection: 'leads' },
);

export const Lead = mongoose.model('Lead', LeadSchema);
