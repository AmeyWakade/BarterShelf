import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from 'react-native';
import { colors } from '@/components/ui';
import { submitReport, type ReportReason } from '@/services/api';

const reasons: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'offensive', label: 'Offensive or abusive' },
];

export function ReportModal({ visible, targetId, targetType, onClose }: {
  visible: boolean; targetId: string; targetType: 'listing' | 'chat_message'; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function report(reason: ReportReason) {
    setBusy(true); setError('');
    try { await submitReport(targetId, targetType, reason); onClose(); Alert.alert('Report submitted', 'Thank you. Our team will review this content.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not submit your report.'); }
    finally { setBusy(false); }
  }
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#0008' }}>
      <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: 22 }}>
        <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 20 }}>Report {targetType === 'listing' ? 'listing' : 'message'}</Text>
        <Text style={{ color: colors.muted, marginTop: 6, marginBottom: 14 }}>Choose the reason that best describes the issue.</Text>
        {reasons.map(item => <Pressable key={item.value} disabled={busy} onPress={() => report(item.value)} style={{ paddingVertical: 13, borderBottomWidth: 1, borderColor: colors.line }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{item.label}</Text></Pressable>)}
        {busy && <ActivityIndicator color={colors.green} style={{ marginTop: 12 }} />}
        {!!error && <Text accessibilityRole="alert" style={{ color: colors.alertText, marginTop: 12 }}>{error}</Text>}
        <Pressable onPress={onClose} disabled={busy} style={{ alignSelf: 'flex-end', padding: 12, marginTop: 8 }}><Text style={{ color: colors.green, fontWeight: '800' }}>Cancel</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
