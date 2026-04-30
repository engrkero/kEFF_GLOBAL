import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, ChevronRight, Star, Clock, AlertCircle, Loader2, CheckCircle2, Shield } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, addDoc, serverTimestamp, getDoc, runTransaction } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface Order {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  escrowStatus: string;
  createdAt: any;
  buyerReviewed?: boolean;
  sellerReviewed?: boolean;
  listing?: any;
}

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<'buying' | 'selling'>('buying');

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'orders'),
        where(activeTab === 'buying' ? 'buyerId' : 'sellerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const ordersData = await Promise.all(snapshot.docs.map(async (d) => {
        const order = { id: d.id, ...d.data() } as Order;
        const listingDoc = await getDoc(doc(db, 'listings', order.listingId));
        return { ...order, listing: listingDoc.data() };
      }));
      setOrders(ordersData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user, activeTab]);

  const handleReview = async () => {
    if (!user || !reviewOrder) return;
    setSubmitting(true);
    try {
      const reviewData = {
        orderId: reviewOrder.id,
        fromId: user.uid,
        toId: reviewOrder.sellerId, // In this page we only show "bought items", so target is seller
        role: 'buyer',
        rating,
        comment,
        createdAt: serverTimestamp()
      };

      await runTransaction(db, async (transaction) => {
        // 1. Create Review
        const reviewRef = doc(collection(db, 'reviews'));
        transaction.set(reviewRef, reviewData);

        // 2. Update Order Reviewed Flag
        const orderRef = doc(db, 'orders', reviewOrder.id);
        transaction.update(orderRef, { 
          buyerReviewed: true,
          updatedAt: serverTimestamp()
        });

        // 3. Update Seller Rating (Simplified aggregation)
        const sellerProfileRef = doc(db, 'users', reviewOrder.sellerId, 'public', 'profile');
        const sellerSnap = await transaction.get(sellerProfileRef);
        if (sellerSnap.exists()) {
          const sellerData = sellerSnap.data();
          const currentCount = sellerData.reviewCount || 0;
          const currentRating = sellerData.rating || 0;
          const newRating = ((currentRating * currentCount) + rating) / (currentCount + 1);
          transaction.update(sellerProfileRef, {
            rating: newRating,
            reviewCount: currentCount + 1
          });
        }
      });
      
      setReviewOrder(null);
      fetchOrders();
    } catch (error) {
      console.error(error);
      alert("Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retreiving History...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">Order<br/>History</h1>
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
           <Package className="w-6 h-6 text-indigo-600" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-[2rem] gap-1">
         <button 
           onClick={() => setActiveTab('buying')}
           className={cn(
             "flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
             activeTab === 'buying' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
           )}
         >
           Buying
         </button>
         <button 
           onClick={() => setActiveTab('selling')}
           className={cn(
             "flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
             activeTab === 'selling' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
           )}
         >
           Selling
         </button>
      </div>

      <div className="space-y-6">
        {orders.length === 0 ? (
          <div className="bg-slate-50 rounded-[3rem] p-16 text-center border border-dashed border-slate-200">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-6" />
            <p className="font-black text-slate-400 uppercase tracking-widest text-sm">No transactions yet</p>
            <Link to="/browse" className="mt-4 inline-block text-indigo-600 font-black text-[10px] uppercase tracking-widest">Browse Marketplace</Link>
          </div>
        ) : (
          orders.map((order, index) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg transition-all border-l-4 border-l-indigo-600 cursor-pointer"
            >
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order ID: #{order.id.slice(-6).toUpperCase()}</p>
                      <h3 className="font-black text-slate-800 tracking-tight">{order.listing?.title || 'Unknown Item'}</h3>
                   </div>
                   <div className={cn(
                     "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm",
                     order.escrowStatus === 'RELEASED' ? "bg-green-50 text-green-700" : "bg-indigo-50 text-indigo-700"
                   )}>
                     {order.escrowStatus.replace('_', ' ')}
                   </div>
                </div>

                <div className="flex justify-between items-end border-t border-slate-50 pt-4">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Payout</p>
                    <p className="text-xl font-black text-slate-900 tracking-tighter">₦{(order.amount / 100).toLocaleString()}</p>
                  </div>
                  
                  {order.escrowStatus === 'RELEASED' && !order.buyerReviewed ? (
                    <button 
                      onClick={() => setReviewOrder(order)}
                      className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center gap-2 active:scale-95 transition-all"
                    >
                      <Star className="w-3.5 h-3.5" />
                      Leave Review
                    </button>
                  ) : order.buyerReviewed ? (
                    <div className="flex items-center gap-1.5 text-green-600 font-black text-[9px] uppercase tracking-widest">
                       <CheckCircle2 className="w-3.5 h-3.5" />
                       Reviewed
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400 font-black text-[9px] uppercase tracking-widest">
                       <Clock className="w-3.5 h-3.5" />
                       In Progress
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Review Dialog */}
      <AnimatePresence>
        {reviewOrder && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setReviewOrder(null)}
                className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400 active:scale-90"
              >
                <ChevronRight className="w-5 h-5 rotate-90" />
              </button>

              <div className="space-y-6">
                <div className="text-center space-y-2 pt-4">
                   <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-inner">
                      <Star className="w-8 h-8 text-indigo-600" />
                   </div>
                   <h2 className="text-2xl font-black tracking-tighter text-slate-900">Rate your experience</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Bought {reviewOrder.listing?.title}</p>
                </div>

                <div className="flex justify-center gap-2 py-4">
                   {[1, 2, 3, 4, 5].map((star) => (
                     <button 
                       key={star} 
                       onClick={() => setRating(star)}
                       className="p-1 px-3 transition-transform active:scale-90"
                     >
                       <Star className={cn("w-10 h-10 transition-all", star <= rating ? "fill-indigo-600 text-indigo-600 scale-110" : "text-slate-200")} />
                     </button>
                   ))}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Written Feedback</label>
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Describe the condition and seller's communication..."
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] p-5 text-sm font-medium focus:ring-4 focus:ring-indigo-50 focus:bg-white outline-none transition-all placeholder:text-slate-300"
                  />
                </div>

                <button 
                  onClick={handleReview}
                  disabled={submitting || !comment.trim()}
                  className="w-full h-16 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publish Feedback"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
