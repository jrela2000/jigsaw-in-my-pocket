import React from 'react';

export function PaymentsProvider({ children }: { children: React.ReactElement }) {
  return children;
}
export type PayOutcome = { ok: boolean; cancelled?: boolean; message?: string };
export async function pay(_clientSecret: string, _name?: string): Promise<PayOutcome> {
  return { ok: false, message: 'Print checkout is available in the iOS and Android apps.' };
}
