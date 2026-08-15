import React, { createContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../../config/firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, pass: string) => Promise<User>;
  signIn: (email: string, pass: string) => Promise<User>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const mapAuthError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email address or password.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      default:
        return err?.message || 'An unexpected authentication error occurred.';
    }
  };

  const signUp = async (email: string, pass: string): Promise<User> => {
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      return credential.user;
    } catch (err: any) {
      const msg = mapAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signIn = async (email: string, pass: string): Promise<User> => {
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, pass);
      return credential.user;
    } catch (err: any) {
      const msg = mapAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signOut = async (): Promise<void> => {
    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch (err: any) {
      const msg = mapAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signUp,
        signIn,
        signOut,
        getIdToken,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
