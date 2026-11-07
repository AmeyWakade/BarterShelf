import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ARPassportRadar } from '@/components/ARPassportRadar';
import { colors } from '@/components/ui';
import { fetchNearbyListings, getSession, updateNeighborhood } from '@/services/api';
import { getCurrentLocation } from '@/services/location';
import type { Listing, NeighborhoodLocation, TransactionType } from '@/types';

function stringParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default function RadarRoute() {
  const params = useLocalSearchParams<{ radius?: string; lat?: string; lng?: string; locality?: string; transactionType?: string; q?: string }>();
  const userRadius = getSession()?.user.radiusPreference ?? 3;
  const requestedRadius = Number(stringParam(params.radius));
  const radiusKm = Number.isFinite(requestedRadius) ? Math.max(1, Math.min(10, requestedRadius)) : userRadius;
  const [location, setLocation] = useState<NeighborhoodLocation>();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const lat = Number(stringParam(params.lat));
        const lng = Number(stringParam(params.lng));
        const saved = getSession()?.user.location;
        const currentLocation = Number.isFinite(lat) && Number.isFinite(lng)
          ? { latitude: lat, longitude: lng, localityName: stringParam(params.locality) ?? saved?.localityName ?? 'Your neighborhood' }
          : saved ?? await getCurrentLocation();
        if (!saved && alive) await updateNeighborhood(currentLocation).catch(() => {});
        if (!alive) return;
        setLocation(currentLocation);
        const rawType = stringParam(params.transactionType);
        const transactionType = ['buy', 'sell', 'swap', 'rent'].includes(rawType ?? '') ? rawType as TransactionType : undefined;
        const nearby = await fetchNearbyListings(currentLocation, radiusKm, { transactionType, q: stringParam(params.q) || undefined });
        if (alive) setItems(nearby);
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Could not load nearby listings.'); }
      finally { if (alive) setLoading(false); }
    }
    void load();
    return () => { alive = false; };
  }, [params.lat, params.lng, params.locality, params.q, params.transactionType, radiusKm]);

  if (!location) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.cream }}>
    {loading ? <><ActivityIndicator color={colors.green} /><Text style={{ color: colors.muted, marginTop: 12 }}>Finding your neighborhood…</Text></> : <><Text style={{ color: colors.alertText, textAlign: 'center' }}>{error || 'Location is required to open the radar.'}</Text><Text onPress={() => router.back()} style={{ color: colors.green, fontWeight: '800', marginTop: 16 }}>Go back</Text></>}
  </View>;

  return <ARPassportRadar items={items} location={location} radiusKm={radiusKm} onClose={() => router.back()} onOpenListing={listing => router.push(`/listing/${listing.id}`)} />;
}
