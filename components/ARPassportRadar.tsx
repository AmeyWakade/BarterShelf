import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Magnetometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Button, colors } from '@/components/ui';
import type { Listing, NeighborhoodLocation } from '@/types';

const RADAR_FOV_DEGREES = 110;
const MAGNETIC_MIN_MICROTESLAS = 10;
const MAGNETIC_MAX_MICROTESLAS = 100;

type PositionedListing = { listing: Listing; distanceKm: number; bearing: number; delta: number; left: number; top: number };

export function haversineKm(from: NeighborhoodLocation, to: NeighborhoodLocation): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing from the user's coordinates to the listing, in [0, 360). */
export function bearingDegrees(from: NeighborhoodLocation, to: NeighborhoodLocation): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function signedAngleDifference(target: number, heading: number): number {
  return ((target - heading + 540) % 360) - 180;
}

function magneticHeading(x: number, y: number, z: number): number | null {
  const strength = Math.sqrt(x * x + y * y + z * z);
  // Expo exposes magnetometer vectors, not the platform's calibration accuracy.
  // Reject physically implausible/near-zero readings and switch to drag mode.
  if (!Number.isFinite(strength) || strength < MAGNETIC_MIN_MICROTESLAS || strength > MAGNETIC_MAX_MICROTESLAS) return null;
  const degrees = Math.atan2(y, x) * 180 / Math.PI;
  return (degrees + 360) % 360;
}

export function ARPassportRadar({ items, location, radiusKm, onClose, onOpenListing }: {
  items: Listing[];
  location: NeighborhoodLocation;
  radiusKm: number;
  onClose: () => void;
  onOpenListing: (listing: Listing) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState(false);
  const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [panHeading, setPanHeading] = useState(0);
  const [selected, setSelected] = useState<Listing | null>(null);
  const permissionAlertShown = useRef(false);
  const panHeadingRef = useRef(0);
  const panStartHeading = useRef(0);
  const rawMagHeading = useRef<number | null>(null);
  const calibratedOffset = useRef<number | null>(null);
  const magneticSignalValid = useRef(false);

  useEffect(() => {
    if (!cameraPermission || cameraPermission.granted || permissionAlertShown.current) return;
    if (!cameraPermission.canAskAgain) {
      permissionAlertShown.current = true;
      Alert.alert('Camera access needed', 'Enable camera access in Settings to use Neighborhood Radar.', [
        { text: 'Cancel', style: 'cancel', onPress: onClose },
        { text: 'Open Settings', onPress: () => { Linking.openSettings().catch(() => {}); } },
      ]);
      return;
    }
    permissionAlertShown.current = true;
    requestCameraPermission().then(result => {
      if (!result.granted) {
        Alert.alert('Camera access denied', 'Neighborhood Radar needs camera access to display the live view.', [
          { text: 'Close', style: 'cancel', onPress: onClose },
          ...(result.canAskAgain ? [{ text: 'Try again', onPress: () => { permissionAlertShown.current = false; requestCameraPermission(); } }] : [{ text: 'Open Settings', onPress: () => { Linking.openSettings().catch(() => {}); } }]),
        ]);
      }
    }).catch(() => setCameraError(true));
  }, [cameraPermission, onClose, requestCameraPermission]);

  useEffect(() => {
    let removeMagnetometer: (() => void) | undefined;
    let headingSubscription: Location.LocationSubscription | undefined;
    let mounted = true;
    Magnetometer.isAvailableAsync().then(available => {
      if (!mounted) return;
      magneticSignalValid.current = available;
      if (!available) { setSensorAvailable(false); return; }
      Magnetometer.setUpdateInterval(250);
      const subscription = Magnetometer.addListener(({ x, y, z }) => {
        const next = magneticHeading(x, y, z);
        if (next === null) { magneticSignalValid.current = false; calibratedOffset.current = null; setSensorAvailable(false); setHeading(null); subscription.remove(); return; }
        rawMagHeading.current = next;
        if (calibratedOffset.current !== null) setHeading((next + calibratedOffset.current + 360) % 360);
      });
      removeMagnetometer = () => subscription.remove();
      // Expo's raw magnetometer stream has no calibration-accuracy field. Use
      // the platform heading accuracy as a calibration check and offset the
      // magnetometer azimuth to true north. If accuracy is invalid/poor, drag
      // gestures become the 360-degree fallback instead of showing a false AR bearing.
      Location.watchHeadingAsync(({ trueHeading, accuracy }) => {
        const calibrated = magneticSignalValid.current && accuracy >= 0 && accuracy <= 35 && Number.isFinite(trueHeading) && trueHeading >= 0;
        if (!calibrated || rawMagHeading.current === null) {
          calibratedOffset.current = null;
          setSensorAvailable(false);
          setHeading(null);
          return;
        }
        calibratedOffset.current = signedAngleDifference(trueHeading, rawMagHeading.current);
        setSensorAvailable(true);
        setHeading(trueHeading);
      }).then(subscription => {
        if (!mounted) subscription.remove();
        else headingSubscription = subscription;
      }).catch(() => { if (mounted) { setSensorAvailable(false); setHeading(null); } });
    }).catch(() => { if (mounted) setSensorAvailable(false); });
    return () => { mounted = false; removeMagnetometer?.(); headingSubscription?.remove(); };
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => sensorAvailable !== true && Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderGrant: () => { panStartHeading.current = panHeadingRef.current; },
    onPanResponderMove: (_event, gesture) => {
      const next = ((panStartHeading.current - gesture.dx * 0.55) % 360 + 360) % 360;
      panHeadingRef.current = next;
      setPanHeading(next);
    },
  }), [sensorAvailable]);

  const activeHeading = heading ?? panHeading;
  const nearby = useMemo(() => items.map(listing => {
    const distanceKm = haversineKm(location, listing.location);
    return { listing, distanceKm, bearing: bearingDegrees(location, listing.location) };
  }).filter(item => item.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8), [items, location, radiusKm]);

  const visibleItems: PositionedListing[] = useMemo(() => nearby.flatMap((item, index) => {
    const delta = signedAngleDifference(item.bearing, activeHeading);
    if (Math.abs(delta) > RADAR_FOV_DEGREES / 2) return [];
    const x = width / 2 + delta / (RADAR_FOV_DEGREES / 2) * width / 2;
    const cardWidth = Math.min(186, width - 28);
    return [{ ...item, delta, left: Math.max(10, Math.min(width - cardWidth - 10, x - cardWidth / 2)), top: Math.max(145, Math.min(height - 265, 175 + (index % 4) * 112)) }];
  }), [nearby, activeHeading, width, height]);

  if (!cameraPermission) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101713' }}><ActivityIndicator color="white" /><Text style={{ color: 'white', marginTop: 12 }}>Checking camera access…</Text></View>;
  if (!cameraPermission.granted) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.cream }}><Text style={{ color: colors.ink, fontSize: 23, fontWeight: '900' }}>Camera permission required</Text><Text style={{ color: colors.muted, marginVertical: 12 }}>Allow camera access to use the Neighborhood Radar.</Text><Button title="Allow camera" onPress={() => { permissionAlertShown.current = false; requestCameraPermission(); }} /><Pressable onPress={onClose} style={{ padding: 16, alignItems: 'center' }}><Text style={{ color: colors.green, fontWeight: '800' }}>Close radar</Text></Pressable></View>;

  return <View style={{ flex: 1, backgroundColor: '#101713' }}>
    {!cameraError ? <CameraView style={{ position: 'absolute', width: '100%', height: '100%' }} facing="back" onMountError={() => setCameraError(true)} /> : <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: '#1d2b23', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="camera-outline" size={42} color="#c9e2cd" /><Text style={{ color: 'white', marginTop: 10 }}>Live camera is unavailable</Text></View>}
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 170, backgroundColor: '#0005' }} />
    <View style={{ position: 'absolute', top: 56, left: 18, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close radar" onPress={onClose} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101713cc' }}><Ionicons name="close" size={24} color="white" /></Pressable>
      <View style={{ alignItems: 'center', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 18, backgroundColor: '#101713cc' }}><Text style={{ color: 'white', fontSize: 12, fontWeight: '900' }}>NEIGHBORHOOD RADAR · {radiusKm} KM</Text><Text style={{ color: '#d6e3d9', fontSize: 10, marginTop: 3 }}>{sensorAvailable && heading !== null ? `Compass ${Math.round(heading)}°` : 'Drag to sweep · compass unavailable'}</Text></View>
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101713cc' }}><Ionicons name={sensorAvailable && heading !== null ? 'navigate' : 'hand-left-outline'} size={19} color="white" /></View>
    </View>
    <View style={{ position: 'absolute', top: height * 0.49, left: 0, right: 0, height: 1, backgroundColor: '#ffffff55' }} />
    {sensorAvailable !== true && <View {...panResponder.panHandlers} style={{ position: 'absolute', top: 130, bottom: 110, left: 0, right: 0 }} />}
    {visibleItems.map(({ listing, distanceKm, left, top }) => <ARItemCard key={listing.id} listing={listing} distanceKm={distanceKm} left={left} top={top} onPress={() => setSelected(listing)} />)}
    {visibleItems.length === 0 && <View pointerEvents="none" style={{ position: 'absolute', top: height * 0.4, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: '#101713cc' }}><Text style={{ color: 'white', fontWeight: '700' }}>{nearby.length ? 'Turn or sweep to find nearby items' : `No listings within ${radiusKm} km`}</Text></View>}
    <View style={{ position: 'absolute', bottom: 28, left: 18, right: 18, padding: 12, borderRadius: 15, backgroundColor: '#101713cc', alignItems: 'center' }}><Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>{nearby.length} nearby {nearby.length === 1 ? 'item' : 'items'} · {visibleItems.length} in view</Text><Text style={{ color: '#d6e3d9', fontSize: 10, marginTop: 3 }}>Distances use your saved location and the active radius.</Text></View>
    <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}><View style={{ padding: 22, paddingBottom: 34, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.white }}>
        <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={{ alignSelf: 'flex-end', padding: 5 }}><Ionicons name="close" size={23} color={colors.ink} /></Pressable>
        {selected?.images[0] ? <Image source={{ uri: selected.images[0] }} style={{ width: '100%', height: 180, borderRadius: 16 }} resizeMode="cover" /> : null}
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 14 }}>{selected?.title}</Text>
        <Text style={{ color: colors.muted, marginTop: 5 }}>{selected?.category} · {selected?.distanceKm !== undefined ? `${selected.distanceKm.toFixed(1)} km away` : 'Nearby'}</Text>
        <Text numberOfLines={3} style={{ color: colors.ink, marginTop: 10 }}>{selected?.description || 'No description provided.'}</Text>
        <Text style={{ color: colors.green, fontWeight: '900', fontSize: 18, marginVertical: 12 }}>{selected?.transactionTypes.includes('rent') ? `₹${selected.rentalDetails?.pricePerDay ?? 0} / day` : selected?.price ? `₹${selected.price.toLocaleString('en-IN')}` : selected?.transactionTypes.includes('swap') ? 'Open to swap' : 'Free'}</Text>
        <Button title="View item details" onPress={() => { if (selected) onOpenListing(selected); setSelected(null); }} />
      </View></View>
    </Modal>
  </View>;
}

function ARItemCard({ listing, distanceKm, left, top, onPress }: { listing: Listing; distanceKm: number; left: number; top: number; onPress: () => void }) {
  const amount = listing.transactionTypes.includes('rent') ? `₹${listing.rentalDetails?.pricePerDay ?? 0}/day` : listing.price > 0 ? `₹${listing.price.toLocaleString('en-IN')}` : listing.transactionTypes.includes('swap') ? 'Swap' : 'Free';
  return <Pressable onPress={onPress} style={{ position: 'absolute', left, top, width: Math.min(186, useWindowDimensions().width - 28), padding: 9, borderRadius: 15, backgroundColor: '#fafff6ee', borderWidth: 1, borderColor: '#ffffffcc', elevation: 6 }}>
    <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>{listing.images?.[0] ? <Image source={{ uri: listing.images[0] }} style={{ width: 44, height: 44, borderRadius: 9, backgroundColor: colors.photo }} /> : <View style={{ width: 44, height: 44, borderRadius: 9, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="cube-outline" size={22} color={colors.green} /></View>}<View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: '900' }}>{listing.title}</Text><Text numberOfLines={1} style={{ color: colors.green, fontSize: 11, fontWeight: '900', marginTop: 3 }}>{amount}</Text></View></View>
    <Text style={{ color: colors.muted, fontSize: 10, marginTop: 7 }}>{distanceKm.toFixed(1)} km away · Tap for details</Text>
  </Pressable>;
}
