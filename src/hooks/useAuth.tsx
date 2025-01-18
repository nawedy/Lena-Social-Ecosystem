import {
  useState,
  useEffect,
  useContext,
  createContext,
  ReactNode,
} from 'react';
import { User } from '../types/user';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const _AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const _auth = getAuth();

  useEffect(() => {
    const _unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      try {
        if (firebaseUser) {
          // Get additional user data from Firestore
          const _userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const _userData = userDoc.data() as User;
            setUser({
              ...userData,
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              createdAt: firebaseUser.metadata.creationTime
                ? new Date(firebaseUser.metadata.creationTime)
                : new Date(),
              updatedAt: firebaseUser.metadata.lastSignInTime
                ? new Date(firebaseUser.metadata.lastSignInTime)
                : new Date(),
            });
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  const _signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const _signOut = async () => {
    try {
      setLoading(true);
      await auth.signOut();
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const _signUp = async (email: string, password: string, username: string) => {
    try {
      setLoading(true);
      const { user: firebaseUser } = await auth.createUserWithEmailAndPassword(
        email,
        password
      );

      if (firebaseUser) {
        // Create user document in Firestore
        const userData: User = {
          id: firebaseUser.uid,
          username,
          email,
          displayName: username,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'active',
          roles: ['user'],
          preferences: {
            notifications: {
              email: true,
              push: true,
              inApp: true,
            },
            privacy: {
              profileVisibility: 'public',
              messagePermission: 'everyone',
              activityVisibility: 'public',
            },
          },
        };

        await doc(db, 'users', firebaseUser.uid).set(userData);
        setUser(userData);
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const _resetPassword = async (email: string) => {
    try {
      setLoading(true);
      await auth.sendPasswordResetEmail(email);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const _updateProfile = async (data: Partial<User>) => {
    try {
      setLoading(true);
      if (user) {
        await doc(db, 'users', user.id).update({
          ...data,
          updatedAt: new Date(),
        });

        setUser(prev =>
          prev ? { ...prev, ...data, updatedAt: new Date() } : null
        );
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const _sendEmailVerification = async () => {
    try {
      setLoading(true);
      if (auth.currentUser) {
        await auth.currentUser.sendEmailVerification();
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const _deleteAccount = async () => {
    try {
      setLoading(true);
      if (user && auth.currentUser) {
        await doc(db, 'users', user.id).delete();
        await auth.currentUser.delete();
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const _value = {
    user,
    loading,
    error,
    signIn,
    signOut,
    signUp,
    resetPassword,
    updateProfile,
    sendEmailVerification,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const _context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
