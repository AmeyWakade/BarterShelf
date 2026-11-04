import * as Location from 'expo-location';
import type { NeighborhoodLocation } from '@/types';

export async function getCurrentLocation(): Promise<NeighborhoodLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission is needed to find nearby listings. You can enable it in Settings.');
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const [place] = await Location.reverseGeocodeAsync(position.coords);
  return { latitude: position.coords.latitude, longitude: position.coords.longitude, localityName: [place?.district, place?.city, place?.region].filter(Boolean).join(', ') || 'Your neighborhood' };
}
