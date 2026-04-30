import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Shield, MapPin, Calendar, ChevronLeft, Loader2, MessageCircle, User, Package, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';

interface UserProfile {
  displayName: string;
  avatarUrl?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  verificationStatus?: string;
}

interface Review {
  id: string;
  fromId: string;
  toId: string;
  fromName?: string;
  fromAvatar?: string;
  rating: number;
  comment: string;
  createdAt: any;
  role: 'buyer' | 'seller';
}

interface Listing {
  id: string;
  title: string;
  price: number;
  condition: string;
  images: string[];
}

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviewsReceived, setReviewsReceived] = useState<Review[]>([]);
  const [reviewsGiven, setReviewsGiven] = useState<Review[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [activeTab, setActiveTab] = useState<'received' | 'given' | 'listings'>('received');
  const [loading, setLoading] = useState(true);
  const [editingMode, setEditingMode] = useState(false);

  const isOwnProfile = user?.uid === id;

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch User Public Profile
      const profileDoc = await getDoc(doc(db, 'users', id, 'public', 'profile'));
      if (profileDoc.exists()) {
        setProfile(profileDoc.data() as UserProfile);
      }

      // Fetch Reviews Received (as seller)
      const qReceived = query(
        collection(db, 'reviews'),
        where('toId', '==', id),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const receivedSnap = await getDocs(qReceived);
      const receivedData = await Promise.all(receivedSnap.docs.map(async (d) => {
        const r = d.data() as Review;
        const reviewerSnap = await getDoc(doc(db, 'users', r.fromId, 'public', 'profile'));
        const reviewer = reviewerSnap.data();
        return {
          id: d.id,
          ...r,
          fromName: reviewer?.displayName || 'KUFF User',
          fromAvatar: reviewer?.avatarUrl
        };
      }));
      setReviewsReceived(receivedData);

      // Fetch Reviews Given (as buyer)
      const qGiven = query(
        collection(db, 'reviews'),
        where('fromId', '==', id),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const givenSnap = await getDocs(qGiven);
      const givenData = await Promise.all(givenSnap.docs.map(async (d) => {
        const r = d.data() as Review;
        const toSnap = await getDoc(doc(db, 'users', r.toId, 'public', 'profile'));
        const to = toSnap.data();
        return {
          id: d.id,
          ...r,
          fromName: to?.displayName || 'KUFF Seller',
          fromAvatar: to?.avatarUrl
        };
      }));
      setReviewsGiven(givenData);

      // Fetch User Listings
      const qListings = query(
        collection(db, 'listings'),
        where('sellerId', '==', id),
        orderBy('createdAt', 'desc')
      );
      const listingsSnap = await getDocs(qListings);
      setListings(listingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Listing)));

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Profile...</p>
      </div>
    );
  }

  if (!profile) {
    return <div className="p-10 text-center font-bold text-slate-400">Profile Not Found</div>;
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-90 transition-transform">
          <ChevronLeft className="w-5 h-5 text-slate-800" />
        </button>
        <h1 className="text-2xl font-black tracking-tighter text-slate-900">User Profile</h1>
      </div>

      {/* Profile Card */}
      <section className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sleek">
        <div className="bg-indigo-600 h-24 relative">
          <div className="absolute -bottom-12 left-8 p-1 bg-white rounded-[2rem] shadow-xl">
             <div className="w-24 h-24 rounded-[1.75rem] bg-indigo-50 flex items-center justify-center overflow-hidden border-4 border-white">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-10 h-10 text-indigo-200" />
                )}
             </div>
          </div>
        </div>
        <div className="pt-16 pb-8 px-8 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{profile.displayName}</h2>
                {profile.verificationStatus === 'VERIFIED' && (
                  <div className="p-1 bg-green-50 rounded-full" title="Verified Seller">
                    <Shield className="w-4 h-4 text-green-600 fill-green-600" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-3 h-3" />
                <span className="text-xs font-bold">{profile.location || 'Unknown Location'}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
               <div className="flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                  <Star className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                  <span className="text-sm font-black text-indigo-900">{(profile.rating || 0).toFixed(1)}</span>
               </div>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{profile.reviewCount || 0} Reviews</span>
            </div>
          </div>

          {/* Seller Stats Section */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
             <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Average Rating</p>
                <div className="flex items-center gap-2">
                   <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                   <p className="text-lg font-black text-slate-800">{(profile.rating || 0).toFixed(1)}</p>
                </div>
             </div>
             <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Reviews</p>
                <div className="flex items-center gap-2">
                   <MessageCircle className="w-4 h-4 text-indigo-500 fill-indigo-500" />
                   <p className="text-lg font-black text-slate-800">{profile.reviewCount || 0}</p>
                </div>
             </div>
          </div>

          <div className="flex gap-3 pt-4">
            {isOwnProfile ? (
              <>
                <button 
                  onClick={() => navigate('/orders')}
                  className="flex-[2] h-14 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  My Orders
                </button>
                <button 
                  onClick={() => navigate('/settings')}
                  className="flex-1 h-14 bg-white border border-slate-200 text-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center"
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => navigate(`/chat/room_${id}`)}
                  className="flex-[2] h-14 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Initiate Chat
                </button>
                <button className="flex-1 h-14 bg-white border border-slate-200 text-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                  Follow
                </button>
              </>
            )}
          </div>

          {isOwnProfile && user?.email === 'kerenonen4@gmail.com' && (
            <motion.button 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate('/admin')}
              className="w-full p-6 bg-slate-900 rounded-3xl flex items-center justify-between group overflow-hidden relative active:scale-[0.98] transition-all"
            >
               <div className="relative z-10">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">System Control</p>
                  <h3 className="text-xl font-black text-white tracking-tight">Admin Dashboard</h3>
               </div>
               <div className="relative z-10 w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 group-hover:bg-indigo-600 transition-colors">
                  <ShieldCheck className="w-6 h-6 text-white" />
               </div>
               <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            </motion.button>
          )}
        </div>
      </section>

      {/* Reviews Section */}
      <section className="space-y-6">
        <div className="flex flex-col gap-6 px-2">
           <div className="flex justify-between items-end">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Feedback</h3>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                {activeTab === 'received' ? reviewsReceived.length : reviewsGiven.length} Total
              </span>
           </div>

           {/* Tab Toggle */}
           <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              {isOwnProfile && (
                <button 
                  onClick={() => setActiveTab('listings')}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    activeTab === 'listings' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400"
                  )}
                >
                  My Store
                </button>
              )}
              <button 
                onClick={() => setActiveTab('received')}
                className={cn(
                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'received' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                )}
              >
                As Seller
              </button>
              <button 
                onClick={() => setActiveTab('given')}
                className={cn(
                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'given' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                )}
              >
                As Buyer
              </button>
           </div>
        </div>

        {activeTab === 'listings' && isOwnProfile && (
          <div className="space-y-6">
            <div className="flex gap-3">
               <button 
                 onClick={() => setEditingMode(!editingMode)}
                 className={cn(
                   "flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border",
                   editingMode ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-slate-200 text-slate-900"
                 )}
               >
                 {editingMode ? "Stop Editing" : "Edit Listing"}
               </button>
               <button 
                 onClick={() => navigate('/sell')}
                 className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
               >
                 <Package className="w-3.5 h-3.5" /> Add Product
               </button>
            </div>

            {listings.length === 0 ? (
              <div className="bg-slate-50 rounded-[2rem] p-12 text-center border border-dashed border-slate-200">
                 <Package className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                 <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No listings yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {listings.map((item) => (
                  <motion.div 
                    key={item.id}
                    layout
                    className="relative"
                  >
                    <div className={cn(
                      "group block space-y-3 transition-all",
                      editingMode && "opacity-50 grayscale scale-[0.98]"
                    )}>
                      <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-slate-100 relative border border-slate-200/50 shadow-sm">
                        <img 
                          src={item.images[0]} 
                          alt={item.title} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="px-1 space-y-1">
                        <h3 className="font-bold text-slate-800 text-xs truncate leading-tight">{item.title}</h3>
                        <p className="text-indigo-600 font-black text-sm tracking-tight">₦{(item.price / 100).toLocaleString()}</p>
                      </div>
                    </div>
                    {editingMode && (
                      <button 
                        onClick={() => navigate(`/edit/${item.id}`)}
                        className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-75 duration-200"
                      >
                         <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform -translate-y-2">
                            <SettingsIcon className="w-6 h-6 text-white" />
                         </div>
                         <span className="text-[9px] font-black text-indigo-900 uppercase tracking-widest">Edit Details</span>
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {(activeTab === 'received' || activeTab === 'given') && (
          (activeTab === 'received' ? reviewsReceived : reviewsGiven).length === 0 ? (
          <div className="bg-slate-50 rounded-[2rem] p-12 text-center border border-dashed border-slate-200">
            <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No reviews yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(activeTab === 'received' ? reviewsReceived : reviewsGiven).map((rev, index) => (
              <motion.div 
                key={rev.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden">
                       {rev.fromAvatar ? (
                         <img src={rev.fromAvatar} alt={rev.fromName} className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center font-black text-slate-400 uppercase">{rev.fromName?.charAt(0)}</div>
                       )}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 text-sm">
                        {activeTab === 'received' ? rev.fromName : `To: ${rev.fromName}`}
                      </p>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {rev.role === 'buyer' ? 'Verified Buyer' : 'Verified Seller'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < rev.rating ? 'fill-indigo-600 text-indigo-600' : 'text-slate-200'}`} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">"{rev.comment}"</p>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{rev.createdAt?.toDate ? rev.createdAt.toDate().toLocaleDateString() : 'Recent'}</p>
              </motion.div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
