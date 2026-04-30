import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, ShieldCheck, Zap, Loader2, Search as SearchIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';

interface Listing {
  id: string;
  title: string;
  price: number;
  condition: string;
  images: string[];
  sellerId: string;
  location?: string;
}

const MOCK_DATA = [
  {
    title: 'iPhone 15 Pro Max',
    brand: 'Apple',
    model: '15 Pro Max',
    price: 850000,
    condition: 'Mint',
    images: ['https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&q=80&w=400'],
    sellerId: 'system',
    location: 'Lagos, NG',
    status: 'Active'
  },
  {
    title: 'Samsung Galaxy S24 Ultra',
    brand: 'Samsung',
    model: 'S24 Ultra',
    price: 920000,
    condition: 'New',
    images: ['https://images.unsplash.com/photo-1707230491029-4c125697665b?auto=format&fit=crop&q=80&w=400'],
    sellerId: 'system',
    location: 'Abuja, NG',
    status: 'Active'
  }
];

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchListings = async () => {
    const path = 'listings';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(10));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Seed some data if empty
        console.log("Seeding initial listings...");
        for (const item of MOCK_DATA) {
          await addDoc(collection(db, path), {
            ...item,
            createdAt: serverTimestamp()
          });
        }
        // Re-fetch
        const retrySnapshot = await getDocs(q);
        const data = retrySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
        setListings(data);
      } else {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
        setListings(data);
      }
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
      <section className="relative overflow-hidden rounded-[2.5rem] bg-indigo-600 p-8 text-white shadow-2xl shadow-indigo-200">
        <div className="relative z-10 space-y-3">
          <h1 className="text-4xl font-black tracking-tighter leading-none">Upgrade<br/>Smarter.</h1>
          <p className="text-indigo-100 text-xs font-medium max-w-[180px] leading-relaxed">The elite peer-to-peer marketplace for authenticated smartphones.</p>
          <div className="flex gap-2">
            <button className="mt-4 bg-white text-indigo-600 px-5 py-2.5 rounded-2xl text-xs font-black shadow-sm active:scale-95 transition-all">
              SELL NOW
            </button>
            <Link to="/browse" className="mt-4 bg-indigo-500/50 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-sm active:scale-95 transition-all flex items-center gap-2">
              <SearchIcon className="w-3.5 h-3.5" />
              BROWSE
            </Link>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-indigo-500 rounded-full blur-3xl opacity-50" />
        <Smartphone className="absolute -right-6 -bottom-6 w-44 h-44 text-indigo-400 opacity-20 transform -rotate-12" />
      </section>

      {/* Trust Badges */}
      <div className="flex justify-between items-center bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sleek">
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-green-600" />
          </div>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Escrow</span>
        </div>
        <div className="w-[1px] h-10 bg-slate-100" />
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Verified</span>
        </div>
        <div className="w-[1px] h-10 bg-slate-100" />
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Global</span>
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
          <div className="grid grid-cols-2 gap-4">
            {listings.map((item, index) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Link to={`/product/${item.id}`} className="group block space-y-3">
                  <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-slate-100 relative border border-slate-200/50 shadow-sm transition-all group-hover:shadow-indigo-100 group-hover:shadow-lg">
                    <img 
                      src={item.images[0]} 
                      alt={item.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest text-indigo-600 border border-indigo-100 shadow-sm">
                      {item.condition}
                    </div>
                  </div>
                  <div className="px-1 space-y-1">
                    <h3 className="font-bold text-slate-800 text-sm truncate leading-tight">{item.title}</h3>
                    <p className="text-indigo-600 font-black text-lg tracking-tight">₦{(item.price / 100).toLocaleString()}</p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{item.location}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
