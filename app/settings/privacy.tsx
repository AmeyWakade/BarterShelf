import React from 'react';
import { Linking, Pressable, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/components/ui';
import { getPublicWebUrl } from '@/services/api';

const sections = [
  ['Information collected', 'BarterShelf stores account details such as username, email, role, and a password hash; listings and photos; messages and offers; reports; and transaction requests.'],
  ['Location', 'With your permission, device location helps find listings in your selected neighborhood radius. Coordinates are used for nearby search and are not shown on public listing cards. You can revoke permission in device settings.'],
  ['Camera and photos', 'Camera or photo library permission is requested when you choose to take or select listing photos. Selected images are uploaded to our image storage provider and shown with your listing.'],
  ['How information is used', 'We use information to provide local discovery, listings, conversations, safety reporting, and pickup or rental requests. Other users can see your profile name, listing details, approximate locality, and listing photos.'],
  ['Retention and deletion', 'Account data is retained while your account is active. You can delete your account in Settings. This removes your profile, listings and photos, conversations, and related records. Limited information may be retained where law or security obligations require it.'],
  ['Security and contact', 'We use access controls and secure connections where supported. For privacy questions, contact the BarterShelf service operator using the support details published with the app.'],
] as const;

export default function PrivacyScreen() {
  return <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 66, backgroundColor: colors.cream }}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹  BACK</Text></Pressable>
    <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: 22 }}>Privacy policy</Text>
    <Text style={{ color: colors.muted, marginTop: 6 }}>Last updated November 7, 2026</Text>
    {sections.map(([heading, content]) => <React.Fragment key={heading}><Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 22 }}>{heading}</Text><Text style={{ color: colors.muted, lineHeight: 22, marginTop: 7 }}>{content}</Text></React.Fragment>)}
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(getPublicWebUrl('/privacy-policy'))} style={{ paddingVertical: 22 }}><Text style={{ color: colors.green, fontWeight: '800' }}>Open public privacy policy</Text></Pressable>
  </ScrollView>;
}
