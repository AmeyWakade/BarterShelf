import React, { useEffect, useState } from 'react';
import { Alert, Appearance, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Button, colors } from '@/components/ui';
import { RadiusSlider } from '@/components/RadiusSlider';
import { clearSession, fetchBlockedUsers, getSession, unblockUser, updateNeighborhood, updateRadiusPreference } from '@/services/api';
import { getCurrentLocation } from '@/services/location';

type Theme = 'system' | 'light' | 'dark';

export default function Profile() {
  const [theme, setTheme] = useState<Theme>('system');
  const [user, setUser] = useState(getSession()?.user);
  const [locationBusy, setLocationBusy] = useState(false);
  const [radius, setRadius] = useState(user?.radiusPreference ?? 3);
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; username: string }[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('bartershelf.theme').then(value => {
      if (value === 'light' || value === 'dark' || value === 'system') {
        setTheme(value); Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
      }
    });
  }, []);
  useEffect(() => { fetchBlockedUsers().then(setBlockedUsers).catch(() => {}); }, []);

  async function chooseTheme(value: Theme) {
    setTheme(value); Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
    await AsyncStorage.setItem('bartershelf.theme', value);
  }
  async function verify() {
    setLocationBusy(true);
    try { const loc = await getCurrentLocation(); const updated = await updateNeighborhood(loc); setUser(updated); Alert.alert('Neighborhood saved', loc.localityName); }
    catch (error) { Alert.alert('Could not verify location', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setLocationBusy(false); }
  }
  async function signOut() { await clearSession(); router.replace('/auth'); }

  return <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 68, backgroundColor: colors.cream, flexGrow: 1 }}>
    <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '800' }}>YOUR BARTERSHELF</Text>
    <Text style={{ fontSize: 30, color: colors.ink, fontWeight: '900', marginTop: 8 }}>A little closer.</Text>
    <View style={{ alignItems: 'center', paddingVertical: 30 }}>
      <View style={{ height: 88, width: 88, borderRadius: 44, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 36, fontWeight: '900', color: colors.green }}>{user?.username?.[0]?.toUpperCase() ?? '?'}</Text></View>
      <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 13 }}>{user?.username ?? 'Neighbor'}</Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginTop: 5 }}>{user?.email}</Text>
      <Text style={{ fontSize: 11, color: colors.green, fontWeight: '800', marginTop: 8 }}>{user?.role === 'vendor' ? user.vendorVerified ? 'VERIFIED LOCAL VENDOR' : 'VENDOR VERIFICATION PENDING' : user?.role === 'individual_seller' ? 'REGULAR SELLER' : 'COMMUNITY MEMBER'}</Text>
    </View>
    <View style={{ padding: 18, backgroundColor: colors.white, borderRadius: 20, marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>NEIGHBORHOOD</Text>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, marginVertical: 9 }}>📍 {user?.location?.localityName ?? 'Not set yet'}</Text>
      <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 13 }}>Your precise coordinates are used for nearby search and are never shown on public listing cards.</Text>
      <Button title={locationBusy ? 'Checking location…' : user?.location ? 'Update my location' : 'Verify my neighborhood'} disabled={locationBusy} onPress={verify} />
    </View>
    <View style={{ padding: 18, backgroundColor: colors.white, borderRadius: 20, marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>Appearance</Text>
      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 5 }}>Choose a theme or follow your device setting.</Text>
      <View style={{ flexDirection: 'row', gap: 7, marginTop: 12 }}>{(['system', 'light', 'dark'] as Theme[]).map(value => <Pressable key={value} onPress={() => chooseTheme(value)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: theme === value ? colors.green : colors.cream }}><Text style={{ fontSize: 12, fontWeight: '800', color: theme === value ? 'white' : colors.ink }}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>
    </View>
    <View style={{ padding: 18, backgroundColor: colors.white, borderRadius: 20, marginBottom: 14 }}><Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>Discovery radius</Text><RadiusSlider value={radius} onChange={value => { setRadius(value); updateRadiusPreference(value).catch(error => Alert.alert('Could not save preference', error.message)); }} /></View>
    <View style={{ padding: 18, backgroundColor: colors.white, borderRadius: 20, marginBottom: 14 }}>
      <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 15 }}>Privacy and account</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push('/settings/privacy')} style={{ paddingTop: 16 }}><Text style={{ color: colors.green, fontWeight: '800' }}>Privacy policy</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings/delete-account')} style={{ paddingTop: 16 }}><Text style={{ color: colors.alertText, fontWeight: '800' }}>Delete account</Text></Pressable>
      {blockedUsers.length > 0 && <View style={{ marginTop: 18, borderTopWidth: 1, borderColor: colors.line, paddingTop: 14 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>Blocked users</Text>{blockedUsers.map(person => <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 }}><Text style={{ color: colors.muted }}>{person.username}</Text><Pressable onPress={async () => { try { await unblockUser(person.id); setBlockedUsers(current => current.filter(item => item.id !== person.id)); } catch (error) { Alert.alert('Could not unblock user', error instanceof Error ? error.message : 'Please try again.'); } }}><Text style={{ color: colors.green, fontWeight: '800' }}>Unblock</Text></Pressable></View>)}</View>}
    </View>
    <View style={{ marginTop: 'auto', paddingTop: 14 }}><Button title="Sign out" variant="secondary" onPress={signOut} /></View>
  </ScrollView>;
}
