import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Shield, MapPin, Calendar, ChevronLeft, Loader2, MessageCircle, User, Package, Settings as SettingsIcon } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
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
  fromName?: string;
  fromAvatar?: string;
  rating: number;
  comment: string;
  createdAt: any;
  role: 'buyer' | 'seller';
}

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Fetch Reviews for this user (where toId == id)
      const q = query(
        collection(db, 'reviews'),
        where('toId', '==', id),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const reviewSnap = await getDocs(q);
      const reviewData = await Promise.all(reviewSnap.docs.map(async (d) => {
        const r = d.data() as Review;
        // Fetch reviewer info (optional optimization: store it in review doc)
        const reviewerSnap = await getDoc(doc(db, 'users', r.fromId, 'public', 'profile'));
        const reviewer = reviewerSnap.data();
        return {
          id: d.id,
          ...r,
          fromName: reviewer?.displayName || 'KUFF User',
          fromAvatar: reviewer?.avatarUrl
        };
      }));
      setReviews(reviewData);
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
        </div>
      </section>

      {/* Reviews Section */}
      <section className="space-y-6">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Feedback</h3>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{reviews.length} Recent</span>
        </div>

        {reviews.length === 0 ? (
          <div className="bg-slate-50 rounded-[2rem] p-12 text-center border border-dashed border-slate-200">
            <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No reviews yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((rev, index) => (
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
                      <p className="font-black text-slate-800 text-sm">{rev.fromName}</p>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{rev.role === 'buyer' ? 'Verified Buyer' : 'Verified Seller'}</span>
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
        )}
      </section>
    </div>
  );
}
