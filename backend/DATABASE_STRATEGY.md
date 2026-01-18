# Database Strategy: Raw SQL vs Prisma ORM

## Overview
This document explains why we use raw SQL (`$queryRaw`) instead of standard Prisma ORM methods in the DriversService.

## Current Approach: Raw SQL with Prisma

### Why We Use `$queryRaw`

1. **PostGIS Geography Support**
   ```sql
   ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
   ```
   - Creates geographic points using PostGIS functions
   - Prisma's standard ORM doesn't handle PostGIS geography types well
   - Essential for location-based calculations

2. **Complex Spatial Operations**
   ```sql
   ST_Distance(d.location, ST_SetSRID(ST_MakePoint(${pickupLng}, ${pickupLat}), 4326)::geography)
   ST_DWithin(d.location, pickup_point, max_distance)
   ```
   - Distance calculations between points
   - Finding drivers within radius
   - Ordering by distance

3. **Performance Benefits**
   - Direct SQL execution without ORM overhead
   - Optimized for spatial queries
   - Faster for complex geographic operations

4. **Database-Specific Features**
   - Leverages PostgreSQL/PostGIS capabilities
   - Uses `RETURNING` clause for efficient inserts
   - Custom geography type casting

## Examples in Our Codebase

### Driver Creation with Location
```typescript
const driver = await this.prisma.$queryRaw<DriverModel[]>`
  INSERT INTO "Driver" ("userId", status, location, "createdAt", "updatedAt")
  VALUES (
    ${input.userId},
    'OFFLINE',
    ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
    NOW(),
    NOW()
  )
  RETURNING id, "userId", status, "createdAt", "updatedAt"
`;
```

### Finding Nearest Drivers
```typescript
const drivers = await this.prisma.$queryRaw<NearestDriverModel[]>`
  SELECT 
    d.id,
    d."userId",
    d.status,
    ST_Distance(d.location, ST_SetSRID(ST_MakePoint(${pickupLng}, ${pickupLat}), 4326)::geography) as "distanceMeters"
  FROM "Driver" d
  WHERE d.status = 'AVAILABLE'
    AND ST_DWithin(
      d.location,
      ST_SetSRID(ST_MakePoint(${pickupLng}, ${pickupLat}), 4326)::geography,
      ${maxDistanceMeters}
    )
  ORDER BY "distanceMeters" ASC
  LIMIT ${limit}
`;
```

## When to Use Standard Prisma

Use standard Prisma methods for:
- Simple CRUD operations (non-geographic)
- Basic queries without spatial operations
- When you need full ORM benefits:
  - Automatic relations
  - Built-in validation
  - Full type safety
  - Migration support

```typescript
// Example where standard Prisma would be better:
const driver = await this.prisma.driver.findUnique({
  where: { id: driverId },
  include: { user: true } // Relations
});
```

## Trade-offs

### Raw SQL Advantages
✅ PostGIS geography support  
✅ Better performance for spatial queries  
✅ Full control over SQL  
✅ Database-specific features  

### Raw SQL Disadvantages
❌ More SQL knowledge required  
❌ Less type safety  
❌ No automatic relation handling  
❌ Manual error handling  

## Recommendation

**For this delivery service application, continue using `$queryRaw` for:**
- All geographic operations
- Driver location updates
- Nearest driver searches
- Any spatial calculations

**Use standard Prisma for:**
- Simple driver lookups by ID
- Non-geographic operations
- Basic CRUD without spatial data

This hybrid approach gives us the best of both worlds: PostGIS power where needed, ORM simplicity where appropriate.
