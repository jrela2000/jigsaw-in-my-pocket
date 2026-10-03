import React, { useCallback, useState } from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppBar, Button, Card, Chip, Icon, Row, T } from '../../components/ui';
import { colors } from '../../theme';
import { listOrders, ORDER_STATUS, PrintOrder } from '../../services/commerce';
import { formatCents } from '../../../supabase/functions/_shared/pricing';
import { configured } from '../../config/env';
import { isUnder13, useSettings } from '../../store/settings';

export default function Orders() {
  const [orders, setOrders] = useState<PrintOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const under13 = useSettings((s) => isUnder13(s.birthYear));

  const load = useCallback(async () => {
    try {
      setOrders(await listOrders());
      setError(null);
    } catch {
      setError('Your orders could not be loaded. Pull down to try again.');
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View><T v="overline">Printed puzzles</T><T v="headline">My Orders</T></View>
        {error ? <Card tone="low"><T v="body">{error}</T></Card> : null}
        {under13 ? (
          <Card tone="low"><T v="body">Print ordering is not available for this profile.</T></Card>
        ) : orders && orders.length > 0 ? (
          orders.map((o) => (
            <Card key={o.id} style={{ gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="titleLg" style={{ flex: 1 }} numberOfLines={1}>{o.title ?? 'Custom puzzle'}</T>
                <Chip label={ORDER_STATUS[o.status] ?? o.status} tone={o.status === 'shipped' || o.status === 'delivered' ? 'sage' : o.status === 'failed' || o.status === 'canceled' ? 'warn' : 'linen'} />
              </Row>
              <T v="body">{o.piece_count} pieces · {formatCents(o.total_amount_cents)} · {new Date(o.created_at).toLocaleDateString()}</T>
              {o.tracking_url ? <Button label={`Track parcel ${o.tracking_number ?? ''}`.trim()} icon="truck-delivery-outline" kind="secondary" size="sm" onPress={() => Linking.openURL(o.tracking_url!)} /> : null}
            </Card>
          ))
        ) : !error ? (
          <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 36 }}>
            <Icon name="package-variant-closed" size={36} color={colors.textMuted} />
            <T v="titleLg">No orders yet</T>
            <T v="body" center>Finish a puzzle, then order the same picture as a real printed jigsaw.</T>
            {!configured.supabase ? <T v="small" center>Print ordering is switched on once the online services are connected.</T> : null}
            <Button label="Go to gallery" kind="secondary" onPress={() => router.push('/')} />
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
