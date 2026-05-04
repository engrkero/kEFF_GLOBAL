import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, ShieldCheck, Zap, Loader2, Search as SearchIcon, TrendingUp, Sparkles, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, addDoc, serverTimestamp, where, deleteDoc, doc } from 'firebase/firestore';

interface Listing {
  id: string;
  title: string;
  price: number;
  condition: string;
  images: string[];
  sellerId: string;
  location?: string;
}

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchListings = async () => {
    const path = 'listings';
    try {
      // One-time cleanup for system mock data
      const systemQuery = query(collection(db, path), where('sellerId', '==', 'system'));
      const systemSnap = await getDocs(systemQuery);
      for (const docRef of systemSnap.docs) {
        await deleteDoc(doc(db, path, docRef.id));
      }

      const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(20));
      const snapshot = await getDocs(q);
      
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
      setListings(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Hero / Banner */}
      <section className="relative overflow-hidden rounded-[3rem] bg-indigo-600 p-10 text-white shadow-2xl shadow-indigo-100 group">
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
             <Sparkles className="w-3 h-3 text-indigo-300" />
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-100">Premium Tech Hub</span>
          </div>
          <div className="space-y-1">
             <h1 className="text-5xl font-black tracking-tighter leading-[0.85] italic">Premium Devices<br/>& Accessories.</h1>
             <p className="text-indigo-100 text-sm font-medium max-w-[220px] leading-relaxed pt-2">
                The elite peer-to-peer marketplace for authenticated tech and gear.
             </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Link to="/sell" className="bg-white text-indigo-600 px-8 py-4 rounded-2xl text-[10px] font-black shadow-xl active:scale-95 transition-all text-center uppercase tracking-widest">
              Sell Device
            </Link>
            <Link to="/browse" className="bg-indigo-500/30 backdrop-blur-xl text-white px-8 py-4 rounded-2xl text-[10px] font-black shadow-xl active:scale-95 transition-all flex items-center gap-2 uppercase tracking-widest border border-white/10">
              Browse
            </Link>
          </div>
        </div>
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-indigo-400 rounded-full blur-3xl opacity-40 group-hover:scale-150 transition-transform duration-1000" />
        <Smartphone className="absolute -right-10 -bottom-10 w-64 h-64 text-white opacity-10 transform -rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
      </section>

      {/* Trust Badges - Bento Style */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sleek flex flex-col items-center gap-2 text-center group hover:border-indigo-100 transition-colors">
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
            <ShieldCheck className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-tight">Secure<br/>Escrow</p>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sleek flex flex-col items-center gap-2 text-center group hover:border-indigo-100 transition-colors">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
            <Zap className="w-6 h-6 text-indigo-600" />
          </div>
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-tight">Verified<br/>Sellers</p>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sleek flex flex-col items-center gap-2 text-center group hover:border-indigo-100 transition-colors">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
            <Globe className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-tight">Nigeria<br/>Wide</p>
        </div>
      </div>

      {/* Featured Listings */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-lg font-bold text-slate-800">Recent Arrivals</h2>
          <Link to="/browse" className="text-xs font-bold text-blue-600 hover:underline">View All</Link>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.05
                }
              }
            }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {listings.map((item) => (
              <motion.div 
                key={item.id}
                variants={{
                  hidden: { opacity: 0, y: 10, scale: 0.98 },
                  visible: { opacity: 1, y: 0, scale: 1 }
                }}
              >
                <Link to={`/product/${item.id}`} className="group block space-y-3">
                  <div className="aspect-[4/5] overflow-hidden rounded-[2.5rem] bg-slate-100 relative border border-slate-200/50 shadow-sm transition-all group-hover:shadow-indigo-100 group-hover:shadow-lg">
                    <img 
                      src={item.images[0]} 
                      alt={item.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-2xl text-[9px] font-black uppercase tracking-widest text-indigo-600 border border-indigo-100 shadow-sm">
                      {item.condition}
                    </div>
                  </div>
                  <div className="px-2 space-y-1">
                    <h3 className="font-bold text-slate-800 text-sm truncate leading-tight">{item.title}</h3>
                    <p className="text-indigo-600 font-black text-lg tracking-tight">₦{(item.price / 100).toLocaleString()}</p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{item.location}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}
