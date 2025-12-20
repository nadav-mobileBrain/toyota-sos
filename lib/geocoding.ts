export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodedAddress {
  address: string;
  coords: Coordinates;
  distance: number; // Distance from reference point in km
  originalIndex: number;
}

export interface AddressSearchResult {
  display_name: string;
  lat: number;
  lng: number;
}

// Garage Location: Rehov Kombe 12, Hadera
export const GARAGE_LOCATION: Coordinates = {
  lat: 32.4618,
  lng: 34.939,
};

/**
 * Calculates the distance between two coordinates in kilometers using the Haversine formula.
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

/**
 * Geocodes an address using OpenStreetMap (Nominatim).
 */
export async function geocodeAddress(
  address: string
): Promise<Coordinates | null> {
  try {
    const query =
      address.toLowerCase().includes('israel') || address.includes('ישראל')
        ? address
        : `${address}, ישראל`;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ToyotaSOS-DriverApp/1.0',
        'Accept-Language': 'he,en',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Searches for addresses using OpenStreetMap (Nominatim).
 * Returns a list of potential matches.
 */
export async function searchAddresses(
  query: string,
  limit: number = 5
): Promise<AddressSearchResult[]> {
  try {
    if (!query || query.length < 3) return [];

    const searchQuery =
      query.toLowerCase().includes('israel') || query.includes('ישראל')
        ? query
        : `${query}, ישראל`;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      searchQuery
    )}&limit=${limit}&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ToyotaSOS-DriverApp/1.0',
        'Accept-Language': 'he,en',
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (Array.isArray(data)) {
      const uniqueResults = new Map<string, AddressSearchResult>();

      data.forEach((item: any) => {
        let formattedName = item.display_name;

        // Custom formatting if address details are available
        if (item.address) {
          const road = (
            item.address.road ||
            item.address.pedestrian ||
            item.address.footway ||
            item.address.street ||
            ''
          ).trim();
          const city = (
            item.address.city ||
            item.address.town ||
            item.address.village ||
            item.address.municipality ||
            item.address.hamlet ||
            ''
          ).trim();
          const houseNumber = (item.address.house_number || '').trim();

          if (road && city) {
            // Format: "Street HouseNumber, City" or "Street, City"
            // Note: Nominatim usually returns house_number as a separate field
            // We want "Street HouseNumber, City" format if house number exists
            if (houseNumber) {
              formattedName = `${road} ${houseNumber}, ${city}`;
            } else {
              formattedName = `${road}, ${city}`;
            }
          } else if (city) {
            // Fallback: if only city is found (e.g. search for city name)
            formattedName = city;
          } else if (road) {
            formattedName = road;
          }
        }

        const normalizedName = formattedName.trim();
        if (!uniqueResults.has(normalizedName)) {
          uniqueResults.set(normalizedName, {
            display_name: normalizedName,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          });
        }
      });

      return Array.from(uniqueResults.values()).sort((a, b) => {
        const aIsHadera =
          a.display_name.includes('חדרה') ||
          a.display_name.toLowerCase().includes('hadera');
        const bIsHadera =
          b.display_name.includes('חדרה') ||
          b.display_name.toLowerCase().includes('hadera');

        if (aIsHadera && !bIsHadera) return -1;
        if (!aIsHadera && bIsHadera) return 1;
        return 0;
      });
    }
    return [];
  } catch (error) {
    console.error('Address search error:', error);
    return [];
  }
}

/**
 * Sorts stops based on their proximity to a reference point.
 * Returns the sorted items with geocoding metadata (lat, lng, distance).
 */
export async function optimizeRoute<T>(
  stops: T[],
  addressExtractor: (item: T) => string,
  referencePoint: Coordinates = GARAGE_LOCATION
): Promise<{ item: T; geocode: GeocodedAddress | null }[]> {
  // 1. Geocode all addresses
  const results = await Promise.all(
    stops.map(async (item, index) => {
      const address = addressExtractor(item);
      if (!address) return { item, geocode: null };

      const coords = await geocodeAddress(address);
      if (coords) {
        return {
          item,
          geocode: {
            address,
            coords,
            distance: calculateDistance(referencePoint, coords),
            originalIndex: index,
          },
        };
      }
      return { item, geocode: null };
    })
  );

  // Separate valid and invalid
  const valid = results.filter(
    (r): r is { item: T; geocode: GeocodedAddress } => r.geocode !== null
  );
  const invalid = results.filter((r) => r.geocode === null);

  // Sort valid by distance
  valid.sort((a, b) => a.geocode.distance - b.geocode.distance);

  return [...valid, ...invalid];
}

/**
 * Helper to format distance for display (e.g., "1.2 km" or "500 m")
 */
export function formatDistance(km: number | null | undefined): string {
  if (km === null || km === undefined) return '';
  if (km < 1) {
    return `${Math.round(km * 1000)} מ׳`;
  }
  return `${km.toFixed(1)} ק״מ`;
}
