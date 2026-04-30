import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, ChevronLeft, CreditCard, Lock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

export default function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'checkout' | 'success'>('checkout');
  const [profileComplete, setProfileComplete] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user) return;
      try {
        setLoading(true);
        // 1. Fetch Product
        const docSnap = await getDoc(doc(db, 'listings', id));
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() });
        }

        // 2. Check Profile Completion
        const profileSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'data'));
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          const isComplete = !!(data.address && data.state && data.phoneNumber);
          setProfileComplete(isComplete);
        } else {
          setProfileComplete(false);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, user]);

  const handlePayment = async () => {
    if (!user || !product) return;

    if (!profileComplete) {
      alert("Please complete your delivery address in Profile Settings before proceeding.");
      navigate('/settings');
      return;
    }

    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      alert("Payment gateway not configured. Please contact support.");
      return;
    }

    setIsProcessing(true);

    // Dynamic Paystack Integration
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      alert("Payment gateway failed to load. Please refresh and try again.");
      setIsProcessing(false);
      return;
    }

    const paystack = new PaystackPop();
    paystack.newTransaction({
      key: publicKey,
      email: user.email || '',
      amount: product.price, // Already in kobo from Firestore
      currency: 'NGN',
      onSuccess: async (transaction: any) => {
        const path = 'orders';
        try {
          // Create Order in Firestore
          await addDoc(collection(db, path), {
            buyerId: user.uid,
            sellerId: product.sellerId,
            listingId: product.id,
            amount: product.price,
            escrowStatus: 'HELD_IN_ESCROW',
            paystackReference: transaction.reference,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          setStep('success');
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, path);
          alert("Payment successful but failed to record order. Please contact support with reference: " + transaction.reference);
        } finally {
          setIsProcessing(false);
        }
      },
      onCancel: () => {
        setIsProcessing(false);
      },
      onError: (err: any) => {
        console.error(err);
        setIsProcessing(false);
        alert("Payment window failed to load.");
      }
    });
  };

  if (!user) return <div className="p-10 text-center font-bold">Please login to continue checkout.</div>;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verifying Secure Channel...</p>
      </div>
    );
  }

  if (!product) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 px-10 text-center">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <h2 className="text-xl font-black text-slate-800">Product Not Found</h2>
      <p className="text-sm text-slate-500 font-medium">The listing you are looking for may have been sold or removed.</p>
      <button onClick={() => navigate(-1)} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest">Go Back</button>
    </div>
  );

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in zoom-in-95 duration-500 bg-white p-8 rounded-[3rem] shadow-sleek">
        <div className="w-24 h-24 bg-green-50 rounded-[2rem] flex items-center justify-center shadow-inner">
          <CheckCircle2 className="w-12 h-12 text-green-500" strokeWidth={3} />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">Payment Secured</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed max-w-[200px] mx-auto opacity-70">
            Escrow protection active
          </p>
          <p className="text-slate-500 text-sm font-medium max-w-[250px] mx-auto pt-2">
            Your funds are now held in Escrow. The seller has been notified to ship the item.
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-[2rem] w-full border border-slate-100 space-y-4 text-left">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</span>
            <span className="font-mono font-black text-indigo-600 text-sm">#KUFF-8231-MOD</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
            <span className="text-indigo-700 font-black text-[10px] uppercase bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Pending Shipping</span>
          </div>
        </div>
        <button 
          onClick={() => navigate('/orders')}
          className="bg-indigo-600 text-white px-10 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all"
        >
          View My Orders
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-90 transition-transform">
          <ChevronLeft className="w-5 h-5 text-slate-800" />
        </button>
        <h1 className="text-2xl font-black tracking-tighter text-slate-900">Checkout</h1>
      </div>

      {/* Order Summary */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sleek space-y-6">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Details</h2>
        <div className="flex gap-5">
          <div className="w-20 h-20 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 font-bold overflow-hidden shadow-inner border border-indigo-100">
             <CreditCard className="w-8 h-8 opacity-20" />
          </div>
          <div className="flex-1 flex flex-col justify-center gap-1">
            <h3 className="font-black text-slate-800 tracking-tight leading-none">{product.title}</h3>
            <div className="flex items-center gap-2">
              <span className="inline-block bg-slate-100 px-2.5 py-1 rounded-lg text-[9px] text-slate-500 font-black uppercase tracking-widest">
                {product.condition}
              </span>
            </div>
          </div>
          <div className="text-right flex flex-col justify-center">
            <p className="font-black text-slate-900">₦{(product.price / 100).toLocaleString()}</p>
          </div>
        </div>
        <div className="border-t border-slate-50 pt-6 flex justify-between items-center">
          <span className="font-black text-sm uppercase tracking-widest text-slate-400">Total Payout</span>
          <span className="text-3xl font-black text-indigo-600 tracking-tighter">₦{(product.price / 100).toLocaleString()}</span>
        </div>
      </div>

      {/* Escrow Banner */}
      <div className="bg-indigo-600 p-6 rounded-[2.5rem] flex gap-5 items-center shadow-xl shadow-indigo-100 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500 rounded-full blur-2xl opacity-50 translate-x-1/2 translate-y-1/2" />
        <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
          <Shield className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
        <div className="space-y-1 relative z-10">
          <h3 className="font-black text-sm text-white uppercase tracking-widest leading-none">KUFF Protected</h3>
          <p className="text-indigo-100 text-[11px] leading-relaxed font-medium">
            Funds held secure until you verify condition.
          </p>
        </div>
      </div>

      {/* Payment Method */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Payment Channel</h2>
        <button className="w-full bg-white p-5 rounded-[2rem] border-2 border-indigo-600 flex items-center justify-between shadow-lg shadow-indigo-50">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-50 p-2.5 rounded-xl">
              <CreditCard className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="text-left space-y-0.5">
              <p className="font-black text-sm text-slate-800 uppercase tracking-tight">Standard Checkout</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Card • Transfer • USSD</p>
            </div>
          </div>
          <div className="bg-indigo-600 w-6 h-6 rounded-full flex items-center justify-center shadow-sm shadow-indigo-200">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
        </button>
      </div>

      <div className="pt-6 space-y-4">
        <button 
          onClick={handlePayment}
          disabled={isProcessing}
          className={cn(
            "w-full h-16 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95",
            isProcessing ? "bg-slate-200 text-slate-400" : "bg-indigo-600 text-white shadow-2xl shadow-indigo-200"
          )}
        >
          {isProcessing ? "INITIALIZING SECURE GATEWAY..." : <><Lock className="w-4 h-4" /> SECURE ESCROW PAYMENT</>}
        </button>
        <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-[0.1em] max-w-[250px] mx-auto leading-relaxed">
          By continuing, you agree to KUFF Global's Elite Buyer Protection & Escrow Terms.
        </p>
      </div>
    </div>
  );
}
