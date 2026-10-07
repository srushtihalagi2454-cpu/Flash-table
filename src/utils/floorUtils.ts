import { Restaurant, RestaurantFloor, Table } from '../types';

/**
 * Standard default floors generator
 */
export function getDefaultFloors(count = 2): RestaurantFloor[] {
  const floorNames = [
    'Ground Floor',
    '1st Floor',
    '2nd Floor',
    '3rd Floor',
    '4th Floor',
    '5th Floor',
    '6th Floor',
    '7th Floor',
    '8th Floor',
    '9th Floor',
  ];

  const result: RestaurantFloor[] = [];
  for (let i = 0; i < count; i++) {
    result.push({
      id: `floor-${i}`,
      floorNumber: i,
      name: floorNames[i] || `${i}th Floor`,
      description: i === 0 ? 'Main dining hall & courtyard' : i === 1 ? 'Mezzanine & private lounges' : `Level ${i} dining space`,
      order: i,
    });
  }
  return result;
}

/**
 * Ensures all restaurants have dynamic floors and assigned floorIds for tables.
 * If restaurant has no floors, defaults to 2 dynamic floors (Ground Floor, 1st Floor).
 */
export function ensureRestaurantFloors(restaurant: Restaurant): RestaurantFloor[] {
  if (restaurant.floors && restaurant.floors.length > 0) {
    return [...restaurant.floors].sort((a, b) => a.order - b.order);
  }
  return getDefaultFloors(2);
}

/**
 * Distribute tables to floors if they don't have a floorId yet.
 * Ground floor gets first half, 1st floor gets second half (or based on table index).
 */
export function ensureTablesHaveFloors(tables: Table[], floors: RestaurantFloor[]): Table[] {
  if (!floors || floors.length === 0) return tables;
  
  const floorMap = new Map<string, RestaurantFloor>();
  floors.forEach((f) => floorMap.set(f.id, f));
  const defaultFloor = floors[0];

  return tables.map((t, idx) => {
    // If table already has valid floorId matching an existing floor
    if (t.floorId && floorMap.has(t.floorId)) {
      const f = floorMap.get(t.floorId)!;
      return {
        ...t,
        floorId: f.id,
        floorNumber: f.floorNumber,
        floorName: f.name,
        category: t.category || deriveCategory(t),
      };
    }

    // Assign floor based on table index / total floors
    const floorIndex = Math.floor((idx / Math.max(1, tables.length)) * floors.length);
    const assignedFloor = floors[Math.min(floorIndex, floors.length - 1)] || defaultFloor;

    return {
      ...t,
      floorId: assignedFloor.id,
      floorNumber: assignedFloor.floorNumber,
      floorName: assignedFloor.name,
      category: t.category || deriveCategory(t),
    };
  });
}

function deriveCategory(table: Table): string {
  const sec = (table.section || '').toLowerCase();
  const feats = (table.features || []).map((f) => f.toLowerCase());

  if (feats.some((f) => f.includes('vip') || f.includes('butler'))) return 'VIP';
  if (feats.some((f) => f.includes('romantic') || f.includes('couple')) || table.capacity === 2) return 'Couple';
  if (table.capacity >= 6 || feats.some((f) => f.includes('family') || f.includes('banquet'))) return 'Family';
  if (sec.includes('private') || feats.some((f) => f.includes('private') || f.includes('alcove'))) return 'Private';
  if (sec.includes('bar') || feats.some((f) => f.includes('bar') || f.includes('cocktail'))) return 'Bar';
  if (sec.includes('terrace') || feats.some((f) => f.includes('garden') || f.includes('breeze') || f.includes('canopy'))) return 'Outdoor';
  return 'Standard';
}
