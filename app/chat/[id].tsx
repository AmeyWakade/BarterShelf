import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, colors, Field } from '@/components/ui';
import { ReportModal } from '@/components/ReportModal';
import { blockUser, fetchChats, fetchChatMessages, getSession, postChatMessage } from '@/services/api';
import type { ChatMessage, ChatThread } from '@/types';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chat, setChat] = useState<ChatThread>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [offerMode, setOfferMode] = useState<'cash' | 'trade' | null>(null);
  const [amount, setAmount] = useState('');
  const [tradeItem, setTradeItem] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reportMessageId, setReportMessageId] = useState('');
  const currentId = getSession()?.user.id;
  const other = chat?.participants.find(person => person.id !== currentId);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [threads, nextMessages] = await Promise.all([fetchChats(), fetchChatMessages(id)]);
      setChat(threads.find(thread => thread.id === id)); setMessages(nextMessages); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load messages.'); }
  }, [id]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 5000); return () => clearInterval(timer); }, [load]);

  async function send() {
    if (!text.trim()) return;
    if (offerMode === 'cash' && (!amount || Number(amount) < 0)) return Alert.alert('Enter an offer', 'Add a valid cash offer amount.');
    if (offerMode === 'trade' && !tradeItem.trim()) return Alert.alert('Describe your trade', 'Name the item you can offer.');
    setBusy(true);
    try {
      await postChatMessage(id ?? '', text.trim(), offerMode ? { type: offerMode, ...(offerMode === 'cash' ? { amount: Number(amount) } : { itemDescription: tradeItem.trim() }) } : undefined);
      setText(''); setAmount(''); setTradeItem(''); setOfferMode(null); await load();
    } catch (e) { Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again.'); }
    finally { setBusy(false); }
  }
  function blockConversationUser() {
    if (!other) return;
    Alert.alert('Block this user?', 'They will no longer see your listings or send messages to you, and you will not see their listings.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block user', style: 'destructive', onPress: async () => {
        try { await blockUser(other.id); Alert.alert('User blocked', 'Messaging between your accounts is disabled.'); router.back(); }
        catch (e) { Alert.alert('Could not block user', e instanceof Error ? e.message : 'Please try again.'); }
      } },
    ]);
  }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.cream }}>
    <View style={{ paddingTop: 58, paddingHorizontal: 18, paddingBottom: 15, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.ink} /></Pressable>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink }}>{other?.username ?? 'Neighbor'}</Text><Text style={{ fontSize: 11, color: colors.muted }}>About {chat?.listing.title ?? 'your listing'}</Text></View>
      {!!other && <Pressable accessibilityRole="button" accessibilityLabel="Block user" onPress={blockConversationUser} style={{ padding: 7 }}><Ionicons name="ban-outline" size={21} color={colors.alertText} /></Pressable>}
      {!!other && <Pressable accessibilityRole="button" accessibilityLabel="Report latest message" onPress={() => { const last = [...messages].reverse().find(message => (typeof message.senderId === 'string' ? message.senderId : message.senderId.id) !== currentId); if (last) setReportMessageId(last.id); else Alert.alert('No message to report', 'There is no message from the other participant yet.'); }} style={{ padding: 7 }}><Ionicons name="flag-outline" size={21} color={colors.green} /></Pressable>}
    </View>
    {chat && <View style={{ padding: 13, backgroundColor: colors.lime, marginHorizontal: 16, marginTop: 13, borderRadius: 14 }}><Text style={{ fontWeight: '800', color: colors.ink }}>{chat.listing.title}</Text></View>}
    {!!error && <Text accessibilityRole="alert" style={{ padding: 14, color: colors.alertText }}>{error}</Text>}
    <FlatList style={{ flex: 1 }} data={messages} keyExtractor={message => message.id} contentContainerStyle={{ padding: 16, gap: 9 }} renderItem={({ item }) => {
      const senderId = typeof item.senderId === 'string' ? item.senderId : item.senderId.id;
      const mine = senderId === currentId;
      return <Pressable onLongPress={() => { if (!mine) setReportMessageId(item.id); }} delayLongPress={450} accessibilityHint={mine ? undefined : 'Long press to report this message'} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '84%', padding: 13, borderRadius: 17, backgroundColor: mine ? colors.green : colors.white }}>
        <Text style={{ color: mine ? colors.white : colors.ink, fontSize: 14 }}>{item.kind === 'offer' ? `💌 ${item.offer?.type === 'cash' ? `Cash offer ₹${item.offer.amount?.toLocaleString('en-IN')}` : `Trade for ${item.offer?.itemDescription}`} · ` : ''}{item.text}</Text>
      </Pressable>;
    }} ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.muted, marginTop: 25 }}>Say hello and start a neighborly conversation.</Text>} />
    <View style={{ padding: 13, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line }}>
      {offerMode && <View style={{ flexDirection: 'row', gap: 9 }}>{offerMode === 'cash' ? <Field label="Cash offer (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" style={{ marginBottom: 7 }} /> : <Field label="Item you can trade" value={tradeItem} onChangeText={setTradeItem} placeholder="e.g. A board game" style={{ marginBottom: 7 }} />}</View>}
      <Field value={text} onChangeText={setText} placeholder={offerMode ? 'Add a note with your offer…' : 'Write a friendly message…'} style={{ marginBottom: 9 }} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 9 }}><PillOffer label="Cash offer" active={offerMode === 'cash'} onPress={() => setOfferMode(mode => mode === 'cash' ? null : 'cash')} /><PillOffer label="Trade offer" active={offerMode === 'trade'} onPress={() => setOfferMode(mode => mode === 'trade' ? null : 'trade')} /></View>
      <Button title={busy ? 'Sending…' : offerMode ? 'Send offer' : 'Send message'} disabled={busy || !text.trim()} onPress={send} />
    </View>
    <ReportModal visible={Boolean(reportMessageId)} targetId={reportMessageId} targetType="chat_message" onClose={() => setReportMessageId('')} />
  </KeyboardAvoidingView>;
}

function PillOffer({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, backgroundColor: active ? colors.ink : '#eaf1df' }}><Text style={{ fontSize: 11, fontWeight: '800', color: active ? 'white' : colors.ink }}>{label}</Text></Pressable>;
}
