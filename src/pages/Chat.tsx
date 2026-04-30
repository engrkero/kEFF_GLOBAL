import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Send, Image as ImageIcon, ChevronLeft, MoreVertical, MessageCircle, Loader2, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, setDoc, updateDoc, where, limit } from 'firebase/firestore';

interface Message {
  id?: string;
  senderId: string;
  text: string;
  createdAt: any;
  type?: 'TEXT' | 'OFFER' | 'SYSTEM' | 'PAY_REQUEST';
  offerAmount?: number;
  status?: 'SENT' | 'DELIVERED' | 'READ';
}

export default function Chat() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  useEffect(() => {
    if (location.state?.initialMessage) {
      setInputText(location.state.initialMessage);
    }
  }, [location.state]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showPayRequestModal, setShowPayRequestModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [product, setProduct] = useState<any>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [profileComplete, setProfileComplete] = useState(true);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherUserStatus, setOtherUserStatus] = useState<'online' | 'offline'>('offline');
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

    // Presence Tracking
    useEffect(() => {
      if (!user) return;
      const statusRef = doc(db, 'users', user.uid, 'status', 'presence');
      
      // Set online
      setDoc(statusRef, { 
        status: 'online', 
        lastChanged: serverTimestamp(),
        userId: user.uid // Redundancy for rules if needed
      }, { merge: true });

      // Keep tracking presence while tab is open
      const interval = setInterval(() => {
        setDoc(statusRef, { lastChanged: serverTimestamp() }, { merge: true });
      }, 60000); // Heartbeat every minute

      // Mark offline on unmount
      return () => {
        clearInterval(interval);
        setDoc(statusRef, { status: 'offline', lastChanged: serverTimestamp() }, { merge: true });
      };
    }, [user]);

  useEffect(() => {
    if (!roomId || !user) return;

    // Check if profile is complete
    const checkProfile = async () => {
      try {
        const profileSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'data'));
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          const isComplete = !!(data.address && data.state && data.phoneNumber);
          setProfileComplete(isComplete);
        } else {
          setProfileComplete(false);
        }
      } catch (e) {
        console.error("Profile check failed", e);
      }
    };
    checkProfile();

    // Ensure Chat Room exists
    const checkRoom = async () => {
      const roomRef = doc(db, 'chats', roomId);
      const roomSnap = await getDoc(roomRef);
      
      // Room ID contains listing ID: room_LISTINGID_BUYERID
      const parts = roomId.split('_');
      const listingId = parts[1];
      const buyerId = parts[2] || user.uid;
      
      // Fetch Product Info FIRST to know the seller
      const productSnap = await getDoc(doc(db, 'listings', listingId));
      if (productSnap.exists()) {
        const prodData = productSnap.data();
        setProduct({ id: listingId, ...prodData });
        setIsSeller(prodData.sellerId === user.uid);
        
        const sellerId = prodData.sellerId;
        
        // If room doesn't exist, create it with BOTH
        if (!roomSnap.exists()) {
          const participants = [buyerId, sellerId].filter((v, i, a) => v && a.indexOf(v) === i);
          
          await setDoc(roomRef, {
            participants: participants,
            listingId: listingId,
            buyerId: buyerId,
            sellerId: sellerId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: "Negotiation started"
          });
          
          // Set other user ID immediately for presence tracking
          const otherId = participants.find((id: string) => id !== user.uid);
          if (otherId) setOtherUserId(otherId);
        } else {
          // Room exists, ensure seller and buyer are in participants
          const currentParticipants = roomSnap.data().participants || [];
          const otherId = currentParticipants.find((id: string) => id !== user.uid);
          if (otherId) setOtherUserId(otherId);

          if (!currentParticipants.includes(sellerId) || !currentParticipants.includes(buyerId)) {
            await updateDoc(roomRef, {
              participants: [buyerId, sellerId].filter((v, i, a) => v && a.indexOf(v) === i),
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    };
    
    const setupChat = async () => {
      try {
        await checkRoom();
        
        const path = `chats/${roomId}/messages`;
        const q = query(collection(db, path), orderBy('createdAt', 'asc'));
        
        const unsubMessages = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
          setMessages(msgs);
          setLoading(false);

          // Mark messages as read
          msgs.forEach(msg => {
            if (msg.senderId !== user.uid && msg.status !== 'READ') {
              updateDoc(doc(db, `chats/${roomId}/messages`, msg.id!), { status: 'READ' });
            }
          });
        }, (error) => {
          console.error("Chat Messages Error:", error);
          setLoading(false);
          handleFirestoreError(error, OperationType.GET, path);
        });

        // Listen for typing
        const unsubRoom = onSnapshot(doc(db, 'chats', roomId), (snap) => {
          if (snap.exists()) {
            setIsTyping(snap.data().typing || {});
            const parts = snap.data().participants;
            const otherId = parts.find((id: string) => id !== user.uid);
            setOtherUserId(otherId);
          }
        });

        return () => {
          unsubMessages();
          unsubRoom();
        };
      } catch (err) {
        console.error("Room Setup Error:", err);
        setLoading(false);
        return () => {};
      }
    };

    let unsubChat: () => void = () => {};
    setupChat().then(fn => { unsubChat = fn; });

    return () => unsubChat();
  }, [roomId, user]);

  // Track Other User Presence
  useEffect(() => {
    if (!otherUserId) return;
    const unsub = onSnapshot(doc(db, 'users', otherUserId, 'status', 'presence'), (snap) => {
      if (snap.exists()) {
        setOtherUserStatus(snap.data().status);
      }
    });
    return () => unsub();
  }, [otherUserId]);

  const handleTyping = (typing: boolean) => {
    if (!roomId || !user) return;
    updateDoc(doc(db, 'chats', roomId), {
      [`typing.${user.uid}`]: typing,
      updatedAt: serverTimestamp()
    });
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (customText?: string, type: 'TEXT' | 'OFFER' | 'SYSTEM' | 'PAY_REQUEST' = 'TEXT', amount?: number) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() && type === 'TEXT') return;
    if (!user || !roomId) return;

    if (!customText) setInputText('');

    const path = `chats/${roomId}/messages`;
    try {
      await addDoc(collection(db, path), {
        senderId: user.uid,
        text: textToSend,
        type,
        ...(amount && { offerAmount: amount }),
        status: otherUserStatus === 'online' ? 'DELIVERED' : 'SENT',
        createdAt: serverTimestamp()
      });
      
      // Update room last message
      await updateDoc(doc(db, 'chats', roomId), {
        lastMessage: textToSend,
        updatedAt: serverTimestamp()
      });

      handleTyping(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleMakeOffer = () => {
    if (!offerAmount) return;
    handleSend(`OFFER: ₦${parseInt(offerAmount).toLocaleString()}`, 'OFFER', parseInt(offerAmount) * 100);
    setOfferAmount('');
    setShowOfferModal(false);
  };

  const handleIssuePayRequest = () => {
    if (!payAmount) return;
    handleSend(`PAYMENT REQUEST: ₦${parseInt(payAmount).toLocaleString()}`, 'PAY_REQUEST', parseInt(payAmount) * 100);
    setPayAmount('');
    setShowPayRequestModal(false);
  };

  const handlePayment = async (msg: Message) => {
    if (!msg.offerAmount) return;
    // Paystack integration (Simplified Popup)
    const handler = (window as any).PaystackPop?.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: user?.email,
      amount: msg.offerAmount,
      currency: "NGN",
      callback: async (response: any) => {
        // Handle success
        handleSend(`PAID: ₦${(msg.offerAmount! / 100).toLocaleString()}. Ref: ${response.reference}`, 'SYSTEM');
        // Update order status logic would go here
      },
      onClose: () => {
        alert('Payment cancelled');
      }
    });
    handler?.openIframe();
  };

  if (!user) {
    return <div className="p-10 text-center">Please login to chat.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] -mx-4 -mt-4 bg-slate-50 relative overflow-hidden animate-in fade-in duration-500">
      {/* ... Header ... */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm shadow-slate-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-800 active:scale-90 transition-transform">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center font-black text-indigo-600 uppercase shadow-inner border border-white/50">
              {user.displayName?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="font-black text-sm text-slate-800 tracking-tight">
                {product?.seller?.displayName || (isSeller ? 'Buyer' : 'Seller')}
              </p>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", otherUserStatus === 'online' ? "bg-green-500 animate-pulse" : "bg-slate-300")} />
                <p className={cn("text-[10px] font-black uppercase tracking-wider", otherUserStatus === 'online' ? "text-green-600" : "text-slate-400")}>
                  {otherUserStatus === 'online' ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Profile Completion Warning */}
        {!profileComplete && (
          <div className="mx-6 p-4 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
              <Loader2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-0.5">Profile Incomplete</p>
              <p className="text-xs font-bold text-indigo-900/70">Update your address to receive delivery.</p>
            </div>
            <button 
              onClick={() => navigate('/settings')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all"
            >
              Complete
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            <div className="text-center">
              <span className="text-[9px] font-black text-slate-400 bg-white/80 border border-slate-100 px-4 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-sm">
                Safety First: Secure with Escrow
              </span>
            </div>

            {messages.map((msg, i) => {
              const isMe = msg.senderId === user.uid;
              const isOffer = msg.type === 'OFFER';
              const isPayRequest = msg.type === 'PAY_REQUEST';

              return (
                <div key={msg.id || i} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                  <div className={cn(
                    "max-w-[85%] px-4 py-3 rounded-[1.25rem] shadow-sm text-sm font-medium leading-relaxed",
                    isOffer || isPayRequest
                      ? "bg-amber-50 border-2 border-amber-200 text-amber-900 rounded-2xl"
                      : isMe 
                        ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-100 shadow-lg" 
                        : "bg-white text-slate-800 rounded-tl-none border border-slate-100 shadow-slate-100 shadow-md"
                  )}>
                    {(isOffer || isPayRequest) && (
                      <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1">
                        {isOffer ? 'New Offer' : 'Payment Request'}
                      </p>
                    )}
                    {msg.text}
                    {isOffer && !isMe && (
                      <div className="mt-3 flex gap-2">
                        <button 
                          onClick={() => {
                            setPayAmount((msg.offerAmount! / 100).toString());
                            setShowPayRequestModal(true);
                          }}
                          className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase"
                        >
                          Accept & Request Pay
                        </button>
                        <button className="px-3 py-1.5 bg-white border border-amber-200 text-amber-600 rounded-lg text-[10px] font-black uppercase">Decline</button>
                      </div>
                    )}
                    {isPayRequest && !isMe && (
                      <div className="mt-3">
                        <button 
                          onClick={() => handlePayment(msg)}
                          className="w-full px-4 py-2.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-100 active:scale-95 transition-all"
                        >
                          Pay Securely ₦{(msg.offerAmount! / 100).toLocaleString()}
                        </button>
                      </div>
                    )}
                  </div>
                  {msg.createdAt && (
                    <div className={cn("flex items-center gap-1.5 mt-2", isMe ? "justify-end" : "justify-start")}>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">
                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                      </p>
                      {isMe && (
                        <div className="flex items-center gap-1">
                          {msg.status === 'READ' ? (
                            <CheckCheck className="w-3 h-3 text-indigo-500" />
                          ) : msg.status === 'DELIVERED' ? (
                            <CheckCheck className="w-3 h-3 text-slate-300" />
                          ) : (
                            <Check className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Typing Indicator */}
            {otherUserId && isTyping[otherUserId] && (
              <div className="flex items-end gap-2 animate-in slide-in-from-left-2 duration-300 mb-2">
                <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center font-black text-[10px] text-slate-400 uppercase">
                   {isSeller ? 'B' : 'S'}
                </div>
                <div className="bg-white px-4 py-3 rounded-[1.25rem] rounded-bl-none border border-slate-100 shadow-sm flex items-center gap-1.5">
                  <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2">Typing...</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Quick Replies & Input */}
      <div className="p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200 sticky bottom-0 space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {!isSeller && (
            <button 
              onClick={() => {
                setInputText("Is this item still available?");
                inputRef.current?.focus();
              }}
              className="whitespace-nowrap px-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-tight text-slate-600 active:bg-indigo-50"
            >
              Still available?
            </button>
          )}
          {!isSeller && (
            <button 
              onClick={() => setShowOfferModal(true)}
              className="whitespace-nowrap px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-tight text-amber-600 flex items-center gap-1.5 active:bg-amber-100"
            >
              Make an Offer
            </button>
          )}
          {isSeller && (
            <button 
              onClick={() => setShowPayRequestModal(true)}
              className="whitespace-nowrap px-4 py-2 bg-green-50 border border-green-200 rounded-full text-[10px] font-black uppercase tracking-tight text-green-600 flex items-center gap-1.5 active:bg-green-100"
            >
              Issue Pay Request
            </button>
          )}
          {!isSeller && (
            <button 
              onClick={() => {
                setInputText("What is the battery health?");
                inputRef.current?.focus();
              }}
              className="whitespace-nowrap px-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-tight text-slate-600 active:bg-indigo-50"
            >
              Battery health?
            </button>
          )}
        </div>

        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button className="p-3 bg-slate-100 text-slate-500 rounded-2xl active:scale-95 transition-transform">
            <ImageIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 relative flex items-center">
            <input 
              type="text" 
              ref={inputRef}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                handleTyping(e.target.value.length > 0);
              }}
              onBlur={() => handleTyping(false)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type message..."
              className="w-full bg-slate-100 border border-slate-200/50 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all font-medium placeholder:text-slate-400"
            />
            <button 
              onClick={() => handleSend()}
              disabled={!inputText.trim()}
              className={cn(
                "absolute right-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95",
                inputText.trim() 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                  : "text-slate-300 pointer-events-none"
              )}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Offer/PayRequest Modals */}
      <AnimatePresence>
        {(showOfferModal || showPayRequestModal) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center p-4 shadow-inner"
          >
            <motion.div 
               initial={{ y: 100 }}
               animate={{ y: 0 }}
               exit={{ y: 100 }}
               className="w-full max-w-sm bg-white rounded-[3rem] p-8 space-y-6 shadow-2xl"
            >
               <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">{showOfferModal ? 'Make an Offer' : 'Issue Pay Request'}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enter the amount in Naira</p>
               </div>
               
               <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">₦</div>
                  <input 
                    type="number"
                    autoFocus
                    value={showOfferModal ? offerAmount : payAmount}
                    onChange={(e) => showOfferModal ? setOfferAmount(e.target.value) : setPayAmount(e.target.value)}
                    placeholder="250,000"
                    className={cn(
                      "w-full bg-slate-50 border border-slate-100 rounded-[2rem] pl-14 pr-6 py-5 text-2xl font-black tracking-tighter outline-none",
                      showOfferModal ? "focus:ring-4 focus:ring-amber-50" : "focus:ring-4 focus:ring-green-50"
                    )}
                  />
               </div>

               <div className="flex gap-3">
                  <button 
                    onClick={() => { setShowOfferModal(false); setShowPayRequestModal(false); }}
                    className="flex-1 h-16 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={showOfferModal ? handleMakeOffer : handleIssuePayRequest}
                    disabled={showOfferModal ? !offerAmount : !payAmount}
                    className={cn(
                      "flex-[2] h-16 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50",
                      showOfferModal ? "bg-amber-500 shadow-amber-100" : "bg-green-600 shadow-green-100"
                    )}
                  >
                    {showOfferModal ? 'Send Offer' : 'Issue Request'}
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
