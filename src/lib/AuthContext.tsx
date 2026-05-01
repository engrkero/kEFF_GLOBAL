import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let presenceUnsubscribe: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      // Cleanup previous presence tracking if user changed
      if (presenceUnsubscribe) {
        presenceUnsubscribe();
        presenceUnsubscribe = undefined;
      }

      if (user) {
        // Presence Tracking
        const { db } = await import('./firebase');
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        const statusRef = doc(db, 'users', user.uid, 'status', 'presence');
        
        const setOnline = () => setDoc(statusRef, { 
          status: 'online', 
          lastChanged: serverTimestamp(),
          userId: user.uid 
        }, { merge: true });

        const setOffline = () => setDoc(statusRef, { 
          status: 'offline', 
          lastChanged: serverTimestamp() 
        }, { merge: true });

        setOnline();

        // Heartbeat
        const interval = setInterval(setOnline, 30000); // 30s heartbeat

        // Visibility Change
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            setOnline();
          } else {
            setOffline();
          }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        presenceUnsubscribe = () => {
          clearInterval(interval);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          setOffline();
        };
      }
    });

    return () => {
      unsubscribe();
      if (presenceUnsubscribe) presenceUnsubscribe();
    };
  }, []);

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Initialize Firestore profile if it doesn't exist
      const { db } = await import('./firebase');
      const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      
      const profileRef = doc(db, 'users', user.uid, 'public', 'profile');
      const profileSnap = await getDoc(profileRef);
      
      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          displayName: user.displayName || 'New User',
          avatarUrl: user.photoURL || '',
          location: '',
          verificationStatus: 'UNVERIFIED',
          updatedAt: serverTimestamp()
        });

        await setDoc(doc(db, 'users', user.uid, 'private', 'data'), {
          email: user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
