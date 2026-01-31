'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  return (
    <div className="max-w-md mx-auto px-4 py-24">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center">
        <div className="text-4xl mb-4">⚡</div>
        <h1 className="text-2xl font-bold mb-2">Sign in to MCPForge</h1>
        <p className="text-gray-400 text-sm mb-8">
          Track your generations, save server configs, and unlock Pro features.
        </p>

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-lg p-3 text-sm mb-6">
            {error === 'OAuthSignin' && 'Error starting GitHub sign-in. Please try again.'}
            {error === 'OAuthCallback' && 'Error completing GitHub sign-in. Please try again.'}
            {error === 'Default' && 'An error occurred. Please try again.'}
            {!['OAuthSignin', 'OAuthCallback', 'Default'].includes(error) && 'An error occurred. Please try again.'}
          </div>
        )}

        <button
          onClick={() => signIn('github', { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          Continue with GitHub
        </button>

        <p className="text-gray-500 text-xs mt-6">
          Free to use. No credit card required.
        </p>
      </div>

      <div className="text-center mt-6">
        <a href="/generate" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Continue without signing in
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-4">⚡</div>
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
