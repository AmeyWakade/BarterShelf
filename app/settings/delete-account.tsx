import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, colors } from '@/components/ui';
import { deleteAccount, getPublicWebUrl } from '@/services/api';

export default function DeleteAccountScreen() {
  const [busy, setBusy] = useState(false);
  function confirmDeletion() {
    Alert.alert('Delete your account?', 'This action is permanent and deletes your profile, all listings and photos, chats, reports, and related transaction records.', [
      { text: 'Keep account', style: 'cancel' },
      { text: 'Delete permanently', style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await deleteAccount(); router.replace('/auth'); }
        catch (error) { Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.'); }
        finally { setBusy(false); }
      } },
    ]);
  }
  return <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 66, backgroundColor: colors.cream }}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹  BACK</Text></Pressable>
    <View style={{ marginTop: 28, backgroundColor: colors.white, padding: 22, borderRadius: 20 }}>
      <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '900' }}>Delete account</Text>
      <Text style={{ color: colors.muted, lineHeight: 22, marginTop: 12 }}>Deleting your BarterShelf account is permanent. Your profile, listings, listing photos, conversations, and associated records will be removed.</Text>
      <Text style={{ color: colors.alertText, lineHeight: 22, marginTop: 14, fontWeight: '700' }}>This action is permanent and deletes all your listings and chats.</Text>
      <View style={{ marginTop: 22 }}><Button title={busy ? 'Deleting account…' : 'Delete my account'} disabled={busy} onPress={confirmDeletion} /></View>
    </View>
    <Text style={{ color: colors.muted, lineHeight: 21, marginTop: 22 }}>If you cannot sign in, submit an account deletion request on our public web page. We verify ownership before processing requests.</Text>
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(getPublicWebUrl('/delete-account'))} style={{ paddingVertical: 15 }}><Text style={{ color: colors.green, fontWeight: '800' }}>Open web deletion request</Text></Pressable>
  </ScrollView>;
}
