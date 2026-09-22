export const APP_NAME = 'PropIntel AI';

export const ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const PROPERTY_STATUSES = [
  'DRAFT',
  'AVAILABLE',
  'RESERVED',
  'SOLD',
  'RENTED',
  'UNAVAILABLE',
  'ARCHIVED',
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_TYPES = [
  '1BHK',
  '2BHK',
  '3BHK',
  '4BHK',
  'PLOT',
  'VILLA',
  'OFFICE',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const LISTING_TYPES = ['BUY', 'RENT'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const FURNISHING = ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'] as const;
export type Furnishing = (typeof FURNISHING)[number];

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'FOLLOW_UP',
  'SITE_VISIT',
  'NEGOTIATION',
  'CONVERTED',
  'LOST',
  'NURTURE',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const INTENTS = [
  'BUY',
  'RENT',
  'SELL',
  'INVEST',
  'INFORMATION',
  'PRICE_QUERY',
  'SITE_VISIT',
  'FINANCING',
  'PROPERTY_COMPARISON',
  'FOLLOW_UP',
] as const;
export type Intent = (typeof INTENTS)[number];

export const LEAD_SOURCES = [
  'WEBSITE',
  'GOOGLE_ADS',
  'META_ADS',
  'INSTAGRAM',
  'WHATSAPP',
  'PHONE',
  'REFERRAL',
  'PROPERTY_PORTAL',
  'OTHER',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_TEMPERATURES = ['HOT', 'WARM', 'NURTURE', 'COLD'] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const SITE_VISIT_STATUSES = [
  'REQUESTED',
  'CONFIRMED',
  'RESCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type SiteVisitStatus = (typeof SITE_VISIT_STATUSES)[number];

export const NEXT_ACTIONS = [
  'CALL_CUSTOMER',
  'SEND_PROPERTY_OPTIONS',
  'SCHEDULE_SITE_VISIT',
  'FOLLOW_UP',
  'REQUEST_BUDGET',
  'REQUEST_LOCATION',
  'MOVE_TO_NURTURE',
] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number];

export const ACTIVITY_TYPES = [
  'LEAD_CREATED',
  'LEAD_STATUS_CHANGED',
  'LEAD_SCORED',
  'LEAD_ASSIGNED',
  'PROPERTY_VIEWED',
  'PROPERTY_SAVED',
  'PROPERTY_AVAILABLE',
  'INQUIRY_CREATED',
  'SITE_VISIT_REQUESTED',
  'SITE_VISIT_UPDATED',
  'CONVERSATION_STARTED',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Weighted match-score rubric (spec §11.1) */
export const MATCH_WEIGHTS = {
  budget: 25,
  location: 25,
  propertyType: 20,
  amenities: 15,
  size: 15,
} as const;

/** Lead scoring rubric (spec §23) */
export const LEAD_SCORE_WEIGHTS = {
  budgetConfirmed: 20,
  locationConfirmed: 15,
  propertyTypeConfirmed: 15,
  timelineConfirmed: 20,
  siteVisitRequested: 20,
  engagement: 10,
} as const;

/** Temperature classification bands (spec §23) */
export const LEAD_TEMPERATURE_BANDS = {
  HOT: [80, 100],
  WARM: [60, 79],
  NURTURE: [40, 59],
  COLD: [0, 39],
} as const;
