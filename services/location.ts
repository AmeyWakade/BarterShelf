import * as Location from 'expo-location';
import type { NeighborhoodLocation } from '@/types';

export async function getCurrentLocation(): Promise<NeighborhoodLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission is needed to find nearby listings. You can enable it in Settings.');
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error('Location Services are turned off. Enable them in Settings and try again.');
  }

  let position = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 1_000 });
  if (!position) {
    try {
      position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      throw new Error(`Could not obtain your current location. Enable Location Services or, in iOS Simulator, choose Features > Location and select a location, then retry.${detail}`);
    }
  }

  let localityName = 'Your neighborhood';
  try {
    const [place] = await Location.reverseGeocodeAsync(position.coords);
    localityName = [place?.district, place?.city, place?.region].filter(Boolean).join(', ') || localityName;
  } catch {
    // Coordinates are enough to publish; reverse geocoding only adds a display name.
  }

  return { latitude: position.coords.latitude, longitude: position.coords.longitude, localityName };
}
