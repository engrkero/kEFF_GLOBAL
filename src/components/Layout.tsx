import React from 'react';
import { Home, Search, MessageSquare, User, PlusCircle, LogIn, LogOut, Package, Settings, Shield } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, login, logout } = useAuth();

  const navItems = [
    { icon: Home, label: 'Market', path: '/' },
    { icon: Search, label: 'Browse', path: '/browse' },
    { icon: PlusCircle, label: 'Sell', path: '/sell', highlight: true },
    { icon: MessageSquare, label: 'Chats', path: '/chats' },
    { icon: user ? Settings : LogIn, label: user ? 'Settings' : 'Login', path: user ? '/settings' : '#', action: !user ? login : undefined },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      {/* Sleek App Header */}
      <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-xl border-b border-slate-200 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
             <span className="text-white font-black text-lg">K</span>
          </div>
          <Link to="/" className="text-lg font-bold tracking-tight text-slate-800">
            KUFF <span className="text-indigo-600">GLOBAL</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <Link to="/orders" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                 <Package className="w-5 h-5" />
              </Link>
              <Link to="/settings" className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-4 h-4 text-slate-400" />
                )}
              </Link>
            </div>
          ) : (
            <button 
              onClick={login}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full"
            >
              LOGIN
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24">
        {children}
      </main>

      {/* Sleek Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-2 pb-safe">
        <div className="max-w-lg mx-auto flex justify-between items-center text-slate-400">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const content = (
              <div
                className={cn(
                  "flex flex-col items-center gap-1 transition-all duration-300 group cursor-pointer",
                  isActive ? "text-indigo-600" : "hover:text-slate-800",
                  item.highlight && "text-indigo-600"
                )}
                onClick={item.action}
              >
                <item.icon className={cn(
                  "w-5 h-5",
                  item.highlight && "w-8 h-8 -mt-6 bg-indigo-600 text-white rounded-2xl p-1.5 shadow-xl shadow-indigo-100 border-2 border-white transition-transform group-hover:scale-110",
                  !item.highlight && isActive && "scale-110"
                )} />
                {!item.highlight && (
                  <span className={cn(
                    "text-[8px] font-bold uppercase tracking-[0.05em]",
                    isActive ? "opacity-100" : "opacity-60"
                  )}>
                    {item.label}
                  </span>
                )}
              </div>
            );

            return item.path === '#' ? (
              <div key={item.label}>{content}</div>
            ) : (
              <Link key={item.path} to={item.path}>
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
