import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, User } from 'firebase/auth';

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
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        initializeProfile(result.user);
      }
    }).catch((error) => {
      console.error("Redirect login error:", error);
    });

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

        // Visibility Change - Only set offline if hidden for a while
        let visibilityTimeout: any;
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            if (visibilityTimeout) clearTimeout(visibilityTimeout);
            setOnline();
          } else {
            // Set offline after 1 minute of being hidden
            visibilityTimeout = setTimeout(setOffline, 60000);
          }
        };
        
        const handleUnload = () => {
          setOffline();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleUnload);

        presenceUnsubscribe = () => {
          clearInterval(interval);
          if (visibilityTimeout) clearTimeout(visibilityTimeout);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('beforeunload', handleUnload);
          setOffline();
        };
      }
    });

    return () => {
      unsubscribe();
      if (presenceUnsubscribe) presenceUnsubscribe();
    };
  }, []);

  const initializeProfile = async (user: User) => {
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
  };

  const login = async () => {
    try {
      const isWebView = /wv|WebView|Android.*(wv|Build\/)/i.test(navigator.userAgent);
      
      if (isWebView) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        await initializeProfile(user);
      }
    } catch (error) {
      console.error("Login failed", error);
      // Fallback to redirect
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (err) {
        console.error("Redirect fallback failed", err);
      }
    }
  };

  // Run profile initialization on any auth change too
  useEffect(() => {
    if (user) {
      initializeProfile(user);
    }
  }, [user]);

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
