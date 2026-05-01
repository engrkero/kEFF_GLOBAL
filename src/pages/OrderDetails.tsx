import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Package, Truck, Shield, AlertTriangle, CheckCircle2, Loader2, Info, ExternalLink, User, Star } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface Order {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  escrowStatus: 'PENDING_PAYMENT' | 'HELD_IN_ESCROW' | 'DELIVERED' | 'DISPUTED' | 'RELEASED' | 'REFUNDED';
  shippingProvider?: string;
  trackingNumber?: string;
  shippedAt?: any;
  createdAt: any;
  listing?: any;
}

export default function OrderDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Seller side state
  const [shippingProvider, setShippingProvider] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const handleSubmitReview = async () => {
    if (!order || !user) return;
    setUpdating(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        fromId: user.uid,
        toId: order.sellerId,
        orderId: order.id,
        listingId: order.listingId,
        rating,
        comment,
        role: 'buyer',
        createdAt: serverTimestamp()
      });

      // Update seller aggregate rating
      const profileRef = doc(db, 'users', order.sellerId, 'public', 'profile');
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const pData = profileSnap.data();
        const currentCount = pData.reviewCount || 0;
        const currentRating = pData.rating || 0;
        const newCount = currentCount + 1;
        const newRating = ((currentRating * currentCount) + rating) / newCount;
        
        await updateDoc(profileRef, {
          rating: newRating,
          reviewCount: newCount
        });
      }

      setReviewSubmitted(true);
      alert("Review submitted successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to submit review.");
    } finally {
      setUpdating(false);
    }
  };

  const fetchOrder = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'orders', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Order;
        // Verify access
        if (data.buyerId !== user.uid && data.sellerId !== user.uid) {
           navigate('/orders');
           return;
        }
        
        const listingSnap = await getDoc(doc(db, 'listings', data.listingId));
        setOrder({ id: docSnap.id, ...data, listing: listingSnap.data() });
        
        // Check buyer profile if they are the buyer
        if (data.buyerId === user.uid) {
           const profileSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'data'));
           if (profileSnap.exists()) {
              const pData = profileSnap.data();
              const isIncomplete = !pData.address || !pData.state || !pData.phoneNumber;
              setProfileIncomplete(isIncomplete);
           } else {
              setProfileIncomplete(true);
           }
        }

        if (data.shippingProvider) setShippingProvider(data.shippingProvider);
        if (data.trackingNumber) setTrackingNumber(data.trackingNumber);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id, user]);

  const handleUpdateStatus = async (newStatus: Order['escrowStatus']) => {
    if (!order) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        escrowStatus: newStatus,
        updatedAt: serverTimestamp()
      });
      fetchOrder();
    } catch (error) {
      console.error(error);
      alert("Failed to update order status.");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateShipping = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        shippingProvider,
        trackingNumber,
        shippedAt: order.shippedAt || serverTimestamp(),
        escrowStatus: 'DELIVERED', // Automatically move to delivered when shipping is added? Or let them choose.
        updatedAt: serverTimestamp()
      });
      fetchOrder();
    } catch (error) {
      console.error(error);
      alert("Failed to update shipping info.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Order Details...</p>
      </div>
    );
  }

  if (!order) return <div className="p-10 text-center">Order not found</div>;

  const isBuyer = order.buyerId === user?.uid;
  const isSeller = order.sellerId === user?.uid;

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-90 transition-transform">
          <ChevronLeft className="w-5 h-5 text-slate-800" />
        </button>
        <div className="space-y-0.5">
           <h1 className="text-2xl font-black tracking-tighter text-slate-900">Order Details</h1>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: #{order.id.slice(-8).toUpperCase()}</p>
        </div>
      </div>

       {/* Status Banner */}
      <div className={cn(
        "p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl shadow-slate-100 border",
        order.escrowStatus === 'RELEASED' ? "bg-green-50 border-green-100 text-green-900" :
        order.escrowStatus === 'DISPUTED' ? "bg-red-50 border-red-100 text-red-900" :
        "bg-indigo-50 border-indigo-100 text-indigo-900"
      )}>
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-2xl",
            order.escrowStatus === 'RELEASED' ? "bg-green-500 text-white" :
            order.escrowStatus === 'DISPUTED' ? "bg-red-500 text-white" :
            "bg-indigo-600 text-white"
          )}>
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Payment Status</p>
            <p className="font-black text-sm uppercase tracking-tight">{order.escrowStatus.replace('_', ' ')}</p>
          </div>
        </div>
        {order.escrowStatus === 'HELD_IN_ESCROW' && (
           <Shield className="w-8 h-8 text-indigo-600/20" />
        )}
      </div>

      {/* Profile Incomplete Prompt for Buyer */}
      {isBuyer && profileIncomplete && (order.escrowStatus === 'HELD_IN_ESCROW' || order.escrowStatus === 'PENDING_PAYMENT') && (
        <div className="mx-2 p-6 bg-amber-50 border border-amber-100 rounded-[2.5rem] space-y-4 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-100">
               <User className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-1">
               <h4 className="font-black text-sm text-amber-900 tracking-tight">Delivery Info Missing</h4>
               <p className="text-[10px] font-medium text-amber-700 leading-relaxed">
                  We need your address and phone number to arrange your delivery. Please complete your profile now.
               </p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/settings')}
            className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-100 active:scale-95 transition-all"
          >
            Complete Profile
          </button>
        </div>
      )}

      {/* Listing Info */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-5">
        <div className="flex gap-5 items-center">
          <div className="w-20 h-20 rounded-[1.5rem] bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
             {order.listing?.images?.[0] ? (
               <img src={order.listing.images[0]} alt={order.listing.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
             ) : (
               <div className="w-full h-full flex items-center justify-center font-black text-slate-200">IMG</div>
             )}
          </div>
          <div className="space-y-1">
             <h3 className="font-black text-slate-800 tracking-tight leading-tight">{order.listing?.title}</h3>
             <p className="text-xl font-black text-indigo-600 tracking-tighter">₦{(order.amount / 100).toLocaleString()}</p>
          </div>
        </div>
        
        {isBuyer && (
          <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                   <User className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller</p>
                   <Link to={`/seller/${order.sellerId}`} className="text-sm font-black text-indigo-600 hover:underline">
                      View Profile
                   </Link>
                </div>
             </div>
             <Link 
               to={`/chat/room_${order.listingId}_${order.buyerId}`}
               className="p-3 bg-indigo-50 text-indigo-600 rounded-xl active:scale-95 transition-all"
             >
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black uppercase tracking-widest">Chat</span>
                   <ExternalLink className="w-4 h-4" />
                </div>
             </Link>
          </div>
        )}
      </div>

      {/* Shipping Section */}
      {(order.escrowStatus === 'HELD_IN_ESCROW' || order.escrowStatus === 'DELIVERED' || order.escrowStatus === 'RELEASED') && (
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sleek space-y-6">
           <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Shipping & Tracking</h3>
           </div>
           
           {order.trackingNumber ? (
             <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Courier</p>
                      <p className="text-sm font-black text-slate-800">{order.shippingProvider}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tracking #</p>
                      <p className="text-sm font-black text-indigo-600">{order.trackingNumber}</p>
                   </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3 border border-slate-100">
                   <Info className="w-4 h-4 text-slate-400" />
                   <p className="text-[10px] font-bold text-slate-500">Contact the courier or use their website with your tracking number for real-time updates.</p>
                </div>
                <button 
                  onClick={() => window.open(`https://google.com/search?q=${order.shippingProvider}+tracking+${order.trackingNumber}`, '_blank')}
                  className="w-full h-12 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Track on Courier Site
                </button>
             </div>
           ) : isSeller ? (
             <div className="space-y-4 pt-2">
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 mb-2">
                   <p className="text-[10px] font-bold text-indigo-700 leading-relaxed">Provide tracking info to update the status to Delivered and alert the buyer.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <input 
                    type="text" 
                    placeholder="Courier Service (e.g. GIG Logistics)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    value={shippingProvider}
                    onChange={(e) => setShippingProvider(e.target.value)}
                  />
                  <input 
                    type="text" 
                    placeholder="Tracking Number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleUpdateShipping}
                  disabled={updating || !shippingProvider || !trackingNumber}
                  className="w-full h-14 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95 transition-all"
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Update Shipping"}
                </button>
             </div>
           ) : (
             <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waiting for seller to ship...</p>
             </div>
           )}
        </section>
      )}

      {/* Buyer Actions */}
      {isBuyer && (order.escrowStatus === 'HELD_IN_ESCROW' || order.escrowStatus === 'DELIVERED') && (
        <section className="space-y-4 pt-4">
           {order.escrowStatus === 'DELIVERED' && (
             <div className="bg-green-50 p-6 rounded-[2.5rem] border border-green-100 flex items-center gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                <div className="space-y-1">
                   <h4 className="font-black text-sm text-green-900 tracking-tight">Confirm Receipt</h4>
                   <p className="text-[10px] font-medium text-green-700 leading-relaxed">Only click this if you have received the item and are satisfied with its condition. This releases funds to the seller.</p>
                </div>
             </div>
           )}
           
           <div className="flex gap-3">
              {order.escrowStatus === 'DELIVERED' && (
                <button 
                  onClick={() => handleUpdateStatus('RELEASED')}
                  disabled={updating}
                  className="flex-[2] h-16 bg-green-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-green-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {updating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Confirm & Release</>}
                </button>
              )}
              <button 
                onClick={() => handleUpdateStatus('DISPUTED')}
                disabled={updating}
                className={cn(
                  "h-16 bg-white border rounded-[1.5rem] font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2",
                  order.escrowStatus === 'DELIVERED' ? "flex-1 border-red-200 text-red-600 shadow-xl shadow-red-50/50" : "w-full border-slate-200 text-slate-500 shadow-sm"
                )}
              >
                {updating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><AlertTriangle className="w-4 h-4" /> {order.escrowStatus === 'DELIVERED' ? 'Dispute' : 'Dispute Item'}</>}
              </button>
           </div>
        </section>
      )}

      {/* Review Section */}
      {isBuyer && order.escrowStatus === 'RELEASED' && !reviewSubmitted && (
        <section className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl space-y-6 animate-in zoom-in duration-500">
           <div className="space-y-1 text-center">
              <h3 className="text-xl font-black tracking-tight">Review your Experience</h3>
              <p className="text-xs font-bold text-indigo-100">Rate the seller to help other buyers.</p>
           </div>
           
           <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  onClick={() => setRating(star)}
                  className="p-1 active:scale-90 transition-transform"
                >
                  <Star className={cn("w-8 h-8", rating >= star ? "fill-white text-white" : "text-indigo-400")} />
                </button>
              ))}
           </div>

           <textarea 
             value={comment}
             onChange={(e) => setComment(e.target.value)}
             placeholder="Tell us about the product and delivery..."
             className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-sm font-medium placeholder:text-indigo-200 outline-none focus:ring-2 focus:ring-white/30 h-32"
           />

           <button 
             onClick={handleSubmitReview}
             disabled={updating || !comment}
             className="w-full py-5 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
           >
             {updating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Submit Review"}
           </button>
        </section>
      )}

      {reviewSubmitted && (
        <div className="bg-green-50 p-8 rounded-[2.5rem] border border-green-100 text-center space-y-2">
           <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
           <h3 className="text-lg font-black text-green-900">Review Submitted</h3>
           <p className="text-xs font-medium text-green-600">Thank you for your feedback!</p>
        </div>
      )}

      {/* Dispute Section if already disputed */}
      {order.escrowStatus === 'DISPUTED' && (
        <div className="bg-red-50 border border-red-100 p-8 rounded-[2.5rem] space-y-4 text-center shadow-xl shadow-red-50">
           <AlertTriangle className="w-12 h-12 text-red-600 mx-auto" />
           <div className="space-y-1">
              <h3 className="text-xl font-black text-red-900 tracking-tighter">Under Dispute</h3>
              <p className="text-xs font-medium text-red-700 leading-relaxed max-w-[250px] mx-auto">
                 An agent is investigating this transaction. You will be contacted via chat shortly.
              </p>
           </div>
           <Link 
             to={`/chat/room_${order.listingId}_${order.buyerId}`}
             className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200"
           >
              Open Support Chat
           </Link>
        </div>
      )}
    </div>
  );
}
