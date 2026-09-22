import type { Request, Response, NextFunction } from 'express';
import { Property } from '../models/Property.js';
import { Conversation } from '../models/Conversation.js';
import { getLlmProvider } from '../services/ai/llm.js';
import { rankProperties } from '../services/ai/nlu.js';
import { captureLeadFromCriteria } from '../services/ai/leadCapture.js';
import { ApiError } from '../middleware/error.js';
import type { ExtractedCriteria, PropertyDoc } from '../types.js';
import { saveUnavailableRequirement } from "../services/PropertyAvalability.js"

/** Contextual follow-up suggestions based on what the criteria are still missing. */
function buildSuggestions(c: ExtractedCriteria): string[] {
  const out: string[] = [];
  if (!c.propertyType) out.push('Show me 3BHK options');
  if (!c.budgetMax && !c.budgetMin) out.push('My budget is under 80 lakh');
  if (c.locations.length === 0 && !c.city) out.push('I am looking in Bangalore');
  if (c.intent !== 'SITE_VISIT') out.push('I want to schedule a site visit');
  return out.slice(0, 3).length > 0 ? out.slice(0, 3) : ['Show similar properties', 'What matches my budget?'];
}

async function fetchCandidateProperties(): Promise<PropertyDoc[]> {
  const docs = await Property.find({ status: { $in: ['AVAILABLE', 'RESERVED'] } })
    .limit(500)
    .lean();
  return docs.map(d => ({ ...d, _id: String(d._id) })) as unknown as PropertyDoc[];
}

/** POST /api/ai/property-search — NL query → criteria + ranked results (spec §8) */
export async function propertySearch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { query } = req.body as { query?: string };
    if (!query || query.trim().length < 3) {
      throw new ApiError(400, 'Please describe what you are looking for', 'VALIDATION_ERROR');
    }
    const provider = getLlmProvider();
    let criteria: ExtractedCriteria;
    try {
      criteria = await provider.extract(query);
    } catch {
      throw new ApiError(503, 'AI temporarily unavailable. You can continue using normal property search.', 'AI_SEARCH_ERROR');
    }
    const candidates = await fetchCandidateProperties();
    const results = rankProperties(criteria, candidates, 12, 40);
    if (results.length === 0) {
      await saveUnavailableRequirement({
        customerId: req.user!._id,
        customerName: req.user!.name,
        criteria,
      });
    }
    res.json({ criteria, results });
  } catch (err) {
    next(err);
  }
}

/** POST /api/ai/recommend-properties — ranked matches for the logged-in customer (spec §11) */
export async function recommendProperties(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { conversationId } = (req.body ?? {}) as { conversationId?: string };
    const conversation = conversationId ? await Conversation.findById(conversationId) : null;
    const extracted = conversation?.extractedRequirements;

    const criteria: ExtractedCriteria = {
      intent: 'BUY',
      propertyType: (extracted?.propertyType as ExtractedCriteria['propertyType']) ?? '',
      locations: extracted?.locations ?? [],
      budgetMin: (extracted?.budgetMin ?? undefined) as number | undefined,
      budgetMax: (extracted?.budgetMax ?? undefined) as number | undefined,
      amenities: extracted?.amenities ?? [],
      confidence: 0.5,
    };
    const candidates = await fetchCandidateProperties();
    const results = rankProperties(criteria, candidates, 6);
    res.json({ results });
  } catch (err) {
    next(err);
  }
}

/** POST /api/ai/chat — conversational assistant with memory + lead capture (spec §12–13, §21) */
export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { message, conversationId } = req.body as { message?: string; conversationId?: string };
    if (!message || message.trim().length === 0) {
      throw new ApiError(400, 'Message is required', 'VALIDATION_ERROR');
    }
    const customerId = req.user!._id;

    let conversation = conversationId ? await Conversation.findOne({ _id: conversationId, customerId }) : null;
    if (!conversation) {
      conversation = await Conversation.create({ customerId, title: message.slice(0, 60) });
    }

    conversation.messages.push({ senderType: 'CUSTOMER', content: message, timestamp: new Date() } as never);

    // memory: merge prior extracted requirements with this turn's extraction
    const provider = getLlmProvider();
    const extracted = await provider.extract(message);
    const mem = conversation.extractedRequirements ?? ({} as NonNullable<typeof conversation.extractedRequirements>);
    const merged: ExtractedCriteria = {
      ...extracted,
      propertyType: extracted.propertyType || (mem.propertyType as ExtractedCriteria['propertyType']) || '',
      locations: extracted.locations.length > 0 ? extracted.locations : mem.locations ?? [],
      budgetMax: (extracted.budgetMax ?? mem.budgetMax ?? undefined) as number | undefined,
      budgetMin: (extracted.budgetMin ?? mem.budgetMin ?? undefined) as number | undefined,
      amenities: [...new Set([...(extracted.amenities ?? []), ...(mem.amenities ?? [])])],
    };

    conversation.extractedRequirements = {
      propertyType: merged.propertyType || undefined,
      locations: merged.locations,
      budgetMin: merged.budgetMin,
      budgetMax: merged.budgetMax,
      amenities: merged.amenities,
    };
    conversation.detectedIntent = merged.intent;

    // retrieve matching properties for context-grounded reply
    const candidates = await fetchCandidateProperties();
    const results = rankProperties(merged, candidates, 4, 40);

    // deterministic, template-based grounded reply — varies with match quality
    const parts: string[] = [];
    const chips: string[] = [];
    if (merged.propertyType) chips.push(merged.propertyType);
    if (merged.locations.length > 0) chips.push(merged.locations.join(', '));
    else if (merged.city) chips.push(merged.city);
    if (merged.budgetMax) chips.push(`≤ ₹${(merged.budgetMax / 100000).toFixed(0)}L`);
    if (merged.budgetMin) chips.push(`≥ ₹${(merged.budgetMin / 100000).toFixed(0)}L`);
    if (merged.amenities.length > 0) chips.push(...merged.amenities.slice(0, 3));
    if (chips.length > 0) {
      parts.push(`Got it — looking for ${chips.join(', ')}.`);
    }

    const topScore = results[0]?.matchScore ?? 0;
    const missing: string[] = [];
    if (!merged.budgetMax && !merged.budgetMin) missing.push('budget');
    if (merged.locations.length === 0 && !merged.city) missing.push('location');

    if (results.length > 0 && topScore >= 70) {
      const top = results[0].property;
      parts.push(`Best match: ${top.title} in ${top.locality} at ${results[0].matchScore}% — here are ${results.length} options ranked for you.`);
    } else if (results.length > 0) {
      parts.push(`Nothing matches all your criteria closely (best is ${topScore}%). The closest options are below — widening the ${missing.includes('budget') ? 'budget' : 'location or budget'} may help.`);
    } else if (chips.length > 0) {
      parts.push('I could not find anything for that combination. Try a nearby locality or a higher budget.');
    } else {
      parts.push('Happy to help! Tell me the city or locality, property type and your budget, and I will find matches.');
    }
    if (merged.locations.length > 0 && results.length > 0) {
      const covered = results.some(r =>
        merged.locations.some(l => r.property.locality.toLowerCase().includes(l.toLowerCase())));
      if (!covered) {
        parts.push(`Heads up: we don't have inventory in ${merged.locations.join(' or ')} right now — these are the best options in ${merged.city ?? 'nearby areas'}.`);
      }
    }
    if (missing.length > 0 && results.length > 0) {
      parts.push(`If you share your ${missing.join(' and ')}, I can sharpen these results.`);
    }
    if (merged.intent === 'SITE_VISIT') {
      parts.push('I can help schedule a site visit — open any property and tap "Request Site Visit".');
    }
    const reply = parts.join(' ');

    conversation.messages.push({ senderType: 'AI', content: reply, timestamp: new Date(), metadata: { chips } } as never);
    await conversation.save();

    // AI lead capture (spec §21): create/update lead once we have meaningful criteria
    let leadId: string | undefined;
    let leadCaptured = false;
    const hasEnough = merged.propertyType || merged.budgetMax || merged.locations.length > 0;
    if (hasEnough) {
      const lead = await captureLeadFromCriteria({
        customerId,
        customerName: req.user!.name,
        conversationId: String(conversation._id),
        criteria: merged,
        source: 'WEBSITE',
      });
      if (lead) {
        leadId = String(lead._id);
        leadCaptured = true;
      }
    }

    res.json({
      reply,
      conversationId: String(conversation._id),
      extracted: merged,
      leadCaptured,
      leadId,
      suggestions: buildSuggestions(merged),
      results: results.map(r => ({
        property: r.property,
        matchScore: r.matchScore,
        reasons: r.reasons,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/ai/conversations */
export async function listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filter = req.user!.role === 'CUSTOMER' ? { customerId: req.user!._id } : {};
    const items = await Conversation.find(filter).sort({ updatedAt: -1 }).limit(50).select('-messages');
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/** GET /api/ai/conversations/:id */
export async function getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) throw new ApiError(404, 'Conversation not found', 'NOT_FOUND');
    if (req.user!.role === 'CUSTOMER' && String(conversation.customerId) !== req.user!._id) {
      throw new ApiError(403, 'Not your conversation', 'FORBIDDEN');
    }
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

/** POST /api/ai/compare-properties — comparison summary (spec §18) */
export async function compareProperties(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { propertyIds } = req.body as { propertyIds?: string[] };
    if (!propertyIds || propertyIds.length < 2) {
      throw new ApiError(400, 'Provide at least two propertyIds', 'VALIDATION_ERROR');
    }
    const properties = await Property.find({ _id: { $in: propertyIds } });
    if (properties.length < 2) throw new ApiError(404, 'Properties not found', 'NOT_FOUND');
    const cheapest = Math.min(...properties.map(p => p.price));
    const summary = `${properties[0].propertyType} options compared: ${properties
      .map(p => `${p.title} at ₹${(p.price / 100000).toFixed(0)}L in ${p.locality}${p.price === cheapest ? ' (best price)' : ''}`)
      .join('; ')}.`;
    res.json({ properties, summary });
  } catch (err) {
    next(err);
  }
}
