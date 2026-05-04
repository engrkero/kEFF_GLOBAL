import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Smartphone, MapPin, Loader2, ChevronLeft, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface WishlistItem {
  id: string; // listingId
  title: string;
  price: number;
  image: string;
  brand: string;
  location: string;
}

export default function Wishlist() {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const favsRef = collection(db, 'users', user.uid, 'favorites');
      const favsSnap = await getDocs(favsRef);
      
      const wishlisted = await Promise.all(favsSnap.docs.map(async (d) => {
        const listingId = d.id;
        const listingSnap = await getDoc(doc(db, 'listings', listingId));
        if (listingSnap.exists()) {
          const lData = listingSnap.data();
          return {
            id: listingId,
            title: lData.title,
            price: lData.price,
            image: lData.images?.[0] || '',
            brand: lData.brand,
            location: lData.location
          } as WishlistItem;
        }
        return null;
      }));

      setItems(wishlisted.filter((item): item is WishlistItem => item !== null));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'favorites', id));
      setItems(items.filter(item => item.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gathering Favorites...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-90 transition-transform">
          <ChevronLeft className="w-5 h-5 text-slate-800" />
        </Link>
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">Your<br/>Wishlist</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-full bg-slate-50 rounded-[3.5rem] p-16 text-center border border-dashed border-slate-200 space-y-6 flex flex-col items-center justify-center my-10"
          >
            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl relative">
               <motion.div
                 animate={{ scale: [1, 1.1, 1] }}
                 transition={{ repeat: Infinity, duration: 2 }}
               >
                 <Heart className="w-16 h-16 text-pink-500 fill-pink-500" />
               </motion.div>
               <div className="absolute -top-2 -right-2 p-3 bg-indigo-600 rounded-2xl shadow-lg">
                  <Smartphone className="w-5 h-5 text-white" />
               </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Your Heart list is Empty</h3>
              <p className="text-xs font-medium text-slate-400 leading-relaxed max-w-[240px]">
                Save items you're interested in while browsing. We'll alert you if the price drops!
              </p>
            </div>
            <Link to="/browse" className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all">
              Start Shopping
            </Link>
          </motion.div>
        ) : (
          <AnimatePresence>
            {items.map((item, index) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-[2.5rem] border border-slate-100 p-4 flex gap-5 shadow-sm hover:shadow-xl transition-all relative group"
              >
                <Link to={`/product/${item.id}`} className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                   <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                </Link>
                
                <div className="flex-1 min-w-0 pr-10 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                     <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-tighter">
                        {item.brand}
                     </span>
                  </div>
                  <Link to={`/product/${item.id}`} className="block">
                    <h3 className="font-black text-slate-800 tracking-tight leading-tight truncate">{item.title}</h3>
                  </Link>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                    <MapPin className="w-3 h-3" />
                    <p className="text-[10px] font-bold truncate">{item.location}</p>
                  </div>
                  <p className="text-indigo-600 font-black text-lg tracking-tighter mt-1">₦{(item.price / 100).toLocaleString()}</p>
                </div>

                <button 
                  onClick={() => removeItem(item.id)}
                  className="absolute top-4 right-4 p-3 bg-red-50 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
