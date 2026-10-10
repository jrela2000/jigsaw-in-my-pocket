import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AppBar, Button, Card, Screen, T } from '../../components/ui';
import { env, LEGAL_NOTICE } from '../../config/env';

const DOCS = {
  terms: { title: 'Terms of Service', url: env.termsUrl },
  privacy: { title: 'Privacy Policy', url: env.privacyUrl },
} as const;

const SUMMARY: Record<keyof typeof DOCS, string[]> = {
  terms: [
    LEGAL_NOTICE,
    'Pro memberships renew automatically until cancelled in your App Store or Google Play account settings.',
    'Physical puzzles are made to order. Contact support within 30 days if your order arrives damaged or misprinted.',
    'AI disclosure: this app was designed and built with the help of AI tools. The app itself has no AI features; your photos are never sent to an AI service.',
  ],
  privacy: [
    'We are against data collection. There is no account, no profile and no user database. Your photos, puzzles, progress, streak and birth year are stored only on your device.',
    'A photo leaves your phone only when you order it as a print. It is deleted from our storage 30 days after delivery.',
    'Third parties and what each receives:',
    '• Stripe (payments): your name, delivery address, email and payment details when you order a print. We never see your card and keep no copy of your address.',
    '• Printify (printing and delivery): the print photo, your name, delivery address and email, to make and ship your puzzle.',
    '• Apple / Google and RevenueCat (Pro membership): your purchase status, tied to an anonymous ID.',
    '• Google AdMob (free version only): ad requests and ad interactions, to show non-personalised ads. The app never asks to track you. Pro shows no ads and loads no ad software.',
    '• Supabase (our hosting): an anonymous ID, the status of your print orders, and the print photo until it is deleted.',
    'You can erase the order history and uploads tied to your device at any time in Settings.',
    'AI disclosure: this app was designed and built with the help of AI tools. The app itself has no AI features; your photos are never sent to an AI service.',
  ],
};

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key = doc === 'privacy' ? 'privacy' : 'terms';
  const d = DOCS[key];
  return (
    <Screen bar={<AppBar title={d.title} back right={<></>} />}>
      <Card>
        <T v="headlineSm">{d.title}</T>
        {SUMMARY[key].map((p) => <T key={p} v="body" style={{ marginTop: 10 }}>{p}</T>)}
      </Card>
      {d.url ? (
        <Button label={`Read the full ${d.title}`} icon="open-in-new" kind="secondary" onPress={() => WebBrowser.openBrowserAsync(d.url)} />
      ) : (
        <T v="small" center>The full document will be linked here before release.</T>
      )}
    </Screen>
  );
}
