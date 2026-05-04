import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Loader2, ChevronRight, User } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, getDoc, doc } from 'firebase/firestore';

interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt?: any;
  listingId?: string;
  participantNames?: { [uid: string]: string };
}

export default function Chats() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const path = 'chats';
    const q = query(
      collection(db, path),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const roomData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));
      
      // Fetch names for participants
      const roomsWithNames = await Promise.all(roomData.map(async (room) => {
        const otherId = room.participants.find(id => id !== user.uid);
        if (otherId && otherId !== 'system') {
          const profileSnap = await getDoc(doc(db, 'users', otherId, 'public', 'profile'));
          if (profileSnap.exists()) {
            return {
              ...room,
              otherName: profileSnap.data().displayName,
              otherAvatar: profileSnap.data().avatarUrl
            };
          }
        }
        return { ...room, otherName: otherId === 'system' ? 'System Support' : 'Unknown User' };
      }));

      setRooms(roomsWithNames as any);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 space-y-4">
      <div className="w-20 h-20 bg-slate-100 rounded-[2.5rem] flex items-center justify-center">
        <User className="w-10 h-10 text-slate-300" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Login Required</h2>
        <p className="text-sm text-slate-500 max-w-[240px]">Sign in to your account to view your messages and active negotiations.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-24 h-screen flex flex-col -mx-4 overflow-hidden">
      <div className="px-8 pt-4 pb-2">
         <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">Messages</h1>
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Negotiations</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : rooms.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 px-8 text-center space-y-6"
          >
            <div className="w-32 h-32 bg-indigo-50 rounded-full flex items-center justify-center relative">
               <motion.div 
                 animate={{ rotate: [0, 10, -10, 0] }}
                 transition={{ repeat: Infinity, duration: 4 }}
               >
                 <MessageCircle className="w-16 h-16 text-indigo-200" />
               </motion.div>
               <div className="absolute top-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
               </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">No Conversations</h3>
              <p className="text-xs font-medium text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                Interested in an item? Message the seller to start negotiating!
              </p>
            </div>
            <Link to="/browse" className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all">
              Browse Marketplace
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room: any, index: number) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link 
                  to={`/chat/${room.id}`}
                  className="block bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm active:scale-98 transition-all group hover:border-indigo-100 hover:shadow-indigo-50/50 hover:shadow-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:border-indigo-200 transition-colors">
                      {room.otherAvatar ? (
                        <img src={room.otherAvatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-indigo-200" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={cn("font-black text-slate-800 truncate", (room.lastSenderId && room.lastSenderId !== user.uid && room.lastMessageStatus !== 'READ') && "text-indigo-600")}>
                        {room.otherName}
                      </h3>
                      <p className={cn("text-xs truncate mt-0.5", (room.lastSenderId && room.lastSenderId !== user.uid && room.lastMessageStatus !== 'READ') ? "font-black text-slate-900" : "font-semibold text-slate-400")}>
                        {room.lastMessage || 'Send a message to start negotiating...'}
                      </p>
                    </div>
                    {(room.lastSenderId && room.lastSenderId !== user.uid && room.lastMessageStatus !== 'READ') && (
                      <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-pulse shadow-lg shadow-indigo-200" />
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
