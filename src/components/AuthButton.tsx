'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';

export function AuthButton() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (status === 'loading') {
    return <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" />;
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn('github')}
        className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
        </svg>
        Sign In
      </button>
    );
  }

  const user = session.user;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
      >
        {user.image ? (
          <img src={user.image} alt="" className="w-7 h-7 rounded-full border border-gray-700" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-forge-700 flex items-center justify-center text-xs font-bold">
            {(user.name || user.username || 'U')[0].toUpperCase()}
          </div>
        )}
        <span className="text-gray-300 hidden sm:inline">{user.username || user.name}</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="font-medium text-sm">{user.name || user.username}</p>
            <p className="text-xs text-gray-500">@{user.username}</p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-forge-950 text-forge-300 border border-forge-800">
              {user.tier === 'free' ? 'Free' : user.tier === 'pro' ? 'Pro' : 'Team'}
            </span>
          </div>
          <div className="py-1">
            <a href="/dashboard" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
              Dashboard
            </a>
            <a href="/dashboard/servers" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
              Servers
            </a>
            <a href="/dashboard/billing" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
              Billing
            </a>
            <a href="/dashboard/api-keys" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
              API Keys
            </a>
          </div>
          <div className="border-t border-gray-800 py-1">
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
