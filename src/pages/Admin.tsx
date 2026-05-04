import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, User, CheckCircle2, XCircle, Loader2, ChevronLeft, Search, CreditCard } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, getCountFromServer, collection, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface PendingSeller {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  verificationDocs?: string[];
  verificationStatus: string;
  bvn?: string;
  feePaid?: boolean;
  paystackRef?: string;
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellers, setSellers] = useState<PendingSeller[]>([]);
  const [stats, setStats] = useState({
    activeListings: 0,
    totalUsers: 0,
    completedTransactions: 0
  });
  const [processing, setProcessing] = useState<string | null>(null);

  // Hardcoded Admin check (matches firestore rules)
  const isAdmin = user?.email === 'kerenonen4@gmail.com';

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    
    // Set up real-time listener for pending verifications
    const q = query(
      collection(db, 'verifications'),
      where('status', '==', 'PENDING')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      try {
        const data = snap.docs.map(d => ({
          ...d.data(),
          id: d.id,
          userId: d.id
        } as any));
        setSellers(data);
        setError(null);
      } catch (e) {
        console.error("Live fetch error:", e);
        setError("Failed to process records.");
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("Snapshot error:", err);
      if (err.message.includes('requires an index')) {
        setError("This view requires a database index. Please check your Firestore console.");
      } else {
        setError("Could not load verification queue. Permission denied or system error.");
      }
      setLoading(false);
    });

    fetchMarketStats();

    return () => unsub();
  }, [user]);

  const fetchMarketStats = async () => {
    try {
      // Fetch stats in parallel for better performance
      const [listingsSnap, usersSnap, ordersSnap] = await Promise.all([
        getCountFromServer(query(collection(db, 'listings'), where('status', '==', 'Active'))),
        getCountFromServer(collectionGroup(db, 'profile')),
        getCountFromServer(query(collection(db, 'orders'), where('escrowStatus', '==', 'RELEASED')))
      ]);

      setStats({
        activeListings: listingsSnap.data().count,
        totalUsers: usersSnap.data().count,
        completedTransactions: ordersSnap.data().count
      });
    } catch (e: any) {
      console.error("Stats fetch failed:", e);
      // Don't crash the whole page if stats fail, but maybe show a subtle indicator
      if (e.message?.includes('offline')) {
        console.warn("Stats fetch failed because client is offline. Will retry on next interaction.");
      }
    }
  };

  const handleVerify = async (userId: string, status: 'VERIFIED' | 'REJECTED') => {
    setProcessing(userId);
    try {
      const profileRef = doc(db, 'users', userId, 'public', 'profile');
      await updateDoc(profileRef, {
        verificationStatus: status,
        updatedAt: serverTimestamp()
      });

      // Also update verification record
      await updateDoc(doc(db, 'verifications', userId), {
        status: status,
        updatedAt: serverTimestamp()
      });

      setSellers(prev => prev.filter(s => s.userId !== userId));
      alert(`User ${status.toLowerCase()} successfully!`);
    } catch (e) {
      console.error(e);
      alert("Verification failed.");
    } finally {
      setProcessing(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-6 py-8 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-3 bg-slate-50 rounded-2xl text-slate-400 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">Admin Dashboard</h1>
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">Verification Management</p>
        </div>
      </header>

      <div className="max-w-xl mx-auto p-6 space-y-8">
        {/* Marketplace Statistics */}
        <section className="space-y-4">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-2">Marketplace Performance</h3>
           <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm text-center space-y-1">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Listings</p>
                 <p className="text-xl font-black text-slate-800">{stats.activeListings}</p>
              </div>
              <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm text-center space-y-1">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Growth (Users)</p>
                 <p className="text-xl font-black text-slate-800">{stats.totalUsers}</p>
              </div>
              <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm text-center space-y-1">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Closed Deals</p>
                 <p className="text-xl font-black text-slate-800">{stats.completedTransactions}</p>
              </div>
           </div>
        </section>

        {/* Pending Verifications Stats Overlay */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-1">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Requests</p>
             <p className="text-3xl font-black text-slate-800">{sellers.length}</p>
          </div>
          <div className="bg-indigo-600 p-6 rounded-[2.5rem] shadow-xl shadow-indigo-100 text-white space-y-1">
             <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Last Sync</p>
             <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-100" />
                <p className="text-sm font-black uppercase tracking-widest">Live</p>
             </div>
          </div>
        </div>

        {/* List Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Queue</h3>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Requires Action</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
               <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 text-center space-y-3">
               <XCircle className="w-10 h-10 text-red-500 mx-auto" />
               <p className="text-sm font-black text-red-600 uppercase tracking-widest leading-relaxed">
                  {error}
               </p>
               <button 
                 onClick={() => window.location.reload()}
                 className="px-6 py-2 bg-red-100 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest"
               >
                 Retry
               </button>
            </div>
          ) : sellers.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] border border-dashed border-slate-200 p-16 text-center">
               <ShieldCheck className="w-12 h-12 text-slate-100 mx-auto mb-4" />
               <p className="text-sm font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                  All systems clear.<br/>No pending verifications.
               </p>
            </div>
          ) : (
            <div className="space-y-4">
               {sellers.map((seller) => (
                 <motion.div 
                   key={seller.userId}
                   layout
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6"
                 >
                   <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                         {seller.avatarUrl ? (
                           <img src={seller.avatarUrl} alt="" className="w-full h-full object-cover" />
                         ) : (
                           <User className="w-6 h-6 text-slate-300" />
                         )}
                      </div>
                      <div className="flex-1">
                         <h4 className="font-black text-slate-800 tracking-tight">{seller.displayName}</h4>
                         <div className="flex gap-2 border-t border-slate-50 pt-1 mt-1 flex-wrap">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Application</p>
                            {seller.bvn && (
                              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 rounded-full">BVN: {seller.bvn}</p>
                            )}
                            {seller.feePaid ? (
                              <p className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-2 rounded-full flex items-center gap-1">
                                <CreditCard className="w-2.5 h-2.5" /> ₦550 PAID
                              </p>
                            ) : (
                              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-2 rounded-full flex items-center gap-1">
                                <CreditCard className="w-2.5 h-2.5" /> NOT PAID
                              </p>
                            )}
                         </div>
                      </div>
                   </div>

                   {seller.verificationDocs && seller.verificationDocs.filter(d => !!d).length > 0 ? (
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Submitted Proof ({seller.verificationDocs.filter(d => !!d).length} files)</p>
                        <div className="grid grid-cols-2 gap-2">
                           {seller.verificationDocs.filter(d => !!d).map((docUrl, i) => (
                             <img 
                               key={i}
                               src={docUrl} 
                               alt={`Doc ${i + 1}`} 
                               className="w-full h-32 object-cover rounded-xl shadow-sm cursor-pointer hover:opacity-90 transition-opacity border border-white"
                               onClick={() => window.open(docUrl, '_blank')}
                             />
                           ))}
                        </div>
                     </div>
                   ) : (
                     <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
                        <XCircle className="w-4 h-4 text-amber-500" />
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">No Documents Attached</p>
                     </div>
                   )}

                   <div className="flex gap-3">
                      <button 
                        onClick={() => handleVerify(seller.userId, 'VERIFIED')}
                        disabled={!!processing}
                        className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-green-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        {processing === seller.userId ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-3 h-3" /> Approve</>}
                      </button>
                      <button 
                        onClick={() => handleVerify(seller.userId, 'REJECTED')}
                        disabled={!!processing}
                        className="flex-1 py-4 bg-white border border-slate-200 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        Reject
                      </button>
                   </div>
                 </motion.div>
               ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
