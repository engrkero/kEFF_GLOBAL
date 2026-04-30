import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Share2, Heart, Shield, MessageCircle, ShoppingBag, Loader2, Maximize2, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';

interface Listing {
  id: string;
  title: string;
  price: number;
  condition: string;
  description: string;
  specs: Record<string, string>;
  images: string[];
  sellerId: string;
  location: string;
  sellerName?: string;
}

export default function ProductDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);

  const [isUserSeller, setIsUserSeller] = useState(false);

  useEffect(() => {
    const checkSellerStatus = async () => {
      if (!user) return;
      const profileSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'data'));
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        setIsUserSeller(!!(data.bankDetails?.accountNumber));
      }
    };
    checkSellerStatus();
  }, [user]);

  // Auto-play carousel
  useEffect(() => {
    if (!product || product.images.length <= 1) return;
    const interval = setInterval(() => {
      setActiveImageIndex(prev => (prev + 1) % product.images.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [product]);

  const openZoom = (index: number) => {
    setZoomIndex(index);
    setShowZoom(true);
  };

  const nextZoom = () => setZoomIndex(prev => (prev + 1) % (product?.images.length || 1));
  const prevZoom = () => setZoomIndex(prev => (prev - 1 + (product?.images.length || 1)) % (product?.images.length || 1));

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    
    // Use onSnapshot for real-time updates and to fix potential new listing race conditions
    const unsubscribe = onSnapshot(doc(db, 'listings', id), async (docSnap) => {
      if (docSnap.exists()) {
        const prodData = { id: docSnap.id, ...docSnap.data() } as Listing;
        setProduct(prodData);
        
        // Check if favorited (only once or when user changes)
        if (user) {
          const favSnap = await getDoc(doc(db, 'users', user.uid, 'favorites', id));
          setIsFavorited(favSnap.exists());
        }
      } else {
        setProduct(null);
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'listings');
    });

    return () => unsubscribe();
  }, [id, user]);

  const toggleFavorite = async () => {
    if (!user || !product) return;
    const favRef = doc(db, 'users', user.uid, 'favorites', product.id);
    try {
      if (isFavorited) {
        await deleteDoc(favRef);
        setIsFavorited(false);
      } else {
        await setDoc(favRef, {
          userId: user.uid,
          listingId: product.id,
          createdAt: serverTimestamp()
        });
        setIsFavorited(true);
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!product) {
    return <div className="p-10 text-center font-bold text-slate-400">Product not found</div>;
  }

  const isOwner = user?.uid === product.sellerId;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-32 overflow-x-hidden">
      {/* Header Actions */}
      <div className="flex justify-between items-center -mx-2 px-2 sticky top-20 z-40 py-2">
        <button onClick={() => navigate(-1)} className="p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 active:scale-90 transition-all">
          <ChevronLeft className="w-5 h-5 text-slate-800" />
        </button>
        <div className="flex gap-3">
          <button className="p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 active:scale-90 transition-all">
            <Share2 className="w-5 h-5 text-slate-600" />
          </button>
          {!isOwner && (
            <button 
              onClick={toggleFavorite}
              className={cn(
                "p-3 rounded-2xl shadow-xl shadow-slate-200/50 active:scale-90 transition-all",
                isFavorited ? "bg-red-500 text-white" : "bg-white/90 backdrop-blur-md text-slate-600"
              )}
            >
              <Heart className={cn("w-5 h-5", isFavorited && "fill-white")} />
            </button>
          )}
        </div>
      </div>

      {/* ... (image gallery remains same) ... */}

      {/* Image Gallery carousel */}
      <div className="space-y-4 -mx-4 -mt-24 sm:mt-0 sm:mx-0">
        <div className="aspect-square sm:aspect-[4/3] overflow-hidden bg-slate-100 relative shadow-inner group rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl shadow-slate-200/50">
          <AnimatePresence mode="wait">
            <motion.img 
              key={activeImageIndex}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100) {
                  setActiveImageIndex(prev => (prev > 0 ? prev - 1 : product.images.length - 1));
                } else if (info.offset.x < -100) {
                  setActiveImageIndex(prev => (prev < product.images.length - 1 ? prev + 1 : 0));
                }
              }}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              src={product.images[activeImageIndex]} 
              alt={product.title} 
              className="w-full h-full object-cover touch-none"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
          
          <button 
            onClick={() => openZoom(activeImageIndex)}
            className="absolute top-28 right-8 p-3 bg-white/20 backdrop-blur-lg rounded-2xl text-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
          >
             <Maximize2 className="w-5 h-5" />
          </button>
          
          {/* Indicators */}
          {product.images.length > 1 && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {product.images.map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i === activeImageIndex ? 'bg-indigo-600 w-6 shadow-lg shadow-indigo-200' : 'bg-white/50 backdrop-blur-sm'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail Strip */}
        {product.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
             {product.images.map((img, i) => (
               <button 
                key={i}
                onClick={() => setActiveImageIndex(i)}
                className={cn(
                  "w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all",
                  i === activeImageIndex ? "border-indigo-600 scale-105 shadow-lg" : "border-transparent opacity-60"
                )}
               >
                 <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
               </button>
             ))}
          </div>
        )}
      </div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {showZoom && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 touch-none"
          >
            <div className="absolute top-10 left-0 right-0 px-8 flex justify-between items-center z-10">
               <div className="text-white">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Zoom View</p>
                  <p className="text-xs font-black uppercase tracking-tighter">{zoomIndex + 1} / {product.images.length}</p>
               </div>
               <button 
                onClick={() => setShowZoom(false)}
                className="p-4 bg-white/10 text-white rounded-full backdrop-blur-md active:scale-90 transition-transform"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="relative w-full h-full flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.img 
                  key={zoomIndex}
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 1.1, x: -20 }}
                  src={product.images[zoomIndex]} 
                  className="max-w-full max-h-full object-contain shadow-2xl" 
                  alt="Zoomed"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 50) prevZoom();
                    else if (info.offset.x < -50) nextZoom();
                  }}
                />
              </AnimatePresence>
            </div>

            <div className="absolute bottom-12 flex gap-4 text-white">
              <button onClick={prevZoom} className="p-4 bg-white/5 rounded-2xl backdrop-blur-sm active:scale-95 transition-all">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={nextZoom} className="p-4 bg-white/5 rounded-2xl backdrop-blur-sm active:scale-95 transition-all">
                <ChevronLeft className="w-6 h-6 rotate-180" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <nav className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">Authenticated Item</nav>
            <h1 className="text-3xl font-black tracking-tighter leading-tight text-slate-900">{product.title}</h1>
            <p className="text-slate-400 text-xs font-medium flex items-center gap-1 mt-2">
              Seller: <Link to={`/profile/${product.sellerId}`} className="font-bold text-slate-900 underline decoration-indigo-200 hover:text-indigo-600 transition-colors">@{product.sellerName || 'verified_seller'}</Link> • {product.location}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between py-5 border-y border-slate-100">
          <div className="space-y-0.5">
            <p className="text-3xl font-black text-slate-900 tracking-tighter">₦{(product.price / 100).toLocaleString()}</p>
            <span className="inline-block bg-green-50 text-green-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter shadow-sm border border-green-100">
              {product.condition}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Escrow Status</p>
            <p className="text-xs font-black text-indigo-600 uppercase tracking-tighter">SECURE PAYMENT</p>
          </div>
        </div>

        {/* Specs Grid */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Specs</h3>
          <div className="grid grid-cols-2 gap-3">
            {product.specs && Object.entries(product.specs).map(([key, value]) => (
              <div key={key} className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm transition-all hover:border-indigo-100 hover:shadow-indigo-50 hover:shadow-lg">
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">{key}</p>
                <p className="font-bold text-slate-800 text-sm">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-400">Seller Description</h2>
          <p className="text-slate-600 text-sm leading-relaxed font-medium">
            {product.description || 'No description provided.'}
          </p>
        </div>

        {/* Escrow Guarantee Card */}
        <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-[2.5rem] flex gap-4 items-center">
          <div className="bg-white p-3 rounded-2xl shadow-lg shadow-indigo-100 shrink-0">
            <Shield className="w-6 h-6 text-indigo-600" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="font-black text-sm text-indigo-900 leading-tight">Escrow Protected</h3>
            <p className="text-indigo-500 text-[10px] font-bold uppercase tracking-wider mt-1">Funds held safe until delivery</p>
          </div>
        </div>
      </div>
      {/* Fixed Footer Buttons */}
      <div className="fixed bottom-24 left-4 right-4 z-50 flex gap-3 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {isOwner ? (
          <button 
            onClick={() => navigate(`/edit/${product.id}`)}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white h-16 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all text-center"
          >
            Manage My Listing
          </button>
        ) : (
          <>
            <button 
              onClick={() => {
                if (!user) { navigate('/login'); return; }
                navigate(`/chat/room_${product.id}_${user.uid}`);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-16 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all",
                product.condition === 'New' 
                  ? "bg-white border border-slate-200 text-slate-900" 
                  : "bg-white border border-amber-200 text-amber-600"
              )}
            >
              <MessageCircle className={cn("w-4 h-4", product.condition === 'New' ? "text-indigo-600" : "text-amber-500")} />
              {product.condition === 'New' ? 'Chat with Seller' : 'Negotiate'}
            </button>
            
            {/* Hide Offer for fellow sellers */}
            {!(product.condition !== 'New' && isUserSeller && product.sellerId !== 'system') && (
              <button 
                onClick={() => {
                  if (!user) { navigate('/login'); return; }
                  if (product.condition === 'New') {
                    navigate(`/checkout/${product.id}`);
                  } else {
                    navigate(`/chat/room_${product.id}_${user.uid}`, { 
                      state: { initialMessage: "Hello, I would like to make an offer on this item." } 
                    });
                  }
                }}
                className={cn(
                  "flex-[2] flex items-center justify-center gap-2 h-16 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all text-white",
                  product.condition === 'New' ? "bg-indigo-600 shadow-indigo-200" : "bg-amber-500 shadow-amber-200"
                )}
              >
                <ShoppingBag className="w-4 h-4" />
                {product.condition === 'New' ? 'Buy Now' : 'Make an Offer'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
