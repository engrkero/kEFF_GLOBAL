import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show the prompt if it hasn't been shown in this session
      const dismissed = sessionStorage.getItem('install-prompt-dismissed');
      if (!dismissed) {
        setShow(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem('install-prompt-dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-32 left-4 right-4 z-[60] bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl flex items-center gap-4 border border-slate-800"
        >
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1 space-y-0.5">
            <h4 className="font-black text-sm tracking-tight">Install KUFF App</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Faster access & notifications</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleDismiss}
              className="p-3 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <button 
              onClick={handleInstall}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
            >
              Install
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
