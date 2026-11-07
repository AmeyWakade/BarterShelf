import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, colors } from '@/components/ui';
import { blockUser, createChat, fetchListing, getSession, startTransaction } from '@/services/api';
import { ReportModal } from '@/components/ReportModal';
import type { Listing } from '@/types';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Listing>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  useEffect(() => { if (id) fetchListing(id).then(setListing).catch(e => setError(e.message)); }, [id]);

  function transact(type: 'sale' | 'rental') {
    if (!listing) return;
    if (listing.ownerId === getSession()?.user.id) return Alert.alert('Your listing', 'This is one of your own items.');
    Alert.alert(type === 'sale' ? 'Request purchase' : 'Request rental', type === 'sale' ? 'Create a pending pickup request? No payment is collected in the app.' : 'Create a one-day rental pickup request? No payment is collected in the app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', onPress: async () => {
        setBusy(true);
        try { await startTransaction(listing.id, type, type === 'rental' ? 1 : undefined); Alert.alert('Request sent', 'The seller can see this in their pickup dashboard.'); }
        catch (e) { Alert.alert('Could not send request', e instanceof Error ? e.message : 'Please try again.'); }
        finally { setBusy(false); }
      } },
    ]);
  }
  async function messageSeller() {
    if (!listing) return;
    if (listing.ownerId === getSession()?.user.id) return Alert.alert('Your listing', 'This is one of your own items.');
    setBusy(true);
    try { const chat = await createChat(listing.id); router.push(`/chat/${chat.id}`); }
    catch (e) { Alert.alert('Could not open conversation', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  function blockSeller() {
    if (!listing) return;
    Alert.alert('Block this user?', 'Their listings will be hidden from you, and messaging between your accounts will be disabled.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block user', style: 'destructive', onPress: async () => {
        try { await blockUser(listing.ownerId); Alert.alert('User blocked', 'Their listings and messages are now hidden.'); router.back(); }
        catch (e) { Alert.alert('Could not block user', e instanceof Error ? e.message : 'Please try again.'); }
      } },
    ]);
  }

  if (error) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.cream }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{error}</Text><Text onPress={() => router.back()} style={{ color: colors.green, marginTop: 15 }}>Go back</Text></View>;
  if (!listing) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}><Text style={{ color: colors.muted }}>Loading listing…</Text></View>;

  return <ScrollView contentContainerStyle={{ paddingBottom: 38, backgroundColor: colors.cream }}>
    <Text onPress={() => router.back()} style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 17, color: colors.green, fontWeight: '800' }}>‹  BACK TO EXPLORE</Text>
    {listing.images?.[0] ? <Image source={{ uri: listing.images[0] }} resizeMode="cover" style={{ height: 280, width: '100%', backgroundColor: '#e1ead8' }} /> : <View style={{ height: 230, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e1ead8' }}><Text style={{ fontSize: 80 }}>📦</Text></View>}
    <View style={{ padding: 22 }}>
      <Text style={{ fontSize: 27, fontWeight: '900', color: colors.ink }}>{listing.title}</Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginTop: 7 }}>{listing.category} · {listing.conditionType === 'first_hand' ? 'New' : 'Pre-owned'} · {listing.location.localityName} · {listing.ownerName}</Text>
      {listing.ownerId !== getSession()?.user.id && <View style={{ flexDirection: 'row', gap: 18, marginTop: 12 }}><Text accessibilityRole="button" onPress={() => setReportVisible(true)} style={{ color: colors.green, fontWeight: '800' }}>Report listing</Text><Text accessibilityRole="button" onPress={blockSeller} style={{ color: colors.alertText, fontWeight: '800' }}>Block user</Text></View>}
      <Text style={{ fontSize: 14, color: colors.ink, lineHeight: 22, marginTop: 18 }}>{listing.description || 'No description added.'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>{listing.transactionTypes.map(type => <View key={type} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: '#eaf1df' }}><Text style={{ fontSize: 11, fontWeight: '900', color: colors.green }}>{type.toUpperCase()}</Text></View>)}</View>
      {listing.price > 0 && <Text style={{ fontSize: 23, fontWeight: '900', color: colors.green, marginTop: 20 }}>₹{listing.price.toLocaleString('en-IN')}</Text>}
      {listing.rentalDetails && <Text style={{ fontSize: 17, fontWeight: '800', color: colors.green, marginTop: 12 }}>₹{listing.rentalDetails.pricePerDay.toLocaleString('en-IN')} / day · ₹{listing.rentalDetails.securityDeposit.toLocaleString('en-IN')} deposit</Text>}
      <View style={{ gap: 10, marginTop: 25 }}>
        {listing.transactionTypes.some(type => ['buy', 'sell'].includes(type)) && <Button title="Request purchase pickup" disabled={busy} onPress={() => transact('sale')} />}
        {listing.transactionTypes.includes('rent') && <Button title="Request 1-day rental" variant="secondary" disabled={busy} onPress={() => transact('rental')} />}
        {(listing.transactionTypes.includes('swap') || listing.transactionTypes.includes('rent') || listing.transactionTypes.some(type => ['buy','sell'].includes(type))) && <Button title={listing.transactionTypes.includes('swap')?'Message to propose a swap':'Message seller'} variant="secondary" disabled={busy} onPress={messageSeller} />}
      </View>
    </View>
    <ReportModal visible={reportVisible} targetId={listing.id} targetType="listing" onClose={() => setReportVisible(false)} />
  </ScrollView>;
}
