'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function BillingBannerInner() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  if (success) {
    return (
      <div className="bg-green-950/50 border border-green-800 text-green-300 rounded-lg p-4 mb-6">
        <p className="font-medium">🎉 Subscription activated!</p>
        <p className="text-sm text-green-400 mt-1">Your plan has been upgraded. Enjoy your new features!</p>
      </div>
    );
  }

  if (canceled) {
    return (
      <div className="bg-yellow-950/50 border border-yellow-800 text-yellow-300 rounded-lg p-4 mb-6">
        <p className="font-medium">Checkout cancelled</p>
        <p className="text-sm text-yellow-400 mt-1">No charges were made. You can upgrade anytime.</p>
      </div>
    );
  }

  return null;
}

export function BillingSuccessBanner() {
  return (
    <Suspense fallback={null}>
      <BillingBannerInner />
    </Suspense>
  );
}
