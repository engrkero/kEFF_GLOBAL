import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search as SearchIcon, Filter, X, ChevronDown, Smartphone, MapPin, Tag, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, Query, DocumentData } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

interface Listing {
  id: string;
  title: string;
  price: number;
  condition: string;
  images: string[];
  location: string;
  brand: string;
  model: string;
  specs?: {
    Storage?: string;
    RAM?: string;
    Color?: string;
  };
}

const BRANDS = ['Apple', 'Samsung', 'Google', 'Xiaomi', 'OnePlus', 'Huawei', 'Infinix', 'Tecno'];
const CONDITIONS = ['New', 'Mint', 'Good', 'Fair', 'Cracked'];
const STORAGE_OPTIONS = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'];
const RAM_OPTIONS = ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB', '24GB'];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [brand, setBrand] = useState(searchParams.get('brand') || '');
  const [condition, setCondition] = useState(searchParams.get('condition') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [storage, setStorage] = useState(searchParams.get('storage') || '');
  const [ram, setRam] = useState(searchParams.get('ram') || '');

  const fetchResults = async () => {
    setLoading(true);
    const path = 'listings';
    try {
      let q: Query<DocumentData> = collection(db, path);

      if (brand) q = query(q, where('brand', '==', brand));
      if (condition) q = query(q, where('condition', '==', condition));
      
      // Inequality constraints in Firestore are tricky if combined.
      // We will handle most filtering client-side for this prototype to ensure flexibility.
      
      q = query(q, orderBy('createdAt', 'desc'), limit(100));
      
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));

      // Client-side filtering for complex queries
      if (keyword) {
        data = data.filter(item => 
          item.title.toLowerCase().includes(keyword.toLowerCase()) ||
          item.brand.toLowerCase().includes(keyword.toLowerCase()) ||
          item.model.toLowerCase().includes(keyword.toLowerCase())
        );
      }

      if (minPrice) data = data.filter(item => item.price >= parseInt(minPrice) * 100);
      if (maxPrice) data = data.filter(item => item.price <= parseInt(maxPrice) * 100);
      if (storage) data = data.filter(item => (item.specs?.Storage === storage) || (item.model.includes(storage)));
      if (ram) data = data.filter(item => item.specs?.RAM === ram);

      setListings(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [searchParams]);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params: any = {};
    if (keyword) params.q = keyword;
    if (brand) params.brand = brand;
    if (condition) params.condition = condition;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (storage) params.storage = storage;
    if (ram) params.ram = ram;
    setSearchParams(params);
  };

  const clearFilters = () => {
    setKeyword('');
    setBrand('');
    setCondition('');
    setMinPrice('');
    setMaxPrice('');
    setStorage('');
    setRam('');
    setSearchParams({});
  };

  return (
    <div className="space-y-6 pb-24 h-screen flex flex-col -mx-4">
      {/* Sticky Search Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 sticky top-0 z-50">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search devices & accessories..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-2xl pl-11 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"
            />
          </div>
          <button 
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-2xl border transition-all ${showFilters ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            <Filter className="w-5 h-5" />
          </button>
        </form>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden no-scrollbar"
            >
              <div className="pt-4 space-y-4 max-h-[60vh] overflow-y-auto pb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Brand</label>
                    <div className="relative">
                      <select 
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">All Brands</option>
                        {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Condition</label>
                    <div className="relative">
                      <select 
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">Any Condition</option>
                        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Storage</label>
                    <div className="relative">
                      <select 
                        value={storage}
                        onChange={(e) => setStorage(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">Any Storage</option>
                        {STORAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">RAM</label>
                    <div className="relative">
                      <select 
                        value={ram}
                        onChange={(e) => setRam(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">Any RAM</option>
                        {RAM_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Min Price (₦)</label>
                    <input 
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Max Price (₦)</label>
                    <input 
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={clearFilters}
                    className="flex-1 py-3 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100"
                  >
                    Clear All
                  </button>
                  <button 
                    onClick={() => { handleSearch(); setShowFilters(false); }}
                    className="flex-[2] py-3 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 shadow-lg shadow-indigo-100"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Scanning Marketplace...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center">
              <Smartphone className="w-10 h-10 text-slate-300" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-slate-900">No results found</p>
              <p className="text-xs text-slate-500">Try adjusting your filters or search keywords.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{listings.length} Results Found</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((item) => (
                <Link 
                  key={item.id} 
                  to={`/product/${item.id}`}
                  className="bg-white rounded-[2rem] border border-slate-100 p-3 flex gap-4 shadow-sm hover:shadow-indigo-50 hover:shadow-xl transition-all group"
                >
                  <div className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                    <img 
                      src={item.images[0]} 
                      alt={item.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-tighter">
                          {item.brand}
                       </span>
                       <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100 uppercase tracking-tighter">
                          {item.condition}
                       </span>
                    </div>
                    <h3 className="font-black text-slate-800 tracking-tight leading-tight truncate">{item.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                      <MapPin className="w-3 h-3" />
                      <p className="text-[10px] font-bold truncate">{item.location}</p>
                    </div>
                    <p className="text-indigo-600 font-black text-lg tracking-tighter mt-1">₦{(item.price / 100).toLocaleString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
