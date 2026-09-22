import type { Request, Response, NextFunction } from 'express';
import { Property } from '../models/Property.js';
import { ApiError } from '../middleware/error.js';
import { checkPropertyForLeads } from '../services/PropertyAvalability.js'

// Filters per spec §52: location, price, bedrooms, type, area, amenities, parking, furnishing, status
export async function listProperties(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = {};

    // Public listing shows published properties; admins see all.
    if (req.user?.role !== 'ADMIN') {
      filter.status = { $in: ['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED'] };
    }
    if (q.city) filter.city = q.city;
    if (q.locality) filter.locality = { $regex: q.locality, $options: 'i' };
    if (q.propertyType) filter.propertyType = q.propertyType;
    if (q.listingType) filter.listingType = q.listingType;
    if (q.bedrooms) filter.bedrooms = { $gte: Number(q.bedrooms) };
    if (q.bathrooms) filter.bathrooms = { $gte: Number(q.bathrooms) };
    if (q.minPrice || q.maxPrice) {
      filter.price = {
        ...(q.minPrice ? { $gte: Number(q.minPrice) } : {}),
        ...(q.maxPrice ? { $lte: Number(q.maxPrice) } : {}),
      };
    }
    if (q.minArea) filter.carpetArea = { $gte: Number(q.minArea) };
    if (q.parking === 'true') filter.parking = true;
    if (q.furnishing) filter.furnishing = q.furnishing;
    if (q.status && req.user?.role === 'ADMIN') filter.status = q.status;
    if (q.amenities) {
      const wanted = String(q.amenities).split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
      if (wanted.length > 0) {
        filter['amenities'] = { $in: wanted.map(w => new RegExp(w, 'i')) };
      }
    }
    if (q.search) {
      filter.$or = [
        { title: { $regex: q.search, $options: 'i' } },
        { locality: { $regex: q.search, $options: 'i' } },
        { city: { $regex: q.search, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(q.limit ?? 12)));
    const [items, total] = await Promise.all([
      Property.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('assignedAgent', 'name'),
      Property.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function getProperty(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const property = await Property.findById(req.params.id).populate('assignedAgent', 'name email phone');
    if (!property) throw new ApiError(404, 'Property not found', 'NOT_FOUND');
    res.json({ property });
  } catch (err) {
    next(err);
  }
}

export async function createProperty(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const requiredFields = ['title', 'propertyType', 'price', 'city', 'locality'] as const;
    for (const field of requiredFields) {
      if (!body[field]) {
        throw new ApiError(400, `Missing required field: ${field}`, 'VALIDATION_ERROR');
      }
    }
    const property = await Property.create({
      ...body,
      assignedAgent: body.assignedAgent ?? undefined,
    });
    if (property.status === "AVAILABLE") {
    await checkPropertyForLeads(
      property._id.toString()
    );
  }
    res.status(201).json({ property });
  } catch (err) {
    next(err);
  }
}

export async function updateProperty(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const allowed = [
      'title', 'description', 'propertyType', 'listingType', 'price', 'city', 'locality', 'location',
      'bedrooms', 'bathrooms', 'carpetArea', 'builtUpArea', 'parking', 'furnishing', 'amenities',
      'images', 'developer', 'possessionDate', 'status', 'assignedAgent',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in (req.body as Record<string, unknown>)) updates[key] = (req.body as Record<string, unknown>)[key];
    }
    const property = await Property.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!property) throw new ApiError(404, 'Property not found', 'NOT_FOUND');
    if (property?.status === "AVAILABLE") {
    await checkPropertyForLeads(
      property._id.toString()
    );
  }
    res.json({ property });
  } catch (err) {
    next(err);
  }
}

export async function deleteProperty(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const property = await Property.findByIdAndDelete(req.params.id);
    if (!property) throw new ApiError(404, 'Property not found', 'NOT_FOUND');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
