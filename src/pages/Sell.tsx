import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Camera, Smartphone, MapPin, Tag, ChevronLeft, Loader2, Plus, X, ShieldCheck, Edit, PlusCircle, Package } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { NIGERIA_STATES } from '../constants/nigeria';

const BRANDS = ['Apple', 'Samsung', 'Google', 'Xiaomi', 'OnePlus', 'Other'];
const CONDITIONS = ['New', 'Mint', 'Good', 'Fair', 'Cracked'];

export default function Sell() {
  const { user } = useAuth();
  const { editId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [step, setStep] = useState(0); // 0 for selection screen
  const [myListings, setMyListings] = useState<any[]>([]);

  // Form State
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedLga, setSelectedLga] = useState('');
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState<Record<string, string>>({
    Storage: '',
    RAM: '',
    Color: ''
  });

  useEffect(() => {
    if (editId) {
      setStep(1);
    }
  }, [editId]);

  useEffect(() => {
    if (!user) return;
    const fetchMyListings = async () => {
      try {
        const q = query(
          collection(db, 'listings'),
          where('sellerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setMyListings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
    };
    fetchMyListings();
  }, [user]);

  useEffect(() => {
    if (!editId) return;
    const fetchListing = async () => {
      setFetching(true);
      try {
        const docSnap = await getDoc(doc(db, 'listings', editId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.sellerId !== user?.uid) {
            navigate('/');
            return;
          }
          setBrand(data.brand || '');
          setModel(data.model || '');
          setPrice((data.price / 100).toString());
          setCondition(data.condition || '');
          setDescription(data.description || '');
          setSpecs(data.specs || { Storage: '', RAM: '', Color: '' });
          setImages(data.images || []);
          
          if (data.location) {
            const [lga, state] = data.location.split(', ');
            setSelectedState(state);
            setSelectedLga(lga);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setFetching(false);
      }
    };
    fetchListing();
  }, [editId, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && images.length < 5) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6); // 60% quality
          setImages(prev => [...prev, compressedBase64]);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const location = `${selectedLga}, ${selectedState}`;
      const listingData = {
        title: `${brand} ${model}${specs.Storage ? ` - ${specs.Storage}` : ''}`,
        brand,
        model,
        price: parseInt(price) * 100, // to kobo
        condition,
        location,
        description,
        images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=600'],
        specs,
        updatedAt: serverTimestamp()
      };

      if (editId) {
        // Ensure we are not sending undefined fields
        const cleanData = Object.fromEntries(
          Object.entries(listingData).filter(([_, v]) => v !== undefined)
        );
        await updateDoc(doc(db, 'listings', editId), cleanData);
        alert("Listing updated successfully!");
        navigate(`/product/${editId}`);
      } else {
        const newListing = {
          ...listingData,
          sellerId: user.uid,
          sellerName: user.displayName || 'Seller',
          status: 'Active',
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'listings'), newListing);
        alert("Listing published successfully!");
        navigate(`/product/${docRef.id}`);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to save listing. Please check your internet connection and try again.");
      handleFirestoreError(error, OperationType.WRITE, 'listings');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-4">
         <div className="w-20 h-20 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-200">
            <ShieldCheck className="w-10 h-10" />
         </div>
         <h2 className="text-xl font-black text-slate-800 tracking-tighter">Sign in to Sell</h2>
         <p className="text-sm text-slate-500 font-medium">You need an account to list items on KUFF Marketplace.</p>
         <button onClick={() => navigate('/')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest">Return Home</button>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-32">
      {/* Header */}
      <div className="flex justify-between items-center">
         <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                if (editId) navigate(-1);
                else if (step > 0) setStep(0);
                else navigate(-1);
              }} 
              className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-all"
            >
               <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
              {editId ? 'Edit Your' : step === 0 ? 'Marketplace' : 'List Your'}<br/>
              {step === 0 ? 'Store' : 'Device'}
            </h1>
         </div>
      </div>

      {fetching ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          {step === 0 && (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="space-y-8"
            >
               <div className="grid grid-cols-1 gap-6 max-w-lg mx-auto w-full">
                  <button 
                    onClick={() => setStep(1)}
                    className="group bg-indigo-600 p-10 rounded-[3rem] flex flex-col items-center gap-6 text-white shadow-2xl shadow-indigo-200 active:scale-95 transition-all w-full"
                  >
                     <div className="w-20 h-20 bg-white/20 rounded-[2rem] flex items-center justify-center backdrop-blur-sm border border-white/10">
                        <PlusCircle className="w-10 h-10" />
                     </div>
                     <div className="text-center">
                        <h3 className="font-black text-2xl tracking-tight uppercase">Add Product</h3>
                        <p className="text-indigo-100/60 text-xs font-bold uppercase tracking-widest mt-2">New Device Listing</p>
                     </div>
                  </button>

                  <div className="space-y-6">
                     <div className="flex justify-between items-end px-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Your Inventory</h4>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none bg-indigo-50 px-2.5 py-1 rounded-full">{myListings.length} Total</span>
                     </div>
                     
                     {myListings.length === 0 ? (
                        <div className="bg-slate-50 p-12 rounded-[3.5rem] text-center border border-dashed border-slate-200">
                           <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                           <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No listings available</p>
                        </div>
                     ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 px-1">
                           {myListings.map(item => (
                              <button 
                                key={item.id}
                                onClick={() => navigate(`/edit/${item.id}`)}
                                className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-4 active:scale-95 transition-all text-left group hover:shadow-xl hover:shadow-slate-100 transition-all duration-500"
                              >
                                 <div className="aspect-[4/5] overflow-hidden rounded-[2rem] bg-slate-50 relative border border-slate-50 shadow-inner">
                                    <img src={item.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                                    <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors duration-500" />
                                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                                       <Edit className="w-3 h-3 text-indigo-600" />
                                    </div>
                                 </div>
                                 <div className="px-1 space-y-1">
                                    <p className="text-[11px] font-black text-slate-800 truncate leading-tight">{item.title}</p>
                                    <p className="text-indigo-600 font-black text-sm leading-none">₦{(item.price/100).toLocaleString()}</p>
                                 </div>
                              </button>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
            </motion.div>
          )}

          {/* Steps Indicator */}
          {step > 0 && (
            <div className="flex gap-2">
               {[1, 2, 3].map(i => (
                 <div key={i} className={cn(
                   "h-1.5 rounded-full transition-all duration-500",
                   i === step ? "flex-[2] bg-indigo-600" : i < step ? "flex-1 bg-green-500" : "flex-1 bg-slate-200"
                 )} />
               ))}
            </div>
          )}

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
             <section className="space-y-4">
                <div className="flex justify-between items-end">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Device Images (Max 5)</h3>
                   <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{images.length}/5</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 h-32 no-scrollbar">
                   <label 
                     className="w-28 h-28 shrink-0 bg-slate-100 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 active:scale-95 transition-all cursor-pointer hover:bg-slate-200"
                   >
                      <Camera className="w-6 h-6" />
                      <span className="text-[9px] font-black uppercase">Add Image</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                   </label>
                   {images.map((img, i) => (
                     <div key={i} className="w-28 h-28 shrink-0 rounded-[2rem] bg-indigo-50 relative group">
                        <img src={img} className="w-full h-full object-cover rounded-[2rem]" />
                        <button 
                          onClick={() => removeImage(i)}
                          className="absolute -top-1 -right-1 p-1.5 bg-red-500 text-white rounded-full shadow-lg"
                        >
                           <X className="w-3 h-3" />
                        </button>
                     </div>
                   ))}
                </div>
             </section>

             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Brand</label>
                      <select 
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                      >
                         <option value="">Select Brand</option>
                         {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Model</label>
                      <input 
                        type="text"
                        placeholder="e.g. S24 Ultra"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                      />
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Asking Price (₦)</label>
                   <div className="relative">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black">₦</div>
                      <input 
                        type="number"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-white border border-slate-100 rounded-2xl pl-10 pr-4 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                      />
                   </div>
                </div>
             </div>

             <button 
               onClick={() => setStep(2)}
               disabled={!brand || !model || !price}
               className="w-full h-16 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all disabled:opacity-50"
             >
                Continue Details
             </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
             <div className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Condition</label>
                   <div className="grid grid-cols-3 gap-2">
                      {CONDITIONS.map(c => (
                        <button 
                          key={c}
                          onClick={() => setCondition(c)}
                          className={cn(
                            "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                            condition === c ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white border-slate-100 text-slate-400"
                          )}
                        >
                           {c}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">State</label>
                      <select 
                        value={selectedState}
                        onChange={(e) => {
                          setSelectedState(e.target.value);
                          setSelectedLga('');
                        }}
                        className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                      >
                         <option value="">Select State</option>
                         {NIGERIA_STATES.map(s => <option key={s.state} value={s.state}>{s.state}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">LGA</label>
                      <select 
                        value={selectedLga}
                        onChange={(e) => setSelectedLga(e.target.value)}
                        disabled={!selectedState}
                        className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all disabled:opacity-50"
                      >
                         <option value="">Select LGA</option>
                         {selectedState && NIGERIA_STATES.find(s => s.state === selectedState)?.lgas.map(lga => (
                           <option key={lga} value={lga}>{lga}</option>
                         ))}
                      </select>
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Device Specifications</label>
                   <div className="grid grid-cols-2 gap-3">
                      {['Storage', 'RAM', 'Color'].map(key => (
                         <div key={key} className="space-y-1.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">{key}</p>
                            <input 
                              type="text"
                              placeholder={key === 'Storage' ? 'e.g. 256GB' : key === 'RAM' ? 'e.g. 8GB' : 'e.g. Titanium'}
                              value={specs[key] || ''}
                              onChange={(e) => setSpecs({...specs, [key]: e.target.value})}
                              className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                            />
                         </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="flex gap-3">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 h-16 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                >
                   Back
                </button>
                <button 
                  onClick={() => setStep(3)}
                  disabled={!condition || !selectedState || !selectedLga}
                  className="flex-[2] h-16 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50"
                >
                   Final Review
                </button>
             </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
             <div className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Last thing: Description</label>
                   <textarea 
                     rows={5}
                     placeholder="Tell buyers about usage history, any scratches, battery health..."
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     className="w-full bg-white border border-slate-100 rounded-3xl p-5 text-sm font-medium focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                   />
                </div>

                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2.5rem] flex gap-4">
                   <div className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-6 h-6 text-indigo-600" />
                   </div>
                   <div className="space-y-1">
                      <h4 className="font-black text-sm text-indigo-900 leading-tight">Escrow Guarantee</h4>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider leading-relaxed">
                         Funds will be held securely. KUFF deducts a 5% handling fee on successful delivery.
                      </p>
                   </div>
                </div>
             </div>

             <div className="flex gap-3">
                <button 
                  onClick={() => setStep(2)}
                  className="flex-1 h-16 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                >
                   Edit
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={loading || !description}
                  className="flex-[2] h-16 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                   {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : editId ? "UPDATE LISTING" : "PUBLISH LISTING"}
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )}
</div>
);
}
