import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Shield, ChevronLeft, Loader2, Save, LogOut, Camera, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { NIGERIA_STATES } from '../constants/nigeria';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [location, setLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [lga, setLga] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [bankDetails, setBankDetails] = useState({
    accountName: '',
    accountNumber: '',
    bankName: ''
  });
  
  // New states
  const [notifs, setNotifs] = useState({
    messages: true,
    orderUpdates: true,
    promotions: false
  });
  const [twoFactor, setTwoFactor] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('UNVERIFIED');
  const [verificationDocs, setVerificationDocs] = useState<string[]>([]);
  const [bvn, setBvn] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const publicSnap = await getDoc(doc(db, 'users', user.uid, 'public', 'profile'));
        if (publicSnap.exists()) {
          const data = publicSnap.data();
          setDisplayName(data.displayName || '');
          setAvatarUrl(data.avatarUrl || '');
          setLocation(data.location || '');
          setVerificationStatus(data.verificationStatus || 'UNVERIFIED');
          setVerificationDocs(data.verificationDocs || []);
        }

        const privateSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'data'));
        if (privateSnap.exists()) {
          const data = privateSnap.data();
          setPhoneNumber(data.phoneNumber || '');
          setAddress(data.address || '');
          setLga(data.lga || '');
          setState(data.state || '');
          setZipCode(data.zipCode || '');
          setBankDetails(data.bankDetails || { accountName: '', accountNumber: '', bankName: '' });
          setNotifs(data.notificationPrefs || { messages: true, orderUpdates: true, promotions: false });
          setTwoFactor(data.twoFactorEnabled || false);
          setBvn(data.bvn || '');
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (overrides?: any) => {
    if (!user) return;
    setSaving(true);
    try {
      const vStatus = overrides?.verificationStatus ?? verificationStatus;
      
      // Update Public Profile
      await setDoc(doc(db, 'users', user.uid, 'public', 'profile'), {
        displayName,
        avatarUrl,
        location,
        verificationStatus: vStatus,
        verificationDocs,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update Private Data
      await setDoc(doc(db, 'users', user.uid, 'private', 'data'), {
        phoneNumber,
        address,
        lga,
        state,
        zipCode,
        bankDetails,
        notificationPrefs: notifs,
        twoFactorEnabled: twoFactor,
        bvn,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert("Profile updated successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newDocs = [...verificationDocs];
        newDocs[index] = reader.result as string;
        setVerificationDocs(newDocs);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      // In a real app, delete all subcollections first
      // For this prototype, we'll mark the user as deleted and logout
      await updateDoc(doc(db, 'users', user.uid, 'public', 'profile'), {
        displayName: '[Deleted User]',
        avatarUrl: '',
        location: '',
        isDeleted: true,
        updatedAt: serverTimestamp()
      });
      
      alert("Account data cleared. You will now be logged out.");
      logout();
      navigate('/');
    } catch (error) {
      console.error(error);
      alert("Failed to delete account data.");
    } finally {
      setShowDeleteModal(false);
    }
  };

  if (!user) return null;
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Account...</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-32 relative">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">Account<br/>Settings</h1>
        </div>
        <button 
          onClick={() => { logout(); navigate('/'); }}
          className="p-4 bg-red-50 text-red-500 rounded-2xl active:scale-95 transition-all"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-[2rem] bg-indigo-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
                 {avatarUrl ? (
                   <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                   <User className="w-10 h-10 text-indigo-200" />
                 )}
              </div>
              <label className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-90 transition-transform cursor-pointer">
                <Camera className="w-4 h-4" />
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Personal Identifier</p>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
              />
            </div>
          </div>
        </section>

        {/* Verification Section */}
        <section className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
           <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-indigo-300" />
                    <h3 className="text-xs font-black uppercase tracking-widest">Seller Verification</h3>
                 </div>
                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                   verificationStatus === 'VERIFIED' ? 'bg-green-400 text-green-900' : 'bg-indigo-400 text-indigo-900'
                 }`}>
                   {verificationStatus}
                 </span>
              </div>
              
              {verificationStatus === 'UNVERIFIED' && (
                <div className="space-y-4">
                  <p className="text-xs font-medium text-indigo-100 leading-relaxed max-w-[280px]">
                    To list high-value items, you must verify your identity. Provide your BVN and upload verification documents.
                  </p>

                  <div className="space-y-2">
                      <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest pl-1">Bank Verification Number (BVN)</p>
                      <div className="relative">
                         <input 
                           type="password" 
                           value={bvn}
                           onChange={(e) => setBvn(e.target.value)}
                           placeholder="11-digit BVN"
                           maxLength={11}
                           className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm font-black text-white placeholder:text-indigo-300 outline-none focus:ring-2 focus:ring-white/30"
                         />
                         {bvn.length === 11 && (
                           <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                           </div>
                         )}
                      </div>
                  </div>
                  <div className="flex gap-2">
                    <label className={cn(
                      "flex-1 border rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all",
                      verificationDocs[0] ? "bg-green-500/20 border-green-400" : "bg-white/10 border-white/20 hover:bg-white/20"
                    )}>
                      <Camera className={cn("w-4 h-4", verificationDocs[0] ? "text-green-300" : "text-indigo-200")} />
                      <span className="text-[8px] font-black uppercase text-center">{verificationDocs[0] ? "ID Uploaded" : "ID Document"}</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDocUpload(e, 0)} />
                    </label>
                    <label className={cn(
                      "flex-1 border rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all",
                      verificationDocs[1] ? "bg-green-500/20 border-green-400" : "bg-white/10 border-white/20 hover:bg-white/20"
                    )}>
                      <Camera className={cn("w-4 h-4", verificationDocs[1] ? "text-green-300" : "text-indigo-200")} />
                      <span className="text-[8px] font-black uppercase text-center">{verificationDocs[1] ? "Address Uploaded" : "Address Proof"}</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDocUpload(e, 1)} />
                    </label>
                  </div>
                  <button 
                    onClick={() => {
                      setVerificationStatus('PENDING');
                      handleSave({ verificationStatus: 'PENDING' });
                    }}
                    className="w-full bg-white text-indigo-600 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-indigo-900/20"
                  >
                    Submit for Review
                  </button>
                </div>
              )}

              {verificationStatus === 'PENDING' && (
                <div className="p-4 bg-white/10 rounded-2xl border border-white/20">
                   <p className="text-xs font-bold text-center">Your documents are under review. We'll notify you within 24-48 hours.</p>
                </div>
              )}
           </div>
           <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-50" />
        </section>

        {/* Security Section (2FA) */}
        <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sleek space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <Shield className="w-5 h-5 text-indigo-600" />
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Security</h3>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-800">Two-Factor Authentication</p>
              <p className="text-[10px] font-bold text-slate-400">Add an extra layer of security to your account.</p>
            </div>
            <button 
              onClick={() => setTwoFactor(!twoFactor)}
              className={`w-12 h-6 rounded-full transition-all relative ${twoFactor ? 'bg-indigo-600' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${twoFactor ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sleek space-y-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Notification Preferences</h3>
          <div className="space-y-4">
             {Object.entries(notifs).map(([key, val]) => (
               <div key={key} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <p className="text-sm font-black text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <button 
                    onClick={() => setNotifs(prev => ({...prev, [key]: !val}))}
                    className={`w-10 h-5 rounded-full transition-all relative ${val ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${val ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
               </div>
             ))}
          </div>
        </section>

        {/* Address Section */}
        <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sleek space-y-6">
          <div className="flex items-center gap-3">
             <MapPin className="w-5 h-5 text-indigo-600" />
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Billing & Shipping</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">Phone Number</p>
              <input 
                type="tel" 
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+234..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">Street Address</p>
              <input 
                type="text" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Example St"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">State</p>
                  <select 
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setLga('');
                      setLocation(`${address ? address + ', ' : ''}${e.target.value}`);
                    }}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  >
                    <option value="">Select State</option>
                    {NIGERIA_STATES.map(s => <option key={s.state} value={s.state}>{s.state}</option>)}
                  </select>
               </div>
               <div className="space-y-1.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">LGA</p>
                  <select 
                    value={lga}
                    onChange={(e) => {
                      setLga(e.target.value);
                      setLocation(`${e.target.value}, ${state}`);
                    }}
                    disabled={!state}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none disabled:opacity-50"
                  >
                    <option value="">Select LGA</option>
                    {state && NIGERIA_STATES.find(s => s.state === state)?.lgas.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
               </div>
            </div>
            <div className="space-y-1.5">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">Zip / Postal Code</p>
               <input 
                 type="text" 
                 value={zipCode}
                 onChange={(e) => setZipCode(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
               />
            </div>
          </div>
        </section>

        {/* Payout Details Section */}
        <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sleek space-y-6">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-indigo-600" />
             </div>
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest text-left">Payout Information</h3>
          </div>

          <div className="space-y-4">
             <div className="space-y-1.5 text-left">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">Bank Name</p>
                <input 
                  type="text" 
                  value={bankDetails.bankName}
                  onChange={(e) => setBankDetails({...bankDetails, bankName: e.target.value})}
                  placeholder="Access Bank, Kuda, etc."
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 text-left">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">Account Number</p>
                    <input 
                      type="text" 
                      value={bankDetails.accountNumber}
                      onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                      placeholder="0123456789"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                    />
                </div>
                <div className="space-y-1.5 text-left">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">Name on Account</p>
                    <input 
                      type="text" 
                      value={bankDetails.accountName}
                      onChange={(e) => setBankDetails({...bankDetails, accountName: e.target.value})}
                      placeholder="John Doe"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                    />
                </div>
             </div>
          </div>
        </section>

        <div className="space-y-4">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full h-18 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Changes
          </button>
          
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="w-full h-18 bg-red-50 text-red-500 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] active:scale-95 transition-all"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 text-center shadow-2xl">
              <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto">
                 <LogOut className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                 <h2 className="text-2xl font-black text-slate-800 tracking-tight">Are you sure?</h2>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed">This will permanently delete your account and all active listings. This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 pt-2">
                 <button 
                   onClick={() => setShowDeleteModal(false)}
                   className="flex-1 h-16 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={handleDeleteAccount}
                   className="flex-1 h-16 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-red-200"
                 >
                   Delete
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
