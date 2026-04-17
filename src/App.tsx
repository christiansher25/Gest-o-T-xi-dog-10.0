/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component, ErrorInfo, useRef } from 'react';
import { domToCanvas, domToJpeg } from 'modern-screenshot';
import { 
  Plus, 
  Users, 
  Calendar, 
  BarChart3, 
  Calculator, 
  Search, 
  Trash2, 
  FileText, 
  LogOut, 
  LogIn, 
  Dog, 
  MapPin, 
  Clock, 
  DollarSign, 
  ChevronRight, 
  PlusCircle, 
  X,
  Save,
  Download,
  Edit2,
  AlertTriangle,
  Image,
  FileDown,
  Phone,
  Navigation,
  ArrowRight,
  Share2,
  Handshake,
  Star,
  Printer,
  Gift,
  Lock,
  Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc, 
  setDoc,
  getDocs,
  orderBy,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { auth, db } from './firebase';

// --- Types ---

const SERVICE_TYPES = [
  "Castração",
  "Clínica Veterinária",
  "Estadual",
  "Mudança",
  "Municipal",
  "Pacote Mensal",
  "Rota Compartilhada",
  "Outros"
].sort((a, b) => a.localeCompare(b));

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "Você não tem permissão para realizar esta ação.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
          <div className="bg-[#111] p-8 rounded-2xl border border-[#ef44444d] max-w-md">
            <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
            <h2 className="text-xl font-bold text-white mb-2">Ops! Algo deu errado</h2>
            <p className="text-gray-400 text-sm mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-[#D4AF37] text-black px-6 py-2 rounded-full font-bold"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Excluir", 
  cancelText = "Cancelar",
  variant = "danger"
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string,
  confirmText?: string,
  cancelText?: string,
  variant?: "danger" | "warning"
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#000000cc] backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-[#121212] w-full max-w-sm rounded-[20px] border border-[#D4AF374d] p-6 shadow-[0_0_20px_rgba(212,175,55,0.2)]"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-[#ef444433] text-red-500' : 'bg-[#eab30833] text-yellow-500'}`}>
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          <p className="text-gray-400 text-sm mb-6">{message}</p>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 bg-[#ffffff0d] hover:bg-[#ffffff1a] text-white py-3 rounded-xl font-bold transition-colors"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 py-3 rounded-[12px] font-bold transition-colors ${variant === 'danger' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-[#D4AF37] hover:bg-[#B8962E] text-black'}`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface Pet {
  id: string;
  customerId: string;
  name: string;
  size: 'Pequeno' | 'Médio' | 'Grande';
  breed: string;
  uid: string;
}

interface Partner {
  id: string;
  docId: string;
  name: string;
  phone: string;
  address: string;
  observations: string;
  uid: string;
}

interface Customer {
  id: string; // Auto-generated code
  docId: string; // Firestore doc ID
  name: string;
  phone: string;
  city: string;
  address: string;
  partnerId?: string;
  loyaltyCycleStart?: string;
  loyaltyCount?: number;
  loyaltyRewardAvailable?: boolean;
  uid: string;
}

interface Appointment {
  id: string; // Auto-generated code
  docId: string;
  customerId: string;
  petIds: string[];
  dateTime: string;
  originCity?: string;
  destinationCity?: string;
  city: string;
  pickupAddress: string;
  destinations: string[];
  type: string;
  value: number;
  totalKm?: number;
  petCount: number;
  status: 'Pendente' | 'Atendido' | 'Pago' | 'Cancelado' | 'Recusado' | 'Rota Compartilhada';
  discount?: number;
  observations?: string;
  uid: string;
  packageId?: string;
  isMonthly?: boolean;
  unitValue?: number; // Calculated daily value for packages
}

interface MonthlyPackage {
  docId: string;
  customerId: string;
  customerName: string;
  totalValue: number;
  daysPerMonth: number;
  startDate: string; // ISO Date (usually start of month)
  status: 'Ativo' | 'Renovado' | 'Cancelado' | 'Pendente Atualização';
  abatementAmount: number; // accumulated value from missed days to be applied to NEXT month
  extraDiscount: number; // manual discount
  nextMonthValue?: number;
  uid: string;
}

interface Calculation {
  id?: string;
  docId?: string;
  customerId?: string;
  customerName?: string;
  originCity?: string;
  destinationCity?: string;
  distance: number;
  totalKm?: number;
  fuelPrice: number;
  carDailyRate: number;
  carDays: number;
  toll: number;
  hotelRate: number;
  hotelDays: number;
  food: number;
  workHours: number;
  total: number;
  discount?: number;
  timestamp: string;
  status: 'Pendente' | 'Aprovado' | 'Recusado' | 'Cancelado' | 'Pago' | 'Rota Compartilhada';
  uid: string;
}

// --- Components ---

const LOGO_URL = "https://lh3.googleusercontent.com/d/1lq-NUSoRQFIfhmv87g4z4BbssWnWrjXs";
const SPLASH_URL = "https://lh3.googleusercontent.com/d/1xCpZ4je_LK2N9NcObo6hRkm_vLsX-ta6";
const LETTERHEAD_BG_URL = "https://lh3.googleusercontent.com/d/1ubU-aoFaGFNSKjazHHF7ACb5CxLRriHg";

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'customers' | 'appointments' | 'reports' | 'calculator'>(() => {
    return (localStorage.getItem('levapet_activeTab') as any) || 'home';
  });
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [authError, setAuthError] = useState('');
  
  // Data States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [view, setView] = useState<'loyalty' | 'crm'>('loyalty');
  
  // --- Loyalty Card Logic ---
  const [loyaltyData, setLoyaltyData] = useState(() => {
    const saved = localStorage.getItem('levapet_loyalty_v2');
    return saved ? JSON.parse(saved) : {
      tutorName: '',
      petName: '',
      attendances: [] as string[]
    };
  });

  useEffect(() => {
    localStorage.setItem('levapet_loyalty_v2', JSON.stringify(loyaltyData));
  }, [loyaltyData]);

  const addAttendance = () => {
    if (loyaltyData.attendances.length >= 5) return;
    const today = format(new Date(), 'dd/MM/yy');
    setLoyaltyData((prev: any) => ({
      ...prev,
      attendances: [...prev.attendances, today]
    }));
  };

  const clearCard = () => {
    setLoyaltyData({
      tutorName: '',
      petName: '',
      attendances: []
    });
  };

  // --- CRM State ---
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [monthlyPackages, setMonthlyPackages] = useState<MonthlyPackage[]>([]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const adminEmails = ['christiansher25@gmail.com', 'sher343537@levapet.com'];
    return adminEmails.includes(user.email?.toLowerCase() || '');
  }, [user]);

  const handleDeleteAppointment = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'appointments', docId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'appointments');
    }
  };

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      // Keep splash for at least 3 seconds
      setTimeout(() => setShowSplash(false), 3000);
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching Effect
  useEffect(() => {
    if (!user) return;

    const qCustomers = isAdmin 
      ? query(collection(db, 'customers'), orderBy('name')) 
      : query(collection(db, 'customers'), where('uid', '==', user.uid));
    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id } as Customer)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customers'));

    const qPets = isAdmin 
      ? query(collection(db, 'pets')) 
      : query(collection(db, 'pets'), where('uid', '==', user.uid));
    const unsubPets = onSnapshot(qPets, (snapshot) => {
      setPets(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Pet)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'pets'));

    const qPartners = isAdmin 
      ? query(collection(db, 'partners'), orderBy('name')) 
      : query(collection(db, 'partners'), where('uid', '==', user.uid));
    const unsubPartners = onSnapshot(qPartners, (snapshot) => {
      setPartners(snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id } as Partner)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'partners'));

    const qAppointments = isAdmin 
      ? query(collection(db, 'appointments'), orderBy('dateTime', 'desc')) 
      : query(collection(db, 'appointments'), where('uid', '==', user.uid));
    const unsubAppointments = onSnapshot(qAppointments, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id } as Appointment)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'appointments'));

    const qCalculations = isAdmin 
      ? query(collection(db, 'calculations'), orderBy('timestamp', 'desc')) 
      : query(collection(db, 'calculations'), where('uid', '==', user.uid));
    const unsubCalculations = onSnapshot(qCalculations, (snapshot) => {
      setCalculations(snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id } as Calculation)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'calculations'));

    const qPackages = isAdmin 
      ? query(collection(db, 'monthlyPackages')) 
      : query(collection(db, 'monthlyPackages'), where('uid', '==', user.uid));
    const unsubPackages = onSnapshot(qPackages, (snapshot) => {
      setMonthlyPackages(snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id } as MonthlyPackage)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'monthlyPackages'));

    return () => {
      unsubCustomers();
      unsubPets();
      unsubPartners();
      unsubAppointments();
      unsubCalculations();
      unsubPackages();
    };
  }, [user]);

  // Tab Persistence
  useEffect(() => {
    localStorage.setItem('levapet_activeTab', activeTab);
  }, [activeTab]);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  const [editingCalculation, setEditingCalculation] = useState<Calculation | null>(() => {
    const saved = localStorage.getItem('levapet_editingCalculation');
    return saved ? JSON.parse(saved) : null;
  });
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(() => {
    const saved = localStorage.getItem('levapet_viewingAppointment');
    return saved ? JSON.parse(saved) : null;
  });
  const [viewingBudget, setViewingBudget] = useState<Calculation | null>(() => {
    const saved = localStorage.getItem('levapet_viewingBudget');
    return saved ? JSON.parse(saved) : null;
  });
  const [viewingCalculationPreview, setViewingCalculationPreview] = useState<Calculation | null>(() => {
    const saved = localStorage.getItem('levapet_viewingCalculationPreview');
    return saved ? JSON.parse(saved) : null;
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem('levapet_editingCalculation', JSON.stringify(editingCalculation));
    localStorage.setItem('levapet_viewingAppointment', JSON.stringify(viewingAppointment));
    localStorage.setItem('levapet_viewingBudget', JSON.stringify(viewingBudget));
    localStorage.setItem('levapet_viewingCalculationPreview', JSON.stringify(viewingCalculationPreview));
  }, [editingCalculation, viewingAppointment, viewingBudget, viewingCalculationPreview]);

  const handleAuth = async () => {
    setAuthError('');
    if (!accessCode || accessCode.length < 4) {
      setAuthError("Digite um código de acesso válido (mínimo 4 caracteres).");
      return;
    }

    // Derived credentials for shared access
    const sharedEmail = `${accessCode.toLowerCase().trim()}@levapet.com`;
    const sharedPassword = `pwd_${accessCode.toLowerCase().trim()}_levapet`;

    try {
      try {
        // Try to sign in first
        await signInWithEmailAndPassword(auth, sharedEmail, sharedPassword);
      } catch (signInErr: any) {
        // If user doesn't exist, create it (Shared Account approach)
        if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, sharedEmail, sharedPassword);
            // Create user document in Firestore for role tracking
            try {
              await setDoc(doc(db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                email: userCredential.user.email,
                role: accessCode.toLowerCase().trim() === 'sher343537' ? 'admin' : 'user'
              });
            } catch (e) {
              handleFirestoreError(e, OperationType.CREATE, 'users');
            }
          } catch (createErr: any) {
            // If creation fails because it already exists (race condition), try signing in again
            if (createErr.code === 'auth/email-already-in-use') {
              await signInWithEmailAndPassword(auth, sharedEmail, sharedPassword);
            } else {
              throw createErr;
            }
          }
        } else {
          throw signInErr;
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError("Erro ao acessar o sistema. Verifique sua conexão.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const getPhoneDuplicate = (phone: string, skipId?: string) => {
    if (!phone) return null;
    const sanitized = phone.replace(/\D/g, '');
    if (!sanitized) return null;
    
    const duplicateCustomer = customers.find(c => c.phone.replace(/\D/g, '') === sanitized && c.docId !== skipId);
    if (duplicateCustomer) return { docId: duplicateCustomer.docId, name: duplicateCustomer.name, type: 'Cliente' };
    
    const duplicatePartner = partners.find(p => p.phone.replace(/\D/g, '') === sanitized && p.docId !== skipId);
    if (duplicatePartner) return { docId: duplicatePartner.docId, name: duplicatePartner.name, type: 'Parceiro' };
    
    return null;
  };

  if (loading || showSplash) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          className="relative w-full max-w-sm aspect-square bg-[#111] rounded-[48px] border-2 border-[#D4AF3733] flex items-center justify-center p-12 shadow-[0_30px_100px_-15px_rgba(212,175,55,0.2)]"
        >
          <img 
            src={LOGO_URL} 
            alt="Leva Pet" 
            className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col items-center justify-end pb-12">
            <div className="flex gap-1.5 mb-4">
              <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-2 h-2 rounded-full bg-[#D4AF37]" />
            </div>
            <p className="text-[#D4AF37] font-black tracking-[0.4em] uppercase text-[9px]">Leva Pet Digital</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleDeleteCalculation = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'calculations', docId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'calculations');
    }
  };

  const handleAddCalculation = async (calcData: any) => {
    try {
      await addDoc(collection(db, 'calculations'), {
        ...calcData,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'calculations');
    }
  };

  const handleRenewPackage = async (pkg: MonthlyPackage, nextValue: number, extraDiscount: number) => {
    try {
      const now = new Date();
      await updateDoc(doc(db, 'monthlyPackages', pkg.docId), {
        startDate: startOfMonth(now).toISOString(),
        abatementAmount: 0,
        extraDiscount: extraDiscount,
        status: 'Ativo'
      });

      // Find the template (the last appointment for this package)
      const lastApp = appointments
        .filter(a => a.packageId === pkg.docId)
        .sort((a, b) => b.dateTime.localeCompare(a.dateTime))[0];

      if (lastApp) {
        const pkgDays = pkg.daysPerMonth;
        const unitValue = pkg.totalValue / pkgDays;
        
        // Generate multiple appointments for the package
        let createdCount = 0;
        let currentDate = startOfMonth(now);
        
        while (createdCount < pkgDays) {
          // Skip Sundays (0)
          if (currentDate.getDay() === 0) {
            currentDate = addDays(currentDate, 1);
            continue;
          }
          
          const code = `A${Math.floor(10000 + Math.random() * 90000)}`;
          await addDoc(collection(db, 'appointments'), {
            customerId: lastApp.customerId,
            petIds: lastApp.petIds,
            petCount: lastApp.petCount || 0,
            pickupAddress: lastApp.pickupAddress,
            destinations: lastApp.destinations,
            type: lastApp.type,
            dateTime: currentDate.toISOString(),
            uid: user?.uid,
            packageId: pkg.docId,
            isMonthly: true,
            unitValue: unitValue,
            value: unitValue,
            status: 'Pendente'
          });
          createdCount++;
          currentDate = addDays(currentDate, 1);
        }
      }

      alert(`Pacote renovado com sucesso! Valor para este mês (após abates e descontos): R$ ${nextValue.toFixed(2)}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'monthlyPackages');
    }
  };

  const handleCancelPackage = async (docId: string) => {
    try {
      await updateDoc(doc(db, 'monthlyPackages', docId), { status: 'Cancelado' });
      alert("Pacote cancelado.");
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'monthlyPackages');
    }
  };

  if (!user && view === 'crm') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-10 bg-[#0a0a0a] p-12 rounded-[56px] border-2 border-[#D4AF371a] shadow-2xl relative overflow-hidden"
        >
          <div className="relative z-10 text-center space-y-3">
             <div className="inline-block p-4 rounded-full bg-[#111] mb-2">
               <Lock size={32} className="text-[#D4AF37]" />
             </div>
             <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Área Restrita</h2>
             <p className="text-[10px] text-gray-600 uppercase font-black tracking-[0.4em]">Confirme sua Identidade</p>
          </div>

          <div className="relative z-10 space-y-8">
             <div className="space-y-2">
               <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-3">Chave de Segurança</label>
               <input 
                 type="password"
                 className="w-full bg-black border-2 border-[#111] focus:border-[#D4AF37] rounded-[32px] p-5 text-center text-2xl font-black tracking-[0.8em] outline-none transition-all placeholder:text-[10px] placeholder:tracking-widest"
                 placeholder="••••••"
                 value={accessCode}
                 onChange={e => setAccessCode(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleAuth()}
               />
             </div>

             <button 
               onClick={handleAuth}
               className="w-full bg-[#D4AF37] text-black font-black py-6 rounded-[32px] hover:scale-[1.03] active:scale-95 transition-all shadow-2xl shadow-[#D4AF3733] text-lg"
             >
               DESBLOQUEAR SISTEMA
             </button>

             {authError && <p className="text-red-500 text-[10px] text-center font-bold uppercase tracking-widest bg-red-500/10 p-4 rounded-2xl border border-red-500/20">{authError}</p>}
             
             <button 
              onClick={() => setView('loyalty')}
              className="w-full text-[10px] text-gray-600 hover:text-white font-black uppercase tracking-widest transition-colors"
             >
               Voltar ao Cartão
             </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#D4AF37] selection:text-black antialiased overflow-x-hidden">
      {view === 'loyalty' ? (
        <div className="container mx-auto px-6 py-12 max-w-md min-h-screen flex flex-col items-center justify-center space-y-12">
          {/* Brand Header */}
          <motion.div 
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3 w-full"
          >
            <div className="flex justify-center">
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-[#D4AF37] to-[#B8962E] rounded-[32px] blur-lg opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative w-28 h-28 bg-[#111] rounded-[32px] border border-[#D4AF3733] flex items-center justify-center p-4 shadow-2xl">
                  <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-[#D4AF37] uppercase tracking-tighter leading-none">Leva Pet</h1>
              <p className="text-[#9ca3af] text-[10px] uppercase tracking-[0.5em] font-black mt-2">Táxi Dog Rio Preto</p>
            </div>
          </motion.div>

          {/* Form Controls */}
          <div className="w-full space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1 px-1">
                <Users size={12} className="text-[#D4AF37]" />
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Responsável (Tutor)</label>
              </div>
              <input 
                value={loyaltyData.tutorName}
                onChange={e => setLoyaltyData((prev: any) => ({ ...prev, tutorName: e.target.value }))}
                placeholder="Qual seu nome?"
                className="w-full bg-[#111] border border-[#D4AF371a] focus:border-[#D4AF37] rounded-2xl p-4 text-white outline-none transition-all placeholder:text-gray-800 text-lg font-bold"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1 px-1">
                <div className="text-[#D4AF37] text-xs font-black">🐾</div>
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Nome do Pet</label>
              </div>
              <input 
                value={loyaltyData.petName}
                onChange={e => setLoyaltyData((prev: any) => ({ ...prev, petName: e.target.value }))}
                placeholder="Nome do seu amiguinho"
                className="w-full bg-[#111] border border-[#D4AF371a] focus:border-[#D4AF37] rounded-2xl p-4 text-white outline-none transition-all placeholder:text-gray-800 text-lg font-bold"
              />
            </div>
          </div>

          {/* Interactive Card */}
          <div className="w-full relative">
            {/* Visual Flare */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#D4AF37] rounded-full blur-[100px] opacity-10 animate-pulse pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#D4AF37] rounded-full blur-[100px] opacity-10 animate-pulse pointer-events-none" />

            {/* The Actual Card */}
            <motion.div 
              whileHover={{ scale: 1.02, rotateY: 2 }}
              className="relative w-full aspect-[1.41] bg-white rounded-[32px] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.9)] overflow-hidden border border-[#D4AF3733]"
            >
              <img 
                src="https://lh3.googleusercontent.com/d/15qY3dTF5V2g5b7r0fd63RHXtvK60_YsJ" 
                alt="Cartão"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              
              {/* Dynamic Overlays */}
              <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
                {/* Tutor Text */}
                <div className="absolute top-[37.8%] left-[46.5%] text-[3.5cqw] sm:text-[18px] font-black text-black uppercase tracking-tight w-[45%] truncate">
                  {loyaltyData.tutorName || ''}
                </div>
                {/* Pet Text */}
                <div className="absolute top-[45.8%] left-[46.5%] text-[3.5cqw] sm:text-[18px] font-black text-black uppercase tracking-tight w-[45%] truncate">
                  {loyaltyData.petName || ''}
                </div>
                {/* Slots Wrapper */}
                <div className="absolute bottom-[25.8%] left-[22.5%] right-[9.8%] flex justify-between items-center text-black">
                  {[0, 1, 2, 3, 4].map(i => (
                    <motion.div 
                      key={i} 
                      initial={false}
                      animate={loyaltyData.attendances[i] ? { scale: [0.8, 1.2, 1], rotate: [0, 8, 0] } : {}}
                      className="w-[15.5%] text-center text-[2.4cqw] sm:text-[12px] font-black italic tracking-tighter"
                    >
                      {loyaltyData.attendances[i] || ''}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Progress Visualization */}
            <div className="mt-8 px-1">
              <div className="flex justify-between items-end mb-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Fidelidade Leva Pet</p>
                <p className="text-2xl font-black text-white italic">{loyaltyData.attendances.length}<span className="text-[#D4AF37] non-italic opacity-50">/5</span></p>
              </div>
              <div className="h-5 bg-[#111] rounded-full overflow-hidden border border-[#ffffff0d] p-1">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(loyaltyData.attendances.length / 5) * 100}%` }}
                  className="h-full bg-gradient-to-r from-[#D4AF37] to-[#B8962E] rounded-full shadow-[0_0_20px_rgba(212,175,55,0.4)] relative"
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </motion.div>
              </div>
            </div>
          </div>

          {/* Reward Alert */}
          <AnimatePresence>
            {loyaltyData.attendances.length === 5 && (
              <motion.div 
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="w-full bg-[#D4AF37] p-8 rounded-[40px] text-black text-center shadow-[0_30px_60px_rgba(212,175,55,0.4)] relative overflow-hidden group border-2 border-white/20"
              >
                <div className="relative z-10 flex flex-col items-center">
                  <div className="bg-black/10 p-3 rounded-full mb-3 backdrop-blur-sm">
                    <Star fill="currentColor" size={28} className="animate-spin-slow" />
                  </div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-2 opacity-70">Benefício Exclusivo</h3>
                  <p className="text-2xl font-black leading-tight tracking-tighter">VOCÊ GANHOU 50% DE DESCONTO NO PRÓXIMO TRANSPORTE!</p>
                </div>
                {/* Shine Animation */}
                <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-[-30deg] animate-shine" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Actions */}
          <div className="w-full space-y-4">
            <button 
              onClick={addAttendance}
              disabled={loyaltyData.attendances.length >= 5 || !loyaltyData.tutorName || !loyaltyData.petName}
              className="w-full group bg-gradient-to-br from-[#D4AF37] to-[#B8962E] disabled:from-[#1a1a1a] disabled:to-[#111] disabled:text-gray-700 disabled:opacity-50 text-black font-black py-6 rounded-3xl flex items-center justify-center gap-4 active:scale-95 transition-all shadow-[0_20px_40px_rgba(212,175,55,0.25)] hover:shadow-[0_25px_50px_rgba(212,175,55,0.35)]"
            >
              <PlusCircle size={24} className="group-hover:rotate-90 transition-transform duration-500" />
              <span className="text-xl tracking-tight">REGISTRAR ATENDIMENTO</span>
            </button>
            
            <div className="flex gap-4">
              <button 
                onClick={clearCard}
                className="flex-1 bg-[#111] text-gray-500 font-black py-4 rounded-2xl hover:text-red-500 hover:bg-red-500/10 transition-all text-[10px] uppercase tracking-widest border border-transparent hover:border-red-500/20"
              >
                Resetar Cartão
              </button>
              <button 
                onClick={() => window.print()}
                className="flex-1 bg-[#111] text-gray-400 font-black py-4 rounded-2xl hover:text-[#D4AF37] hover:bg-[#D4AF370d] transition-all text-[10px] uppercase tracking-widest border border-transparent hover:border-[#D4AF37]/20 flex items-center justify-center gap-2"
              >
                <Printer size={14} /> Imprimir
              </button>
            </div>
          </div>

          {/* Social Hub */}
          <div className="w-full pt-12 border-t border-[#ffffff0d] space-y-8">
            <p className="text-[10px] text-center text-gray-600 uppercase font-black tracking-[0.4em]">Fale Direto Conosco</p>
            <div className="grid grid-cols-2 gap-4">
              <a 
                href="https://wa.me/5517997180559" 
                target="_blank" 
                className="bg-[#0a0a0a] p-6 rounded-[32px] flex flex-col items-center justify-center gap-4 group border border-[#ffffff04] hover:border-[#25D36633] transition-all hover:bg-[#25D3660a]"
              >
                <div className="w-14 h-14 bg-[#25D3660d] rounded-full flex items-center justify-center group-hover:scale-110 transition-all group-hover:bg-[#25D36622]">
                  <Phone size={24} className="text-[#25D366]" />
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-gray-600 uppercase font-black mb-1">WhatsApp</p>
                  <p className="text-sm font-black text-white">(17) 99718-0559</p>
                </div>
              </a>
              <a 
                href="https://instagram.com/levapetriopreto" 
                target="_blank" 
                className="bg-[#0a0a0a] p-6 rounded-[32px] flex flex-col items-center justify-center gap-4 group border border-[#ffffff04] hover:border-[#E1306C33] transition-all hover:bg-[#E1306C0a]"
              >
                <div className="w-14 h-14 bg-[#E1306C0d] rounded-full flex items-center justify-center group-hover:scale-110 transition-all group-hover:bg-[#E1306C22]">
                  <Image size={24} className="text-[#E1306C]" />
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-gray-600 uppercase font-black mb-1">Instagram</p>
                  <p className="text-sm font-black text-white">@levapetriopreto</p>
                </div>
              </a>
            </div>
          </div>

          {/* Hidden Admin Access */}
          <div className="pt-16 text-center pb-12">
            <button 
              onClick={() => setView('crm')}
              className="px-8 py-3 rounded-2xl border-2 border-[#D4AF3733] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-black uppercase tracking-[0.2em] transition-all text-[10px] shadow-[0_0_20px_rgba(212,175,55,0.1)] active:scale-95"
            >
              • Gerenciar Sistema •
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-screen overflow-hidden bg-[#050505]">
          {/* Admin Sidebar */}
          <aside className="hidden md:flex w-24 flex-col items-center py-10 bg-black border-r border-[#ffffff0d] gap-8 relative z-50">
            <div className="w-16 h-16 bg-[#111] rounded-3xl border border-[#D4AF3733] flex items-center justify-center p-4 mb-8 shadow-2xl">
              <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            
            <nav className="flex flex-col gap-6 flex-1">
              <NavButton icon={<Home size={22} />} label="Início" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavButton icon={<Users size={22} />} label="Clientes" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
              <NavButton icon={<Calendar size={22} />} label="Agenda" active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')} />
              <NavButton icon={<Calculator size={22} />} label="Calcular" active={activeTab === 'calculator'} onClick={() => setActiveTab('calculator')} />
              <NavButton icon={<BarChart3 size={22} />} label="Relatórios" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
            </nav>

            <div className="mt-auto flex flex-col gap-5">
              <button 
                onClick={() => setView('loyalty')} 
                className="p-4 text-[#D4AF37] bg-[#111] hover:bg-[#D4AF371a] rounded-[24px] transition-all shadow-xl group" 
                title="Sair da Gestão"
              >
                <Star size={22} className="group-hover:rotate-45 transition-transform" />
              </button>
              <button 
                onClick={handleLogout}
                className="p-4 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-[24px] transition-all"
                title="Finalizar Sessão"
              >
                <LogOut size={22} />
              </button>
            </div>
          </aside>

          {/* Admin Main Portal */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <header className="p-6 md:p-8 flex items-center justify-between border-b border-[#ffffff0d] backdrop-blur-md bg-black/50 sticky top-0 z-40">
               <div className="flex items-center gap-4">
                 <div className="md:hidden w-10 h-10 bg-[#111] rounded-xl flex items-center justify-center p-2 border border-[#D4AF3733]">
                   <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                 </div>
                 <div>
                   <h1 className="font-black text-white uppercase text-sm tracking-widest hidden sm:block">Painel de Controle</h1>
                   <p className="text-[10px] text-[#D4AF37] uppercase font-black tracking-[0.3em]">Leva Pet Administração</p>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setView('loyalty')} className="md:hidden text-[#D4AF37] p-2 bg-[#111] rounded-xl"><Star size={20} /></button>
                 {user && (
                   <div className="flex items-center gap-3 bg-[#111] pl-1 pr-4 py-1 rounded-full border border-[#ffffff0d]">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-black text-xs">
                        {user.displayName?.charAt(0) || user.email?.charAt(0) || 'A'}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] hidden lg:block">{user.displayName || 'Administrador'}</span>
                   </div>
                 )}
               </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 relative">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={activeTab}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="pb-32 md:pb-0"
                >
                  {activeTab === 'home' && (
                    <HomeView 
                      appointments={appointments} 
                      calculations={calculations} 
                      customers={customers} 
                      pets={pets} 
                      onDelete={handleDeleteAppointment}
                      monthlyPackages={monthlyPackages}
                      onRenewPackage={handleRenewPackage}
                      onCancelPackage={handleCancelPackage}
                    />
                  )}
                  {activeTab === 'customers' && <CustomersView user={user!} customers={customers} pets={pets} partners={partners} appointments={appointments} getPhoneDuplicate={getPhoneDuplicate} />}
                  {activeTab === 'appointments' && (
                    <AppointmentsView 
                      user={user!} 
                      customers={customers} 
                      pets={pets} 
                      appointments={appointments} 
                      onDelete={handleDeleteAppointment} 
                      onViewAppointment={setViewingAppointment}
                      monthlyPackages={monthlyPackages} 
                    />
                  )}
                  {activeTab === 'reports' && <ReportsView appointments={appointments} calculations={calculations} customers={customers} pets={pets} onDeleteCalculation={handleDeleteCalculation} onViewAppointment={setViewingAppointment} onViewBudget={setViewingBudget} onEditCalculation={(calc) => { setEditingCalculation(calc); setActiveTab('calculator'); }} />}
                  {activeTab === 'calculator' && <CalculatorView user={user!} customers={customers} editingCalculation={editingCalculation} onCancelEdit={() => setEditingCalculation(null)} onPreview={setViewingCalculationPreview} getPhoneDuplicate={getPhoneDuplicate} />}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Admin Mobile Footer Nav */}
            {user && (
              <nav className="md:hidden fixed bottom-6 left-6 right-6 p-4 bg-black/60 backdrop-blur-2xl border border-[#ffffff0d] flex justify-around items-center z-[100] rounded-[32px] shadow-2xl">
                <NavButton icon={<Home size={22} />} label="" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
                <NavButton icon={<Users size={22} />} label="" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
                <NavButton icon={<Calendar size={22} />} label="" active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')} />
                <NavButton icon={<Calculator size={22} />} label="" active={activeTab === 'calculator'} onClick={() => setActiveTab('calculator')} />
                <NavButton icon={<BarChart3 size={22} />} label="" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
              </nav>
            )}
          </div>
        </div>
      )}

      {/* Persistence Modals Portal */}
      <AnimatePresence>
        {viewingAppointment && (
          <ReceiptView 
            appointment={viewingAppointment}
            onClose={() => setViewingAppointment(null)}
            onUpdate={async (updated) => {
              try {
                await updateDoc(doc(db, 'appointments', viewingAppointment.docId), updated);
                setViewingAppointment(null);
                alert("Agendamento atualizado com Sucesso");
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, 'appointments');
              }
            }}
            customers={customers}
            pets={pets}
          />
        )}
        {viewingBudget && (
          <ReceiptView 
            calculation={viewingBudget}
            onClose={() => setViewingBudget(null)}
            onUpdate={async (updated) => {
              try {
                await updateDoc(doc(db, 'calculations', viewingBudget.docId), updated);
                setViewingBudget(null);
                alert("Orçamento atualizado com Sucesso");
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, 'calculations');
              }
            }}
            customers={customers}
            pets={pets}
          />
        )}
        {viewingCalculationPreview && (
          <ReceiptView 
            calculation={viewingCalculationPreview}
            onClose={() => setViewingCalculationPreview(null)}
            onUpdate={async (updated) => {
              try {
                if (viewingCalculationPreview.docId) {
                  await updateDoc(doc(db, 'calculations', viewingCalculationPreview.docId), updated);
                  alert("Orçamento atualizado com Sucesso");
                } else {
                  await handleAddCalculation(updated);
                  alert("Orçamento salvo com Sucesso");
                }
                setViewingCalculationPreview(null);
                setActiveTab('reports');
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, 'calculations');
              }
            }}
            customers={customers}
            pets={pets}
            isEditing={true}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReceiptView({ 
  appointment, 
  calculation,
  onClose, 
  onUpdate,
  customers,
  pets,
  isEditing: initialIsEditing = false
}: { 
  appointment?: Appointment; 
  calculation?: Calculation;
  onClose: () => void; 
  onUpdate: (updated: any) => void;
  customers: Customer[];
  pets: Pet[];
  isEditing?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [editedApp, setEditedApp] = useState(appointment || {
    dateTime: '',
    value: 0,
    type: '',
    originCity: '',
    destinationCity: '',
    pickupAddress: '',
    observations: ''
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  
  const customer = customers.find(c => c.docId === (appointment?.customerId || calculation?.customerId));
  const appPets = appointment ? pets.filter(p => appointment.petIds.includes(p.id)) : [];

  const handleSave = () => {
    if (appointment) {
      onUpdate(editedApp);
      setIsEditing(false);
    }
  };

  const handleSaveAsImage = async () => {
    if (!modalRef.current) return;
    
    // Ensure we are at the top of the modal for capture
    const scrollContainer = modalRef.current.parentElement;
    if (scrollContainer) scrollContainer.scrollTop = 0;
    
    setIsCapturing(true);
    // Small delay to ensure UI updates (hiding buttons)
    setTimeout(async () => {
      try {
        const dataUrl = await domToJpeg(modalRef.current!, {
          quality: 0.95,
          scale: 3,
          features: {
            removeControlCharacter: true
          }
        });
        
        const blob = await (await fetch(dataUrl)).blob();
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'comprovante.jpg', { type: 'image/jpeg' })] })) {
          const file = new File([blob], `comprovante-${appointment?.id || calculation?.id || 'doc'}.jpg`, { type: 'image/jpeg' });
          await navigator.share({
            files: [file],
            title: 'Comprovante Leva Pet',
            text: `Comprovante para ${customer?.name || calculation?.customerName}`
          });
        } else {
          const link = document.createElement('a');
          link.download = `comprovante-${appointment?.id || calculation?.id || 'doc'}.jpg`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (err) {
        console.error('Error generating/sharing image:', err);
        alert('Erro ao gerar imagem. Tente novamente.');
      } finally {
        setIsCapturing(false);
      }
    }, 300);
  };

  const handleSaveAsPDF = async () => {
    if (!modalRef.current) return;
    
    const scrollContainer = modalRef.current.parentElement;
    if (scrollContainer) scrollContainer.scrollTop = 0;
    
    setIsCapturing(true);
    setTimeout(async () => {
      try {
        const imgData = await domToJpeg(modalRef.current!, {
          quality: 0.95,
          scale: 3
        });
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate dimensions to fit A4
        const imgProps = pdf.getImageProperties(imgData);
        const ratio = imgProps.width / imgProps.height;
        const width = pdfWidth;
        const height = pdfWidth / ratio;
        
        // If image is longer than A4, create a custom sized PDF to fit everything on one page
        if (height > pdfHeight) {
          const customPdf = new jsPDF('p', 'mm', [210, (210 / ratio)]);
          customPdf.addImage(imgData, 'JPEG', 0, 0, 210, (210 / ratio));
          customPdf.save(`comprovante-${appointment?.id || calculation?.id || 'doc'}.pdf`);
        } else {
          pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
          pdf.save(`comprovante-${appointment?.id || calculation?.id || 'doc'}.pdf`);
        }
      } catch (err) {
        console.error('Error generating PDF:', err);
        alert('Erro ao gerar PDF. Tente novamente.');
      } finally {
        setIsCapturing(false);
      }
    }, 300);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 bg-[#000000e6] ${!isCapturing ? 'backdrop-blur-md items-center' : 'items-start'} z-[300] flex justify-center p-4 overflow-y-auto`}
    >
      <motion.div 
        ref={modalRef}
        initial={{ scale: 0.9, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 50 }}
        className={`relative w-full max-w-xl bg-white text-black rounded-[20px] flex flex-col my-4 ${!isCapturing ? 'max-h-[95vh] overflow-hidden shadow-2xl' : 'max-h-none overflow-visible'}`}
      >
        {/* Letterhead Header */}
        <div className="bg-[#111111] p-6 flex items-center gap-4 border-b-4 border-[#D4AF37]">
          <img src={LOGO_URL} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
          <div>
            <h1 className="text-lg font-black text-[#D4AF37] leading-tight">Leva Pet Táxi Dog Rio Preto</h1>
            <p className="text-[10px] text-[#9ca3af] uppercase tracking-widest">Transporte com Amor e Segurança</p>
          </div>
        </div>

        {!isCapturing && (
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            <button 
              onClick={handleSaveAsImage}
              className="bg-[#00000033] hover:bg-[#0000004d] p-2 rounded-full text-white transition-colors"
              title="Salvar como Imagem"
            >
              <Image size={16} />
            </button>
            <button 
              onClick={handleSaveAsPDF}
              className="bg-[#00000033] hover:bg-[#0000004d] p-2 rounded-full text-white transition-colors"
              title="Salvar como PDF"
            >
              <FileDown size={16} />
            </button>
            <button onClick={onClose} className="bg-[#00000033] hover:bg-[#0000004d] p-2 rounded-full text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className={`p-8 space-y-8 ${!isCapturing ? 'flex-1 overflow-y-auto' : 'flex-none overflow-visible'}`}>
          <div className="text-center space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Comprovante de Agendamento</p>
            <p className="text-[10px] text-[#9ca3af]">ID: {appointment?.id || calculation?.id || '-'} • Gerado em {format(new Date(), "dd/MM/yyyy")}</p>
          </div>

          {isEditing ? (
            <div className="space-y-4 text-left bg-[#f9fafb] p-6 rounded-2xl border border-[#f3f4f6]">
              <h3 className="text-sm font-bold text-[#D4AF37] uppercase tracking-widest mb-2">Editar Agendamento</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#6b7280] uppercase font-bold">Data</label>
                  <input 
                    type="date" 
                    value={editedApp.dateTime.split('T')[0]}
                    onChange={(e) => {
                      const timePart = editedApp.dateTime.split('T')[1] || '00:00';
                      setEditedApp({...editedApp, dateTime: `${e.target.value}T${timePart}`});
                    }}
                    className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg p-2 text-sm outline-none focus:border-[#D4AF37]"
                  />
                  {editedApp.dateTime.split('T')[0] && (
                    <p className="text-[9px] text-[#D4AF37] font-bold px-1 capitalize">
                      {format(new Date(editedApp.dateTime.split('T')[0] + 'T12:00:00'), "EEEE", { locale: ptBR })}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#6b7280] uppercase font-bold">Horário</label>
                  <input 
                    type="time" 
                    value={editedApp.dateTime.split('T')[1]}
                    onChange={(e) => {
                      const datePart = editedApp.dateTime.split('T')[0] || format(new Date(), 'yyyy-MM-dd');
                      setEditedApp({...editedApp, dateTime: `${datePart}T${e.target.value}`});
                    }}
                    className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg p-2 text-sm outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[#6b7280] uppercase font-bold">Valor (R$)</label>
                <input 
                  type="number" 
                  value={editedApp.value}
                  onChange={(e) => setEditedApp({...editedApp, value: parseFloat(e.target.value) || 0})}
                  className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg p-2 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[#6b7280] uppercase font-bold">Tipo de Atendimento</label>
                <select 
                  value={editedApp.type}
                  onChange={(e) => setEditedApp({...editedApp, type: e.target.value})}
                  className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg p-2 text-sm outline-none focus:border-[#D4AF37]"
                >
                  {SERVICE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#6b7280] uppercase font-bold">Cidade Origem</label>
                  <input 
                    type="text" 
                    value={editedApp.originCity}
                    onChange={(e) => setEditedApp({...editedApp, originCity: e.target.value})}
                    className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg p-2 text-sm outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#6b7280] uppercase font-bold">Cidade Destino</label>
                  <input 
                    type="text" 
                    value={editedApp.destinationCity}
                    onChange={(e) => setEditedApp({...editedApp, destinationCity: e.target.value})}
                    className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg p-2 text-sm outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[#6b7280] uppercase font-bold">Endereço de Busca</label>
                <input 
                  type="text" 
                  value={editedApp.pickupAddress}
                  onChange={(e) => setEditedApp({...editedApp, pickupAddress: e.target.value})}
                  className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg p-2 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-[#6b7280] uppercase font-bold">Endereços de Destino</label>
                {editedApp.destinations.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <input 
                      type="text" 
                      value={d}
                      onChange={(e) => {
                        const updated = [...editedApp.destinations];
                        updated[i] = e.target.value;
                        setEditedApp({...editedApp, destinations: updated});
                      }}
                      className="flex-1 bg-[#ffffff] border border-[#e5e7eb] rounded-lg p-2 text-sm outline-none focus:border-[#D4AF37]"
                      placeholder={`Destino ${i + 1}`}
                    />
                    {i > 0 && (
                      <button onClick={() => setEditedApp({...editedApp, destinations: editedApp.destinations.filter((_, idx) => idx !== i)})} className="text-red-500"><X size={18}/></button>
                    )}
                  </div>
                ))}
                {editedApp.destinations.length < 3 && (
                  <button 
                    onClick={() => setEditedApp({...editedApp, destinations: [...editedApp.destinations, '']})}
                    className="text-[#D4AF37] text-[10px] uppercase font-bold flex items-center gap-1"
                  >
                    <Plus size={14} /> Adicionar Destino
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[#6b7280] uppercase font-bold">Observações</label>
                <textarea 
                  value={editedApp.observations}
                  onChange={(e) => setEditedApp({...editedApp, observations: e.target.value})}
                  className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg p-2 text-sm outline-none min-h-[60px] focus:border-[#D4AF37]"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setIsEditing(false)} className="flex-1 bg-[#f3f4f6] text-[#4b5563] py-2 rounded-lg font-bold text-sm">Cancelar</button>
                <button onClick={handleSave} className="flex-1 bg-[#D4AF37] text-[#000000] py-2 rounded-lg font-bold text-sm">Salvar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Cliente Info */}
              <div className="border-l-4 border-[#D4AF37] pl-4 py-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af] mb-1">Cliente</p>
                <p className="text-lg font-bold text-[#000000]">{customer?.name || calculation?.customerName || 'Não informado'}</p>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-1.5 text-[#4b5563] text-xs">
                    <Phone size={12} className="text-[#D4AF37]" />
                    <span>{customer?.phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#4b5563] text-xs">
                    <MapPin size={12} className="text-[#D4AF37]" />
                    <span>{customer?.address || customer?.city || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Pets (Only for Appointments) */}
              {appointment && (
                <div className="bg-[#f9fafb] p-4 rounded-2xl border border-[#f3f4f6]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af] mb-2">Pets no Transporte</p>
                  <div className="flex flex-wrap gap-2">
                    {appPets.length > 0 ? appPets.map(p => (
                      <span key={p.id} className="bg-[#ffffff] border border-[#e5e7eb] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                        <Dog size={12} className="text-[#D4AF37]" />
                        {p.name} ({p.size})
                      </span>
                    )) : <span className="text-xs text-[#9ca3af] italic">Nenhum pet selecionado</span>}
                  </div>
                </div>
              )}

              {/* Rota e Detalhes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Tipo de Atendimento</p>
                    <p className="text-sm font-bold text-[#000000]">{appointment ? (appointment.type || 'Transporte') : 'Orçamento'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Data e Horário</p>
                    <p className="text-sm font-bold text-[#000000]">
                      {appointment 
                        ? format(new Date(appointment.dateTime), "dd/MM/yyyy 'às' HH:mm")
                        : format(new Date(calculation!.timestamp), "dd/MM/yyyy 'às' HH:mm")
                      }
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Endereço de Busca</p>
                    <p className="text-sm font-bold text-[#000000] leading-tight">{appointment ? appointment.pickupAddress : (calculation as any).pickupAddress || '-'}</p>
                  </div>
                  {appointment?.destinations && appointment.destinations.filter(d => d).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Endereços de Destino</p>
                      <div className="space-y-1">
                        {appointment.destinations.filter(d => d).map((d, i) => (
                          <p key={i} className="text-sm font-bold text-[#000000] leading-tight flex items-start gap-1">
                            <ChevronRight size={14} className="text-[#D4AF37] mt-0.5" /> {d}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Detalhamento do Orçamento (Only for Budgets) */}
              {calculation && (
                <div className="bg-[#f9fafb] p-4 rounded-2xl border border-[#f3f4f6]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af] mb-3">Detalhamento do Orçamento</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#4b5563]">Distância ({calculation.distance} km)</span>
                      <span className="font-bold">R$ {((calculation.distance / 10) * calculation.fuelPrice).toFixed(2)}</span>
                    </div>
                    {calculation.carDays > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#4b5563]">Veículo ({calculation.carDays} diárias)</span>
                        <span className="font-bold">R$ {(calculation.carDays * calculation.carDailyRate).toFixed(2)}</span>
                      </div>
                    )}
                    {calculation.hotelDays > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#4b5563]">Hospedagem ({calculation.hotelDays} diárias)</span>
                        <span className="font-bold">R$ {(calculation.hotelDays * calculation.hotelRate).toFixed(2)}</span>
                      </div>
                    )}
                    {calculation.toll > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#4b5563]">Pedágio</span>
                        <span className="font-bold">R$ {calculation.toll.toFixed(2)}</span>
                      </div>
                    )}
                    {calculation.food > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#4b5563]">Alimentação</span>
                        <span className="font-bold">R$ {calculation.food.toFixed(2)}</span>
                      </div>
                    )}
                    {calculation.workHours > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#4b5563]">Trabalho ({calculation.workHours}h)</span>
                        <span className="font-bold">R$ {(calculation.workHours * 45).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Valor */}
              <div className="bg-[#111111] p-6 rounded-3xl text-center shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37] mb-1">Valor Total do Serviço</p>
                <p className="text-4xl font-black text-[#ffffff]">R$ {(appointment ? appointment.value : calculation!.total).toFixed(2)}</p>
              </div>

              {/* Observações */}
              {appointment?.observations && (
                <div className="border-t border-dashed border-[#e5e7eb] pt-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af] mb-2">Observações</p>
                  <p className="text-xs text-[#4b5563] italic leading-relaxed bg-[#f9fafb] p-4 rounded-xl border border-[#f3f4f6]">
                    "{appointment.observations}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isCapturing && !isEditing && (
          <div className="p-6 bg-[#f9fafb] border-t border-[#f3f4f6] flex gap-3">
            {appointment && (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-[#ffffff] border border-[#e5e7eb] text-[#374151] font-bold py-3 rounded-xl hover:bg-[#f3f4f6] transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Edit2 size={16} /> Editar
              </button>
            )}
            <button 
              onClick={handleSaveAsPDF}
              className="flex-1 bg-[#ffffff] border border-[#e5e7eb] text-[#374151] font-bold py-3 rounded-xl hover:bg-[#f3f4f6] transition-all flex items-center justify-center gap-2 text-xs"
            >
              <FileDown size={16} /> PDF
            </button>
            <button 
              onClick={handleSaveAsImage}
              className="flex-[2] bg-[#D4AF37] text-[#000000] font-bold py-3 rounded-xl shadow-md hover:bg-[#B8962E] transition-all flex items-center justify-center gap-2 text-xs"
            >
              <Share2 size={16} /> Compartilhar Recibo
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// --- Sub-Views ---

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center p-2 transition-colors ${active ? 'text-[#D4AF37]' : 'text-gray-500 hover:text-gray-300'}`}
    >
      {React.cloneElement(icon as React.ReactElement, { size: 24 })}
      <span className="text-[10px] mt-1 font-medium">{label}</span>
    </button>
  );
}

function HomeView({ 
  appointments, 
  calculations, 
  customers, 
  pets, 
  onDelete, 
  monthlyPackages,
  onRenewPackage,
  onCancelPackage
}: { 
  appointments: Appointment[], 
  calculations: Calculation[], 
  customers: Customer[], 
  pets: Pet[], 
  onDelete: (id: string) => void,
  monthlyPackages: MonthlyPackage[],
  onRenewPackage: (pkg: MonthlyPackage, nextValue: number, extraDiscount: number) => void,
  onCancelPackage: (docId: string) => void
}) {
  const [activeRange, setActiveRange] = useState<'day' | 'week' | 'month'>('day');
  const [loyaltyModalCustomer, setLoyaltyModalCustomer] = useState<Customer | null>(null);
  const [loyaltySearch, setLoyaltySearch] = useState('');
  const [packageRenewalModal, setPackageRenewalModal] = useState<{ isOpen: boolean, pkg: MonthlyPackage | null }>({ isOpen: false, pkg: null });

  const monthlyPackagesToRenew = useMemo(() => {
    const startOfCurrentMonth = startOfMonth(new Date());
    return monthlyPackages.filter(pkg => {
      // If package expired (e.g. was for last month) and not yet renewed for this month
      const pkgDate = new Date(pkg.startDate);
      const isOld = pkgDate < startOfCurrentMonth;
      return isOld && pkg.status === 'Ativo';
    });
  }, [monthlyPackages]);

  const now = new Date();
  const ranges = {
    day: { start: startOfDay(now), end: endOfDay(now) },
    week: { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) },
    month: { start: startOfMonth(now), end: endOfMonth(now) }
  };

  const getPendingCount = (range: 'day' | 'week' | 'month') => {
    return appointments.filter(a => {
      const date = new Date(a.dateTime);
      return a.status === 'Pendente' && isWithinInterval(date, ranges[range]);
    }).length;
  };

  const currentDisplayAppointments = appointments
    .filter(a => {
      const date = new Date(a.dateTime);
      return isWithinInterval(date, ranges[activeRange]);
    })
    .sort((a, b) => a.dateTime.localeCompare(b.dateTime));

  const stats = useMemo(() => {
    const paidApps = appointments.filter(a => a.status === 'Pago');
    const totalReceived = paidApps.reduce((acc, curr) => acc + (curr.value - (curr.discount || 0)), 0);
    const totalKm = paidApps.reduce((acc, curr) => acc + (curr.totalKm || 0), 0);
    return { totalReceived, totalKm };
  }, [appointments]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Package Renewal Alert */}
      {monthlyPackagesToRenew.length > 0 && (
        <div className="space-y-3">
          {monthlyPackagesToRenew.map(pkg => (
            <motion.button 
              key={pkg.docId}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              onClick={() => setPackageRenewalModal({ isOpen: true, pkg })}
              className="w-full bg-[#ef444433] border border-[#ef444466] p-4 rounded-2xl flex items-center justify-between group hover:bg-[#ef44444d] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-red-500 p-2 rounded-full text-white">
                  <AlertTriangle size={20} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-red-100 uppercase tracking-widest leading-none mb-1">Pendente de Atualização</p>
                  <p className="text-sm font-bold text-white">Pacote Mensal: {pkg.customerName}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-red-400 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          ))}
        </div>
      )}

      {/* Header Summary Buttons */}
      <div className="grid grid-cols-3 gap-3">
        {(['day', 'week', 'month'] as const).map(range => (
          <button 
            key={range}
            onClick={() => setActiveRange(range)}
            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
              activeRange === range 
                ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-[0_10px_20px_rgba(212,175,55,0.2)]' 
                : 'bg-[#111] border-[#ffffff0d] text-gray-500 hover:border-[#D4AF3733]'
            }`}
          >
            <span className="text-[8px] font-black uppercase tracking-widest opacity-60">
              {range === 'day' ? 'Hoje' : range === 'week' ? 'Semana' : 'Mês'}
            </span>
            <span className="text-xl font-black">{getPendingCount(range)}</span>
            <span className="text-[8px] font-bold uppercase">Pendentes</span>
          </button>
        ))}
      </div>

      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-6 rounded-2xl border border-[#D4AF3733]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#D4AF37]">Painel Administrativo</h2>
            <p className="text-gray-400 text-xs">Acompanhamento em tempo real</p>
          </div>
          <div className="grid grid-cols-2 sm:flex gap-3">
            <div className="bg-black/40 px-4 py-2 rounded-xl border border-[#ffffff0d]">
              <p className="text-[8px] text-gray-600 uppercase font-black">Já Recebido</p>
              <p className="text-sm font-black text-white">R$ {stats.totalReceived.toFixed(2)}</p>
            </div>
            <div className="bg-black/40 px-4 py-2 rounded-xl border border-[#ffffff0d]">
              <p className="text-[8px] text-gray-600 uppercase font-black">Km Rodado</p>
              <p className="text-sm font-black text-white">{stats.totalKm.toFixed(1)} km</p>
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
            <input 
              type="text"
              placeholder="Buscar cliente para ver cartão fidelidade..."
              className="w-full bg-black/40 border border-[#ffffff0d] rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#D4AF374d]"
              value={loyaltySearch}
              onChange={e => setLoyaltySearch(e.target.value)}
            />
            {loyaltySearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#ffffff1a] rounded-xl overflow-hidden z-[100] shadow-2xl">
                {customers
                  .filter(c => c.name.toLowerCase().includes(loyaltySearch.toLowerCase()) || c.id.includes(loyaltySearch))
                  .slice(0, 5)
                  .map(c => (
                    <button 
                      key={c.docId}
                      onClick={() => {
                        setLoyaltyModalCustomer(c);
                        setLoyaltySearch('');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-[#D4AF371a] border-b border-[#ffffff0d] last:border-0 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{c.name}</p>
                        <p className="text-[10px] text-gray-500">{c.id} • {c.phone}</p>
                      </div>
                      <ChevronRight size={16} className="text-[#D4AF37]" />
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-[#D4AF37] flex items-center gap-2">
          <Clock size={16} />
          {activeRange === 'day' ? 'Atendimentos do Dia' : activeRange === 'week' ? 'Atendimentos da Semana' : 'Atendimentos do Mês'}
        </h3>
        <span className="text-[10px] font-bold text-gray-600">{currentDisplayAppointments.length} registrados</span>
      </div>

      <div className="space-y-3">
        {currentDisplayAppointments.length === 0 ? (
          <div className="text-center py-12 bg-[#111] rounded-2xl border border-dashed border-[#ffffff0d]">
            <Calendar className="mx-auto text-gray-800 mb-3" size={40} />
            <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">Vazio por aqui...</p>
          </div>
        ) : (
          currentDisplayAppointments.map(app => {
            const customer = customers.find(c => c.docId === app.customerId);
            return (
              <div 
                key={app.docId} 
                className="group bg-[#111] p-4 rounded-2xl border border-[#ffffff0d] hover:border-[#D4AF3733] transition-all flex items-center justify-between shadow-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-black/40 border border-[#ffffff05] group-hover:bg-[#D4AF3712] transition-colors">
                    <span className="text-[9px] font-black uppercase leading-none opacity-40">{format(new Date(app.dateTime), 'eee', { locale: ptBR })}</span>
                    <span className="text-lg font-black">{format(new Date(app.dateTime), 'dd')}</span>
                    <span className="text-[9px] font-black text-[#D4AF37]">{format(new Date(app.dateTime), 'HH:mm')}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-[#D4AF37] transition-colors">{customer?.name || 'Cliente...'}</h4>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      {app.type} 
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ml-1 ${
                        app.status === 'Pago' ? 'bg-green-500 text-black' :
                        app.status === 'Atendido' ? 'bg-[#22c55e22] text-green-500' :
                        app.status === 'Cancelado' ? 'bg-red-500/20 text-red-500' :
                        'bg-[#eab30822] text-yellow-500'
                      }`}>
                        {app.status}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onDelete(app.docId)}
                    className="p-2 text-red-500/40 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={18} className="text-[#D4AF37]" />
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {loyaltyModalCustomer && (
          <div className="fixed inset-0 bg-[#000000e6] backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#050505] rounded-[40px] border border-[#D4AF3733] overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.15)]">
              <div className="p-6 border-b border-[#ffffff0d] flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Cartão Fidelidade Digital</span>
                <button onClick={() => setLoyaltyModalCustomer(null)} className="p-2 bg-[#111] rounded-full text-white"><X size={20} /></button>
              </div>
              <div className="p-8">
                <LoyaltyCard customer={loyaltyModalCustomer} pets={pets} appointments={appointments} />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <PackageRenewalModal 
        isOpen={packageRenewalModal.isOpen} 
        onClose={() => setPackageRenewalModal({ isOpen: false, pkg: null })}
        pkg={packageRenewalModal.pkg}
        onRenew={(p, val, disc) => {
          onRenewPackage(p, val, disc);
          setPackageRenewalModal({ isOpen: false, pkg: null });
        }}
        onCancel={(id) => {
          onCancelPackage(id);
          setPackageRenewalModal({ isOpen: false, pkg: null });
        }}
      />
    </motion.div>
  );
}

function PackageRenewalModal({ 
  isOpen, 
  onClose, 
  pkg, 
  onRenew, 
  onCancel 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  pkg: MonthlyPackage | null,
  onRenew: (pkg: MonthlyPackage, nextValue: number, extraDiscount: number) => void,
  onCancel: (docId: string) => void
}) {
  const [extraDiscount, setExtraDiscount] = useState(0);

  useEffect(() => {
    if (pkg) setExtraDiscount(pkg.extraDiscount || 0);
  }, [pkg]);

  if (!isOpen || !pkg) return null;

  const nextValue = pkg.totalValue - pkg.abatementAmount - extraDiscount;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-all"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-[#121212] w-full max-w-sm rounded-[32px] border border-[#D4AF374d] p-8 shadow-[0_0_50px_rgba(212,175,55,0.2)]"
        >
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-[#D4AF371a] rounded-full flex items-center justify-center mx-auto text-[#D4AF37]">
              <Calendar size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Renovação de Pacote</h3>
              <p className="text-gray-400 text-xs mt-1">{pkg.customerName}</p>
            </div>

            <div className="bg-[#00000066] p-4 rounded-2xl border border-[#ffffff0d] text-left space-y-3">
              <div className="flex justify-between text-[10px] text-gray-500 uppercase font-black">
                <span>Valor Base</span>
                <span className="text-white">R$ {pkg.totalValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-red-400 uppercase font-black">
                <span>Abatimento (Faltas)</span>
                <span>- R$ {pkg.abatementAmount.toFixed(2)}</span>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-black block mb-1">Desconto Avulso (R$)</label>
                <input 
                  type="number"
                  className="w-full bg-black border border-[#ffffff1a] rounded-lg p-2 text-xs text-white outline-none focus:border-[#D4AF37]"
                  value={extraDiscount}
                  onChange={e => setExtraDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="border-t border-[#ffffff0d] pt-3 flex justify-between items-center">
                <span className="text-xs font-black text-[#D4AF37] uppercase">Total Próximo Mês</span>
                <span className="text-xl font-black text-white">R$ {nextValue.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-4">
              <button 
                onClick={() => onRenew(pkg, nextValue, extraDiscount)}
                className="w-full bg-[#D4AF37] text-black py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_20px_rgba(212,175,55,0.2)]"
              >
                Renovar Pacote
              </button>
              <button 
                onClick={() => onCancel(pkg.docId)}
                className="w-full bg-[#ef44441a] text-[#ef4444] py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-[#ef444433] transition-all"
              >
                Cancelar Pacote
              </button>
              <button 
                onClick={onClose}
                className="w-full text-gray-500 py-2 text-[10px] uppercase font-bold hover:text-white"
              >
                Decidir Depois
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
function CustomersView({ 
  user, 
  customers, 
  pets, 
  partners, 
  appointments,
  getPhoneDuplicate
}: { 
  user: User, 
  customers: Customer[], 
  pets: Pet[], 
  partners: Partner[],
  appointments: Appointment[],
  getPhoneDuplicate: (phone: string, skipId?: string) => { docId: string, name: string, type: string } | null
}) {
  const [subTab, setSubTab] = useState<'customers' | 'partners'>('customers');
  const [isAdding, setIsAdding] = useState(() => localStorage.getItem('levapet_customer_isAdding') === 'true');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(() => {
    const saved = localStorage.getItem('levapet_customer_editing');
    return saved ? JSON.parse(saved) : null;
  });
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newCustomer, setNewCustomer] = useState(() => {
    const saved = localStorage.getItem('levapet_customer_draft');
    return saved ? JSON.parse(saved) : { name: '', phone: '', city: 'São José do Rio Preto', address: '', partnerId: '' };
  });
  const [newPartner, setNewPartner] = useState({ name: '', phone: '', address: '', observations: '' });
  const [newPets, setNewPets] = useState<any[]>(() => {
    const saved = localStorage.getItem('levapet_customer_pets_draft');
    return saved ? JSON.parse(saved) : [{ name: '', size: 'Médio' as const, breed: '' }];
  });
  
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, id: string | null, type: 'customer' | 'partner' }>({ isOpen: false, id: null, type: 'customer' });
  const [confirmConvert, setConfirmConvert] = useState<{ isOpen: boolean, data: any, type: 'toPartner' | 'toCustomer' }>({ isOpen: false, data: null, type: 'toPartner' });
  const [loyaltyModalCustomer, setLoyaltyModalCustomer] = useState<Customer | null>(null);

  // Persistence

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm) || 
    c.id.includes(searchTerm)
  );

  const filteredPartners = partners.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.phone.includes(searchTerm)
  );

  const handleAddPartner = async () => {
    if (!newPartner.name || !newPartner.phone) return;

    const duplicate = getPhoneDuplicate(newPartner.phone, editingPartner?.docId);
    if (duplicate) {
      if (window.confirm(`O telefone ${newPartner.phone} já está cadastrado para ${duplicate.name} (${duplicate.type}). Deseja deletar o cadastro anterior para evitar duplicidade?`)) {
        if (duplicate.type === 'Cliente') await handleDeleteCustomer(duplicate.docId);
        else await handleDeletePartner(duplicate.docId);
      } else {
        return;
      }
    }

    try {
      if (editingPartner) {
        await updateDoc(doc(db, 'partners', editingPartner.docId), {
          ...newPartner
        });
      } else {
        const code = `P${Math.floor(100000 + Math.random() * 900000)}`;
        await addDoc(collection(db, 'partners'), {
          ...newPartner,
          id: code,
          uid: user.uid
        });
      }
      
      setIsAdding(false);
      setEditingPartner(null);
      setNewPartner({ name: '', phone: '', address: '', observations: '' });
    } catch (e) {
      handleFirestoreError(e, editingPartner ? OperationType.UPDATE : OperationType.CREATE, 'partners');
    }
  };

  const handleEditPartner = (partner: Partner) => {
    setEditingPartner(partner);
    setNewPartner({
      name: partner.name,
      phone: partner.phone,
      address: partner.address,
      observations: partner.observations
    });
    setIsAdding(true);
  };

  const handleDeletePartner = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'partners', docId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'partners');
    }
  };

  const handleConvertCustomerToPartner = async (customer: Customer) => {
    const duplicate = getPhoneDuplicate(customer.phone, customer.docId);
    if (duplicate) {
      if (window.confirm(`Este telefone já está cadastrado para ${duplicate.name} (${duplicate.type}). Deseja deletar o cadastro anterior para evitar duplicidade na conversão?`)) {
        if (duplicate.type === 'Cliente') await handleDeleteCustomer(duplicate.docId);
        else await handleDeletePartner(duplicate.docId);
      } else {
        return;
      }
    }

    try {
      const code = `P${Math.floor(100000 + Math.random() * 900000)}`;
      await addDoc(collection(db, 'partners'), {
        name: customer.name,
        phone: customer.phone,
        address: `${customer.address}, ${customer.city}`,
        observations: 'Convertido de Cliente',
        id: code,
        uid: user.uid
      });
      await deleteDoc(doc(db, 'customers', customer.docId));
      const customerPets = pets.filter(p => p.customerId === customer.docId);
      for (const pet of customerPets) {
        await deleteDoc(doc(db, 'pets', pet.id));
      }
      setIsAdding(false);
      setEditingCustomer(null);
      setSubTab('partners');
      alert("Cliente convertido em Parceiro com sucesso!");
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'partners');
    }
  };

  const handleConvertPartnerToCustomer = async (partner: Partner) => {
    const duplicate = getPhoneDuplicate(partner.phone, partner.docId);
    if (duplicate) {
      if (window.confirm(`Este telefone já está cadastrado para ${duplicate.name} (${duplicate.type}). Deseja deletar o cadastro anterior para evitar duplicidade na conversão?`)) {
        if (duplicate.type === 'Cliente') await handleDeleteCustomer(duplicate.docId);
        else await handleDeletePartner(duplicate.docId);
      } else {
        return;
      }
    }

    try {
      const code = `C${Math.floor(100000 + Math.random() * 900000)}`;
      await addDoc(collection(db, 'customers'), {
        name: partner.name,
        phone: partner.phone,
        city: 'São José do Rio Preto',
        address: partner.address,
        id: code,
        uid: user.uid,
        loyaltyCount: 0,
        loyaltyRewardAvailable: false
      });
      await deleteDoc(doc(db, 'partners', partner.docId));
      setIsAdding(false);
      setEditingPartner(null);
      setSubTab('customers');
      alert("Parceiro convertido em Cliente com sucesso!");
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'customers');
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) return;

    const duplicate = getPhoneDuplicate(newCustomer.phone, editingCustomer?.docId);
    if (duplicate) {
      if (window.confirm(`O telefone ${newCustomer.phone} já está cadastrado para ${duplicate.name} (${duplicate.type}). Deseja deletar o cadastro anterior para evitar duplicidade?`)) {
        if (duplicate.type === 'Cliente') await handleDeleteCustomer(duplicate.docId);
        else await handleDeletePartner(duplicate.docId);
      } else {
        return;
      }
    }

    try {
      let customerDocId = '';
      if (editingCustomer) {
        customerDocId = editingCustomer.docId;
        await updateDoc(doc(db, 'customers', customerDocId), {
          ...newCustomer
        });
        
        const existingPets = pets.filter(p => p.customerId === customerDocId);
        
        for (const pet of newPets) {
          if (pet.name) {
            if ((pet as any).id) {
              await updateDoc(doc(db, 'pets', (pet as any).id), {
                name: pet.name,
                size: pet.size,
                breed: pet.breed
              });
            } else {
              await addDoc(collection(db, 'pets'), {
                ...pet,
                customerId: customerDocId,
                uid: user.uid
              });
            }
          }
        }
        
        const newPetIds = newPets.map(p => (p as any).id).filter(id => id);
        for (const existingPet of existingPets) {
          if (!newPetIds.includes(existingPet.id)) {
            await deleteDoc(doc(db, 'pets', existingPet.id));
          }
        }

      } else {
        const code = `C${Math.floor(100000 + Math.random() * 900000)}`;
        const customerDoc = await addDoc(collection(db, 'customers'), {
          ...newCustomer,
          id: code,
          uid: user.uid,
          loyaltyCount: 0,
          loyaltyRewardAvailable: false
        });
        customerDocId = customerDoc.id;

        for (const pet of newPets) {
          if (pet.name) {
            await addDoc(collection(db, 'pets'), {
              ...pet,
              customerId: customerDocId,
              uid: user.uid
            });
          }
        }
      }
      
      // Clear drafts
      localStorage.removeItem('levapet_customer_draft');
      localStorage.removeItem('levapet_customer_pets_draft');
      localStorage.removeItem('levapet_customer_isAdding');
      localStorage.removeItem('levapet_customer_editing');
      
      setIsAdding(false);
      setEditingCustomer(null);
      setNewCustomer({ name: '', phone: '', city: 'São José do Rio Preto', address: '' });
      setNewPets([{ name: '', size: 'Médio', breed: '' }]);
    } catch (e) {
      handleFirestoreError(e, editingCustomer ? OperationType.UPDATE : OperationType.CREATE, 'customers');
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setNewCustomer({
      name: customer.name,
      phone: customer.phone,
      city: customer.city,
      address: customer.address,
      partnerId: customer.partnerId || ''
    });
    const customerPets = pets.filter(p => p.customerId === customer.docId);
    setNewPets(customerPets.length > 0 ? customerPets.map(p => ({ 
      id: p.id, 
      name: p.name, 
      size: p.size, 
      breed: p.breed 
    })) : [{ name: '', size: 'Médio', breed: '' }]);
    setIsAdding(true);
  };

  const handleDeleteCustomer = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'customers', docId));
      const customerPets = pets.filter(p => p.customerId === docId);
      for (const pet of customerPets) {
        await deleteDoc(doc(db, 'pets', pet.id));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'customers');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex bg-[#111] p-1 rounded-xl border border-[#ffffff1a]">
          <button 
            onClick={() => setSubTab('customers')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${subTab === 'customers' ? 'bg-[#D4AF37] text-black' : 'text-gray-500'}`}
          >
            Clientes
          </button>
          <button 
            onClick={() => setSubTab('partners')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${subTab === 'partners' ? 'bg-[#D4AF37] text-black' : 'text-gray-500'}`}
          >
            Parceiros
          </button>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-[#D4AF37] text-black p-2 rounded-full hover:scale-110 transition-transform"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <input 
          type="text" 
          placeholder={subTab === 'customers' ? "Buscar por nome, telefone ou código..." : "Buscar parceiro..."} 
          className="w-full bg-[#111] border border-[#ffffff1a] rounded-xl py-3 pl-10 pr-4 focus:border-[#D4AF37] outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {subTab === 'customers' ? (
          filteredCustomers.map(c => (
            <div key={c.docId} className="bg-[#111] p-4 rounded-xl border border-[#ffffff0d]">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] bg-[#D4AF3733] text-[#D4AF37] px-2 py-0.5 rounded uppercase font-bold">{c.id}</span>
                  <h4 className="text-lg font-bold mt-1">{c.name}</h4>
                  <p className="text-sm text-gray-400">{c.phone}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin size={12} /> {c.address}, {c.city}
                  </p>
                  {c.partnerId && (
                    <p className="text-[10px] text-[#D4AF37] mt-2 flex items-center gap-1 font-bold">
                      <Handshake size={12} /> Parceiro: {partners.find(p => p.docId === c.partnerId)?.name || 'N/A'}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button 
                      onClick={() => setLoyaltyModalCustomer(c)}
                      className="bg-[#D4AF3722] text-[#D4AF37] text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1 hover:bg-[#D4AF3744]"
                    >
                      <FileText size={12} /> CARTÃO FIDELIDADE
                    </button>
                    {c.loyaltyRewardAvailable && (
                      <span className="bg-green-500 text-black text-[10px] px-2 py-1 rounded-lg font-black animate-pulse">
                        50% OFF DISPONÍVEL
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEditCustomer(c)} className="text-[#D4AF3780] hover:text-[#D4AF37] p-2">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => setConfirmDelete({ isOpen: true, id: c.docId, type: 'customer' })} className="text-[#ef444480] hover:text-red-500 p-2">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-[#ffffff0d]">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Pets Cadastrados</p>
                <div className="flex flex-wrap gap-2">
                  {pets.filter(p => p.customerId === c.docId).map(p => (
                    <span key={p.id} className="bg-[#ffffff0d] px-3 py-1 rounded-full text-xs flex items-center gap-1">
                      <Dog size={12} className="text-[#D4AF37]" />
                      {p.name} ({p.size})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          filteredPartners.map(p => (
            <div key={p.docId} className="bg-[#111] p-4 rounded-xl border border-[#ffffff0d]">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] bg-[#D4AF3733] text-[#D4AF37] px-2 py-0.5 rounded uppercase font-bold">{p.id}</span>
                  <h4 className="text-lg font-bold mt-1">{p.name}</h4>
                  <p className="text-sm text-gray-400">{p.phone}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin size={12} /> {p.address}
                  </p>
                  {p.observations && (
                    <p className="text-xs text-gray-500 mt-2 italic">
                      Obs: {p.observations}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEditPartner(p)} className="text-[#D4AF3780] hover:text-[#D4AF37] p-2">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => setConfirmDelete({ isOpen: true, id: p.docId, type: 'partner' })} className="text-[#ef444480] hover:text-red-500 p-2">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#000000cc] backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#121212] w-full max-w-md rounded-[20px] border border-[#D4AF374d] p-6 max-h-[90vh] overflow-y-auto shadow-[0_0_20px_rgba(212,175,55,0.2)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#D4AF37]">
                  {subTab === 'customers' 
                    ? (editingCustomer ? 'Editar Cliente' : 'Novo Cliente')
                    : (editingPartner ? 'Editar Parceiro' : 'Novo Parceiro')
                  }
                </h3>
                <button onClick={() => { setIsAdding(false); setEditingCustomer(null); setEditingPartner(null); }} className="text-gray-500"><X /></button>
              </div>

              {subTab === 'customers' ? (
                <div className="space-y-4">
                  {editingCustomer && (
                    <div className="bg-[#D4AF371a] p-3 rounded-xl border border-[#D4AF3733] flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#D4AF37]">Mudar Tipo de Cadastro</p>
                        <p className="text-[10px] text-gray-500">Transformar este cliente em um parceiro</p>
                      </div>
                      <button 
                        onClick={() => setConfirmConvert({ isOpen: true, data: editingCustomer, type: 'toPartner' })}
                        className="bg-[#D4AF37] text-black text-[10px] px-3 py-1.5 rounded-lg font-bold hover:bg-[#B8962E] transition-colors"
                      >
                        CONVERTER
                      </button>
                    </div>
                  )}
                  <Input label="Nome Completo" value={newCustomer.name} onChange={v => setNewCustomer({...newCustomer, name: v})} />
                  <Input label="Telefone" value={newCustomer.phone} onChange={v => setNewCustomer({...newCustomer, phone: v})} />
                  {(() => {
                    const duplicate = getPhoneDuplicate(newCustomer.phone, editingCustomer?.docId);
                    return duplicate ? (
                      <p className="text-[10px] text-red-500 font-bold -mt-3 mb-1 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                        ⚠️ Este telefone já pertence ao {duplicate.type}: {duplicate.name}
                      </p>
                    ) : null;
                  })()}
                  <Input label="Cidade" value={newCustomer.city} onChange={v => setNewCustomer({...newCustomer, city: v})} />
                  <Input label="Endereço de Busca" value={newCustomer.address} onChange={v => setNewCustomer({...newCustomer, address: v})} />
                  
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Parceiro (Opcional)</label>
                    <select 
                      className="w-full bg-black border border-[#ffffff1a] rounded-lg p-2 text-sm outline-none"
                      value={newCustomer.partnerId}
                      onChange={e => setNewCustomer({...newCustomer, partnerId: e.target.value})}
                    >
                      <option value="">Nenhum</option>
                      {partners.map(p => <option key={p.docId} value={p.docId}>{p.name}</option>)}
                    </select>
                  </div>

                  <div className="pt-4 border-t border-[#ffffff0d]">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-bold">Pets</p>
                    <button 
                      onClick={() => setNewPets([...newPets, { name: '', size: 'Médio', breed: '' }])}
                      className="text-[#D4AF37] text-xs flex items-center gap-1"
                    >
                      <Plus size={14} /> Adicionar Pet
                    </button>
                  </div>
                  
                  {newPets.map((pet, idx) => (
                    <div key={idx} className="bg-[#00000066] p-3 rounded-lg border border-[#ffffff0d] mb-3 relative">
                      {newPets.length > 1 && (
                        <button onClick={() => setNewPets(newPets.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-gray-600"><X size={14}/></button>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="Nome" value={pet.name} onChange={v => {
                          const updated = [...newPets];
                          updated[idx].name = v;
                          setNewPets(updated);
                        }} />
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-500 uppercase">Porte</label>
                          <select 
                            className="w-full bg-black border border-[#ffffff1a] rounded-lg p-2 text-sm outline-none"
                            value={pet.size}
                            onChange={e => {
                              const updated = [...newPets];
                              updated[idx].size = e.target.value as any;
                              setNewPets(updated);
                            }}
                          >
                            <option>Pequeno</option>
                            <option>Médio</option>
                            <option>Grande</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Input label="Raça" value={pet.breed} onChange={v => {
                          const updated = [...newPets];
                          updated[idx].breed = v;
                          setNewPets(updated);
                        }} />
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={handleAddCustomer}
                  className="w-full bg-[#D4AF37] text-black font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2"
                >
                  <Save size={20} /> {editingCustomer ? 'Atualizar Cliente' : 'Salvar Cliente'}
                </button>
              </div>
              ) : (
                <div className="space-y-4">
                  {editingPartner && (
                    <div className="bg-[#D4AF371a] p-3 rounded-xl border border-[#D4AF3733] flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#D4AF37]">Mudar Tipo de Cadastro</p>
                        <p className="text-[10px] text-gray-500">Transformar este parceiro em um cliente</p>
                      </div>
                      <button 
                        onClick={() => setConfirmConvert({ isOpen: true, data: editingPartner, type: 'toCustomer' })}
                        className="bg-[#D4AF37] text-black text-[10px] px-3 py-1.5 rounded-lg font-bold hover:bg-[#B8962E] transition-colors"
                      >
                        CONVERTER
                      </button>
                    </div>
                  )}
                  <Input label="Nome do Parceiro" value={newPartner.name} onChange={v => setNewPartner({...newPartner, name: v})} />
                  <Input label="Telefone" value={newPartner.phone} onChange={v => setNewPartner({...newPartner, phone: v})} />
                  {(() => {
                    const duplicate = getPhoneDuplicate(newPartner.phone, editingPartner?.docId);
                    return duplicate ? (
                      <p className="text-[10px] text-red-500 font-bold -mt-3 mb-1 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                        ⚠️ Este telefone já pertence ao {duplicate.type}: {duplicate.name}
                      </p>
                    ) : null;
                  })()}
                  <Input label="Endereço" value={newPartner.address} onChange={v => setNewPartner({...newPartner, address: v})} />
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Observação</label>
                    <textarea 
                      className="w-full bg-black border border-[#ffffff1a] rounded-lg p-2 text-sm outline-none min-h-[80px]"
                      value={newPartner.observations}
                      onChange={e => setNewPartner({...newPartner, observations: e.target.value})}
                    />
                  </div>
                  <button 
                    onClick={handleAddPartner}
                    className="w-full bg-[#D4AF37] text-black font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2"
                  >
                    <Save size={20} /> {editingPartner ? 'Atualizar Parceiro' : 'Salvar Parceiro'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, id: null, type: 'customer' })}
        onConfirm={() => {
          if (confirmDelete.id) {
            if (confirmDelete.type === 'customer') handleDeleteCustomer(confirmDelete.id);
            else handleDeletePartner(confirmDelete.id);
          }
        }}
        title={confirmDelete.type === 'customer' ? "Excluir Cliente" : "Excluir Parceiro"}
        message={`Tem certeza que deseja excluir este ${confirmDelete.type === 'customer' ? 'cliente' : 'parceiro'}? Esta ação não pode ser desfeita.`}
      />

      <ConfirmationModal 
        isOpen={confirmConvert.isOpen}
        onClose={() => setConfirmConvert({ isOpen: false, data: null, type: 'toPartner' })}
        onConfirm={() => {
          if (confirmConvert.data) {
            if (confirmConvert.type === 'toPartner') handleConvertCustomerToPartner(confirmConvert.data);
            else handleConvertPartnerToCustomer(confirmConvert.data);
          }
        }}
        title="Confirmar Conversão"
        message={confirmConvert.type === 'toPartner' 
          ? "Deseja converter este Cliente em Parceiro? Os dados do cliente serão movidos e os pets cadastrados serão excluídos."
          : "Deseja converter este Parceiro em Cliente? Você poderá cadastrar pets para ele após a conversão."
        }
        confirmText="Converter"
        variant="warning"
      />

      <LoyaltyModal 
        isOpen={!!loyaltyModalCustomer}
        onClose={() => setLoyaltyModalCustomer(null)}
        customer={loyaltyModalCustomer}
        pets={pets}
        appointments={appointments}
      />
    </motion.div>
  );
}

function AppointmentsView({ 
  user, 
  customers, 
  pets, 
  appointments, 
  onDelete, 
  onViewAppointment,
  monthlyPackages
}: { 
  user: User, 
  customers: Customer[], 
  pets: Pet[], 
  appointments: Appointment[], 
  onDelete: (id: string) => void,
  onViewAppointment: (app: Appointment) => void,
  monthlyPackages: MonthlyPackage[]
}) {
  const [isAdding, setIsAdding] = useState(() => localStorage.getItem('levapet_app_isAdding') === 'true');
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(() => {
    const saved = localStorage.getItem('levapet_app_editing');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => localStorage.getItem('levapet_app_customerId') || '');
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('levapet_app_petIds');
    return saved ? JSON.parse(saved) : [];
  });
  const [newApp, setNewApp] = useState(() => {
    const saved = localStorage.getItem('levapet_app_draft');
    return saved ? JSON.parse(saved) : {
      dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      originCity: '',
      destinationCity: '',
      city: 'São José do Rio Preto',
      pickupAddress: '',
      destinations: [''],
      type: 'Clínica Veterinária',
      value: 0,
      totalKm: 0,
      status: 'Pendente' as 'Pendente' | 'Atendido' | 'Pago' | 'Cancelado' | 'Recusado' | 'Rota Compartilhada',
      discount: 0,
      observations: ''
    };
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState<'day' | 'week' | 'month'>('day');

  const now = new Date();
  const ranges = {
    day: { start: startOfDay(now), end: endOfDay(now) },
    week: { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) },
    month: { start: startOfMonth(now), end: endOfMonth(now) }
  };

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter(app => {
        const date = new Date(app.dateTime);
        const withinRange = isWithinInterval(date, ranges[activeFilter]);
        const customer = customers.find(c => c.docId === app.customerId);
        
        const unifiedSearch = searchTerm.toLowerCase();
        const matchSearch = !searchTerm || (
          (customer?.name || '').toLowerCase().includes(unifiedSearch) ||
          (customer?.id || '').toLowerCase().includes(unifiedSearch) ||
          (customer?.phone || '').includes(unifiedSearch)
        );
        const matchStatus = statusFilter === 'all' || app.status === statusFilter;

        return withinRange && matchSearch && matchStatus;
      })
      .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  }, [appointments, activeFilter, searchTerm, statusFilter, customers]);

  const showList = searchTerm || statusFilter !== 'all' || isAdding;

  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, appointmentId: string | null }>({ isOpen: false, appointmentId: null });
  const [loyaltyModalCustomer, setLoyaltyModalCustomer] = useState<Customer | null>(null);
  const [useManualPetCount, setUseManualPetCount] = useState(false);
  const [manualPetCount, setManualPetCount] = useState(1);

  const [isPackage, setIsPackage] = useState(false);
  const [pkgDays, setPkgDays] = useState(20);
  const [pkgValue, setPkgValue] = useState(0);
  const [pkgExtraDiscount, setPkgExtraDiscount] = useState(0);

  // Persistence
  useEffect(() => {
    localStorage.setItem('levapet_app_draft', JSON.stringify(newApp));
    localStorage.setItem('levapet_app_customerId', selectedCustomerId);
    localStorage.setItem('levapet_app_petIds', JSON.stringify(selectedPetIds));
    localStorage.setItem('levapet_app_isAdding', isAdding.toString());
    localStorage.setItem('levapet_app_editing', JSON.stringify(editingAppointment));
  }, [newApp, selectedCustomerId, selectedPetIds, isAdding, editingAppointment]);

  const selectedCustomer = customers.find(c => c.docId === selectedCustomerId);
  const customerPets = pets.filter(p => p.customerId === selectedCustomerId);

  useEffect(() => {
    if (selectedCustomer && !editingAppointment) {
      setNewApp(prev => ({ ...prev, pickupAddress: selectedCustomer.address, city: selectedCustomer.city }));
      // Automatically select all pets for this customer
      const ids = pets.filter(p => p.customerId === selectedCustomerId).map(p => p.id);
      setSelectedPetIds(ids);
    }
  }, [selectedCustomer, editingAppointment, pets, selectedCustomerId]);

  const handleAddAppointment = async () => {
    if (!selectedCustomerId) {
      alert("Por favor, selecione um cliente.");
      return;
    }
    if (!useManualPetCount && selectedPetIds.length === 0) {
      alert("Por favor, selecione pelo menos um pet.");
      return;
    }
    if (useManualPetCount && manualPetCount <= 0) {
      alert("Por favor, informe a quantidade de pets.");
      return;
    }

    try {
      const finalPetCount = useManualPetCount ? manualPetCount : selectedPetIds.length;
      const finalPetIds = useManualPetCount ? [] : selectedPetIds;

      let packageId = null;
      let unitValue = newApp.value;

      if (isPackage && !editingAppointment) {
        // Create the Monthly Package record
        const pkgRef = await addDoc(collection(db, 'monthlyPackages'), {
          customerId: selectedCustomerId,
          customerName: customers.find(c => c.docId === selectedCustomerId)?.name || '',
          totalValue: pkgValue,
          daysPerMonth: pkgDays,
          startDate: startOfMonth(new Date(newApp.dateTime)).toISOString(),
          status: 'Ativo',
          abatementAmount: 0,
          extraDiscount: pkgExtraDiscount,
          uid: user.uid
        });
        packageId = pkgRef.id;
        unitValue = pkgValue / pkgDays;

        // Generate multiple appointments for the package
        const startDate = new Date(newApp.dateTime);
        let createdCount = 0;
        let currentDate = startDate;
        
        // Skip creating the FIRST one here because it's created below with the user's data
        createdCount = 1; 

        while (createdCount < pkgDays) {
          currentDate = addDays(currentDate, 1);
          // Skip Sundays (0) - simple heuristic for "working days"
          if (currentDate.getDay() === 0) continue;
          
          const code = `A${Math.floor(10000 + Math.random() * 90000)}`;
          await addDoc(collection(db, 'appointments'), {
            ...newApp,
            id: code,
            dateTime: currentDate.toISOString(),
            customerId: selectedCustomerId,
            petIds: finalPetIds,
            petCount: finalPetCount,
            uid: user.uid,
            packageId: packageId,
            isMonthly: true,
            unitValue: unitValue,
            value: unitValue,
            status: 'Pendente'
          });
          createdCount++;
        }
      }

      if (editingAppointment) {
        await updateDoc(doc(db, 'appointments', editingAppointment.docId), {
          ...newApp,
          customerId: selectedCustomerId,
          petIds: finalPetIds,
          petCount: finalPetCount
        });
        alert("Agendamento atualizado com Sucesso");
      } else {
        const code = `A${Math.floor(10000 + Math.random() * 90000)}`;
        await addDoc(collection(db, 'appointments'), {
          ...newApp,
          id: code,
          customerId: selectedCustomerId,
          petIds: finalPetIds,
          petCount: finalPetCount,
          uid: user.uid,
          packageId: packageId,
          isMonthly: isPackage,
          unitValue: isPackage ? unitValue : newApp.value,
          value: isPackage ? unitValue : newApp.value
        });
        alert("Transporte agendado com Sucesso");
      }
      
      // Clear drafts
      localStorage.removeItem('levapet_app_draft');
      localStorage.removeItem('levapet_app_customerId');
      localStorage.removeItem('levapet_app_petIds');
      localStorage.removeItem('levapet_app_isAdding');
      localStorage.removeItem('levapet_app_editing');
      
      setIsAdding(false);
      setEditingAppointment(null);
      setSelectedCustomerId('');
      setSelectedPetIds([]);
      setUseManualPetCount(false);
      setManualPetCount(1);
      setNewApp({
        dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        originCity: '',
        destinationCity: '',
        city: 'São José do Rio Preto',
        pickupAddress: '',
        destinations: [''],
        type: 'Clínica Veterinária',
        value: 0,
        totalKm: 0,
        status: 'Pendente',
        discount: 0,
        observations: ''
      });
    } catch (e) {
      handleFirestoreError(e, editingAppointment ? OperationType.UPDATE : OperationType.CREATE, 'appointments');
    }
  };

  const handleEditAppointment = (app: Appointment) => {
    setEditingAppointment(app);
    setSelectedCustomerId(app.customerId);
    setSelectedPetIds(app.petIds);
    if (app.petIds.length === 0 && app.petCount > 0) {
      setUseManualPetCount(true);
      setManualPetCount(app.petCount);
    } else {
      setUseManualPetCount(false);
    }
    setNewApp({
      dateTime: app.dateTime,
      originCity: app.originCity || '',
      destinationCity: app.destinationCity || '',
      city: app.city,
      pickupAddress: app.pickupAddress,
      destinations: app.destinations,
      type: app.type,
      value: app.value,
      totalKm: app.totalKm || 0,
      status: app.status,
      discount: app.discount || 0,
      observations: app.observations || ''
    });
    setIsAdding(true);
  };

  const handleUpdateStatus = async (appId: string, status: 'Pendente' | 'Atendido' | 'Pago' | 'Cancelado' | 'Recusado' | 'Rota Compartilhada') => {
    try {
      const app = appointments.find(a => a.docId === appId);
      if (!app) return;

      const oldStatus = app.status;
      await updateDoc(doc(db, 'appointments', appId), { status });

      // Abatement Logic for Monthly Packages
      if (status === 'Cancelado' && app.isMonthly && app.packageId) {
        const pkg = monthlyPackages.find(p => p.docId === app.packageId);
        if (pkg) {
          const unitVal = app.unitValue || (pkg.totalValue / pkg.daysPerMonth);
          const newAbatement = (pkg.abatementAmount || 0) + unitVal;
          await updateDoc(doc(db, 'monthlyPackages', pkg.docId), { abatementAmount: newAbatement });
        }
      }

      // Loyalty Logic
      if ((status === 'Atendido' || status === 'Pago') && (oldStatus !== 'Atendido' && oldStatus !== 'Pago')) {
        const customer = customers.find(c => c.docId === app.customerId);
        if (customer) {
          let { loyaltyCount = 0, loyaltyCycleStart, loyaltyRewardAvailable = false } = customer;
          const now = new Date();

          // Check for 6-month cycle reset
          if (loyaltyCycleStart) {
            const cycleStart = new Date(loyaltyCycleStart);
            const sixMonthsLater = new Date(cycleStart);
            sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

            if (now > sixMonthsLater) {
              // Cycle expired
              loyaltyCount = 0;
              loyaltyCycleStart = now.toISOString();
            }
          } else {
            // First valid appointment starts the cycle
            loyaltyCycleStart = now.toISOString();
          }

          loyaltyCount += 1;

          if (loyaltyCount >= 5) {
            loyaltyRewardAvailable = true;
            loyaltyCount = 0;
            // Reset cycle start for next reward
            loyaltyCycleStart = now.toISOString();
          }

          await updateDoc(doc(db, 'customers', customer.docId), {
            loyaltyCount,
            loyaltyCycleStart,
            loyaltyRewardAvailable
          });

          if (loyaltyRewardAvailable) {
            alert(`🎉 PARABÉNS! O cliente ${customer.name} ganhou 50% de desconto no próximo transporte!`);
          }
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'appointments');
    }
  };

  const handleUpdateDiscount = async (appId: string, discount: number) => {
    try {
      await updateDoc(doc(db, 'appointments', appId), { discount });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'appointments');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#D4AF37]">Agendamentos Próximos</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-[#D4AF37] text-black p-2 rounded-full hover:scale-110 transition-transform shadow-[0_5px_15px_rgba(212,175,55,0.3)]"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input 
            type="text" 
            placeholder="Buscar cliente (Nome, Código ou Telefone)..."
            className="w-full bg-[#111] border border-[#ffffff0d] rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-[#D4AF3744]"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <select 
            className="w-full bg-[#111] border border-[#ffffff0d] rounded-xl py-2 px-3 text-xs outline-none focus:border-[#D4AF3744] appearance-none text-[#D4AF37] font-bold"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">TODOS STATUS</option>
            <option value="Pendente">PENDENTE</option>
            <option value="Atendido">ATENDIDO</option>
            <option value="Pago">PAGO</option>
            <option value="Rota Compartilhada">ROTA COMPARTILHADA</option>
            <option value="Recusado">RECUSADO</option>
            <option value="Cancelado">CANCELADO</option>
          </select>
        </div>
        <div className="relative">
          <select 
            className="w-full bg-[#111] border border-[#ffffff0d] rounded-xl py-2 px-3 text-xs outline-none focus:border-[#D4AF3744] appearance-none text-white font-black"
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value as any)}
          >
            <option value="day">HOJE</option>
            <option value="week">ESTA SEMANA</option>
            <option value="month">ESTE MÊS</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {!showList ? (
          <div className="text-center py-16 bg-[#0a0a0a] rounded-3xl border border-dashed border-[#ffffff0d]">
            <Search className="mx-auto text-gray-800 mb-4" size={48} />
            <p className="text-gray-600 text-xs font-black uppercase tracking-[0.2em]">Use os filtros acima para visualizar</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <p className="text-center py-8 text-gray-600 italic">Nenhum agendamento encontrado.</p>
        ) : (
          filteredAppointments.map(app => {
            const customer = customers.find(c => c.docId === app.customerId);
            const appPets = pets.filter(p => app.petIds.includes(p.id));
            
            return (
              <div key={app.docId} className="bg-[#111] p-5 rounded-2xl border border-[#ffffff0d] hover:border-[#D4AF3733] transition-all shadow-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex gap-4 w-full sm:w-auto">
                    <div className="bg-[#D4AF37] text-black p-2 rounded-lg flex flex-col items-center justify-center min-w-[60px] h-fit">
                      <span className="text-[10px] uppercase font-bold">{format(new Date(app.dateTime), 'MMM', { locale: ptBR })}</span>
                      <span className="text-xl font-black leading-none">{format(new Date(app.dateTime), 'dd')}</span>
                      <span className="text-[10px] font-bold uppercase">{format(new Date(app.dateTime), 'eee', { locale: ptBR })}</span>
                      <span className="text-[10px] font-bold">{format(new Date(app.dateTime), 'HH:mm')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 
                        className="font-bold text-[#D4AF37] cursor-pointer hover:underline truncate"
                        onClick={() => onViewAppointment(app)}
                      >
                        {customer?.name || 'Cliente Excluído'}
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-gray-400">{app.type}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase whitespace-nowrap ${
                          app.status === 'Atendido' ? 'bg-[#22c55e33] text-green-500' :
                          app.status === 'Pago' ? 'bg-green-500 text-black' :
                          app.status === 'Cancelado' ? 'bg-[#ef444433] text-red-500' :
                          app.status === 'Recusado' ? 'bg-[#ef444433] text-red-500' :
                          app.status === 'Rota Compartilhada' ? 'bg-[#6366f133] text-indigo-400' :
                          'bg-[#eab30833] text-yellow-500'
                        }`}>
                          {app.status}
                        </span>
                        {customer && (
                          <button 
                            onClick={() => setLoyaltyModalCustomer(customer)}
                            className="bg-[#D4AF3722] text-[#D4AF37] text-[8px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 hover:bg-[#D4AF3744]"
                          >
                            <FileText size={8} /> CARTÃO
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {appPets.map(p => (
                          <span key={p.id} className="text-[10px] bg-[#ffffff0d] px-2 py-0.5 rounded text-gray-300 whitespace-nowrap">{p.name}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-[#ffffff0d]">
                    <div className="text-left sm:text-right">
                      <span className={`text-sm font-bold ${
                        app.status === 'Pago' || app.status === 'Atendido' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        R$ {(app.value - (app.discount || 0)).toFixed(2)}
                      </span>
                      {app.discount > 0 && (
                        <p className="text-[10px] text-gray-500 line-through">R$ {app.value.toFixed(2)}</p>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      {app.status === 'Rota Compartilhada' && (
                        <div className="flex items-center gap-1 bg-black border border-[#ffffff1a] rounded px-1">
                          <span className="text-[9px] text-gray-500">Desc:</span>
                          <input 
                            type="number"
                            className="bg-transparent w-10 text-[10px] outline-none text-[#D4AF37]"
                            value={app.discount || 0}
                            onChange={(e) => handleUpdateDiscount(app.docId, parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      )}
                      <select 
                        value={app.status}
                        onChange={(e) => handleUpdateStatus(app.docId, e.target.value as any)}
                        className="bg-black border border-[#ffffff1a] rounded text-[10px] px-1 py-1 outline-none focus:border-[#D4AF37]"
                      >
                        <option value="Pendente">Pendente</option>
                        <option value="Atendido">Atendido</option>
                        <option value="Pago">Pago</option>
                        <option value="Rota Compartilhada">Rota Compartilhada</option>
                        <option value="Recusado">Recusado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                      <button onClick={() => handleEditAppointment(app)} className="text-[#D4AF374d] hover:text-[#D4AF37] p-1">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => setConfirmDelete({ isOpen: true, appointmentId: app.docId })} className="text-[#ef44444d] hover:text-red-500 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#ffffff0d] text-[11px] text-gray-500 space-y-1">
                  <p className="flex items-center gap-1 break-all"><MapPin size={10} className="text-[#D4AF37] shrink-0" /> {app.pickupAddress}</p>
                  {app.destinations.filter(d => d).map((d, i) => (
                    <p key={i} className="flex items-center gap-1 break-all"><ChevronRight size={10} className="text-gray-700 shrink-0" /> {d}</p>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#000000cc] backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#121212] w-full max-w-md rounded-[20px] border border-[#D4AF374d] p-6 max-h-[90vh] overflow-y-auto shadow-[0_0_20px_rgba(212,175,55,0.2)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#D4AF37]">{editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
                <button onClick={() => { setIsAdding(false); setEditingAppointment(null); }} className="text-gray-500"><X /></button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase">Selecionar Cliente</label>
                  <select 
                    className="w-full bg-black border border-[#ffffff1a] rounded-lg p-3 text-sm outline-none"
                    value={selectedCustomerId}
                    onChange={e => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="">Escolha um cliente...</option>
                    {customers.map(c => <option key={c.docId} value={c.docId}>{c.name} ({c.id})</option>)}
                  </select>
                </div>

                {selectedCustomer?.loyaltyRewardAvailable && (
                  <div className="bg-[#D4AF37] text-black p-3 rounded-lg flex items-center gap-3 animate-pulse">
                    <div className="bg-black/10 p-2 rounded-full">
                      <Star size={20} fill="currentColor" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase leading-tight">Recompensa Disponível!</p>
                      <p className="text-[10px] font-bold opacity-80">Este cliente possui 50% de desconto para este transporte.</p>
                    </div>
                  </div>
                )}

                {selectedCustomerId && (
                  <div className="bg-[#00000066] p-3 rounded-lg border border-[#ffffff0d]">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] text-gray-500 uppercase">Pets</p>
                      <button 
                        onClick={() => setUseManualPetCount(!useManualPetCount)}
                        className="text-[10px] text-[#D4AF37] font-black uppercase hover:underline"
                      >
                        {useManualPetCount ? 'Selecionar Pets Individuais' : 'Apenas informar Quantidade'}
                      </button>
                    </div>

                    {!useManualPetCount ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] text-gray-400">Selecionar Pets</p>
                          {customerPets.length > 0 && (
                            <button 
                              onClick={() => {
                                if (selectedPetIds.length === customerPets.length) {
                                  setSelectedPetIds([]);
                                } else {
                                  setSelectedPetIds(customerPets.map(p => p.id));
                                }
                              }}
                              className="text-[10px] text-[#D4AF37] font-bold hover:underline"
                            >
                              {selectedPetIds.length === customerPets.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {customerPets.map(p => (
                            <button 
                              key={p.id}
                              onClick={() => {
                                if (selectedPetIds.includes(p.id)) {
                                  setSelectedPetIds(selectedPetIds.filter(id => id !== p.id));
                                } else {
                                  setSelectedPetIds([...selectedPetIds, p.id]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${selectedPetIds.includes(p.id) ? 'bg-[#D4AF37] text-black font-bold' : 'bg-[#ffffff0d] text-gray-500'}`}
                            >
                              {p.name}
                            </button>
                          ))}
                          {customerPets.length === 0 && (
                            <p className="text-xs text-gray-600 italic">Nenhum pet cadastrado para este cliente.</p>
                          )}
                        </div>
                        <p className="text-[9px] text-gray-600 mt-2">Para cadastrar novos pets, vá em "Clientes" e edite o cadastro do cliente.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase">Quantidade de Animais</label>
                        <input 
                          type="number" 
                          min="1"
                          className="w-full bg-black border border-[#ffffff1a] rounded-lg p-2 text-sm outline-none"
                          value={manualPetCount}
                          onChange={e => setManualPetCount(parseInt(e.target.value) || 0)}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Input 
                      label="Data" 
                      type="date" 
                      value={newApp.dateTime.split('T')[0]} 
                      onChange={v => {
                        const timePart = newApp.dateTime.split('T')[1] || '00:00';
                        setNewApp({...newApp, dateTime: `${v}T${timePart}`});
                      }} 
                    />
                    {newApp.dateTime.split('T')[0] && (
                      <p className="text-[10px] text-[#D4AF37] font-bold px-1 capitalize">
                        {format(new Date(newApp.dateTime.split('T')[0] + 'T12:00:00'), "EEEE", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <Input 
                    label="Horário" 
                    type="time" 
                    value={newApp.dateTime.split('T')[1]} 
                    onChange={v => {
                      const datePart = newApp.dateTime.split('T')[0] || format(new Date(), 'yyyy-MM-dd');
                      setNewApp({...newApp, dateTime: `${datePart}T${v}`});
                    }} 
                  />
                </div>

                <div className="flex items-center gap-2 bg-[#D4AF371a] p-3 rounded-xl border border-[#D4AF3733] mb-2">
                  <input 
                    type="checkbox" 
                    id="isPackage" 
                    checked={isPackage}
                    onChange={(e) => setIsPackage(e.target.checked)}
                    className="w-4 h-4 accent-[#D4AF37]"
                  />
                  <label htmlFor="isPackage" className="text-xs font-black text-[#D4AF37] uppercase cursor-pointer">Adesão de Pacote Mensal</label>
                </div>

                {isPackage && !editingAppointment && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-black/40 p-4 rounded-xl border border-[#D4AF3733] space-y-3 overflow-hidden shadow-inner"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Valor Total Mensal" type="number" value={pkgValue.toString()} onChange={v => setPkgValue(parseFloat(v) || 0)} />
                      <Input label="Quant. de Diárias" type="number" value={pkgDays.toString()} onChange={v => setPkgDays(parseInt(v) || 0)} />
                    </div>
                    <div className="flex justify-between items-center bg-[#D4AF3712] p-2 rounded-lg border border-[#D4AF371a]">
                      <span className="text-[10px] text-[#D4AF37] font-black uppercase">Valor Unitário Gerado</span>
                      <span className="text-sm font-black text-white">R$ {(pkgValue / (pkgDays || 1)).toFixed(2)}</span>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase">Status</label>
                  <select 
                    className="w-full bg-[#1a1a1a] border border-[#D4AF37] rounded-[10px] p-3 text-sm outline-none text-white"
                    value={newApp.status}
                    onChange={e => setNewApp({...newApp, status: e.target.value as any})}
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Atendido">Atendido</option>
                    <option value="Pago">Pago</option>
                    <option value="Rota Compartilhada">Rota Compartilhada</option>
                    <option value="Recusado">Recusado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input label="Valor (R$)" type="number" value={newApp.value.toString()} onChange={v => setNewApp({...newApp, value: parseFloat(v) || 0})} />
                  <Input label="Total KM" type="number" value={newApp.totalKm?.toString() || '0'} onChange={v => setNewApp({...newApp, totalKm: parseFloat(v) || 0})} />
                </div>
                {newApp.status === 'Rota Compartilhada' && (
                  <Input label="Desconto (R$)" type="number" value={newApp.discount?.toString() || '0'} onChange={v => setNewApp({...newApp, discount: parseFloat(v) || 0})} />
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase">Tipo de Atendimento</label>
                  <select 
                    className="w-full bg-[#1a1a1a] border border-[#D4AF37] rounded-[10px] p-3 text-sm outline-none text-white"
                    value={newApp.type}
                    onChange={e => setNewApp({...newApp, type: e.target.value})}
                  >
                    {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <Input label="Endereço de Busca" value={newApp.pickupAddress} onChange={v => setNewApp({...newApp, pickupAddress: v})} />
                
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase">Destinos (Até 3)</p>
                  {newApp.destinations.map((d, i) => (
                    <div key={i} className="flex gap-2">
                      <input 
                        type="text" 
                        value={d} 
                        onChange={e => {
                          const updated = [...newApp.destinations];
                          updated[i] = e.target.value;
                          setNewApp({...newApp, destinations: updated});
                        }}
                        className="flex-1 bg-[#1a1a1a] border border-[#D4AF37] rounded-[10px] p-3 text-sm outline-none focus:ring-1 focus:ring-[#D4AF37] text-white"
                        placeholder={`Destino ${i + 1}`}
                      />
                      {i > 0 && (
                        <button onClick={() => setNewApp({...newApp, destinations: newApp.destinations.filter((_, idx) => idx !== i)})} className="text-[#ef444480]"><X size={18}/></button>
                      )}
                    </div>
                  ))}
                  {newApp.destinations.length < 3 && (
                    <button 
                      onClick={() => setNewApp({...newApp, destinations: [...newApp.destinations, '']})}
                      className="text-[#D4AF37] text-xs flex items-center gap-1"
                    >
                      <Plus size={14} /> Adicionar Destino
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase">Observações</label>
                  <textarea 
                    value={newApp.observations}
                    onChange={e => setNewApp({...newApp, observations: e.target.value})}
                    className="w-full bg-[#1a1a1a] border border-[#D4AF37] rounded-[10px] p-3 text-sm outline-none text-white min-h-[80px]"
                    placeholder="Observações adicionais..."
                  />
                </div>

                <button 
                  onClick={handleAddAppointment}
                  className="w-full bg-[#D4AF37] text-black font-bold py-3 rounded-[12px] mt-4 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                >
                  {editingAppointment ? <Save size={20} /> : <Calendar size={20} />} {editingAppointment ? 'Atualizar Agendamento' : 'Agendar Transporte'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, appointmentId: null })}
        onConfirm={() => confirmDelete.appointmentId && onDelete(confirmDelete.appointmentId)}
        title="Excluir Agendamento"
        message="Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita."
      />
    </motion.div>
  );
}

function ReportsView({ appointments, calculations, customers, pets, onDeleteCalculation, onEditCalculation, onViewAppointment, onViewBudget }: { 
  appointments: Appointment[], 
  calculations: Calculation[], 
  customers: Customer[], 
  pets: Pet[],
  onDeleteCalculation: (id: string) => void,
  onEditCalculation: (calc: Calculation) => void,
  onViewAppointment: (app: Appointment) => void,
  onViewBudget: (calc: Calculation) => void
}) {
  const [reportType, setReportType] = useState<'appointments' | 'budgets' | 'history'>('appointments');
  const [filter, setFilter] = useState<'day' | 'week' | 'month'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, calculationId: string | null }>({ isOpen: false, calculationId: null });
  const [isCapturing, setIsCapturing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (reportType === 'budgets') {
      setStatusFilter('Pendente');
    } else {
      setStatusFilter('all');
    }
  }, [reportType]);

  const filteredData = useMemo(() => {
    const now = new Date();
    let interval = { start: startOfMonth(now), end: endOfMonth(now) };
    
    if (filter === 'day') interval = { start: startOfDay(now), end: endOfDay(now) };
    if (filter === 'week') interval = { start: startOfWeek(now), end: endOfWeek(now) };

    const data = reportType === 'appointments' ? appointments : calculations;

    return data.filter(item => {
      const itemDate = reportType === 'appointments' ? (item as Appointment).dateTime : (item as Calculation).timestamp;
      if (!itemDate) return false;
      
      const date = new Date(itemDate);
      const isWithinDate = isWithinInterval(date, interval);
      
      const customer = customers.find(c => c.docId === item.customerId);
      const unifiedSearch = searchTerm.toLowerCase();
      const matchesSearch = 
        (customer?.name || '').toLowerCase().includes(unifiedSearch) || 
        (customer?.id || '').toLowerCase().includes(unifiedSearch) ||
        (customer?.phone || '').includes(unifiedSearch);
        
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

      const searchApplied = searchTerm || statusFilter !== 'all';
      
      if (searchApplied) {
        return matchesSearch && matchesStatus;
      }

      return isWithinDate;
    });
  }, [appointments, calculations, reportType, filter, searchTerm, statusFilter, customers]);

  const stats = useMemo(() => {
    const paidItems = (reportType === 'appointments' ? appointments : calculations).filter(item => {
      const status = reportType === 'appointments' ? (item as Appointment).status : (item as Calculation).status;
      return status === 'Pago';
    });

    const totalRecebido = paidItems.reduce((acc, curr) => {
      const val = reportType === 'appointments' ? (curr as Appointment).value : (curr as Calculation).total;
      return acc + (val - (curr.discount || 0));
    }, 0);

    const totalKm = (reportType === 'appointments' ? appointments : calculations).filter(item => {
      const status = reportType === 'appointments' ? (item as Appointment).status : (item as Calculation).status;
      return status === 'Pago' || status === 'Atendido';
    }).reduce((acc, curr) => acc + (curr.totalKm || 0), 0);

    return { totalRecebido, totalKm };
  }, [appointments, calculations, reportType]);

  const showList = searchTerm || statusFilter !== 'all';

  const totalFaturado = useMemo(() => {
    const now = new Date();
    let interval = { start: startOfMonth(now), end: endOfMonth(now) };
    if (filter === 'day') interval = { start: startOfDay(now), end: endOfDay(now) };
    if (filter === 'week') interval = { start: startOfWeek(now), end: endOfWeek(now) };

    const filteredAppsRevenue = appointments
      .filter(app => {
        const date = new Date(app.dateTime);
        return app.status === 'Pago' && isWithinInterval(date, interval);
      })
      .reduce((acc, curr) => acc + ((curr.value || 0) - (curr.discount || 0)), 0);

    const filteredBudgetsRevenue = calculations
      .filter(calc => {
        const date = new Date(calc.timestamp);
        return calc.status === 'Pago' && isWithinInterval(date, interval);
      })
      .reduce((acc, curr) => acc + ((curr.total || 0) - (curr.discount || 0)), 0);

    return filteredAppsRevenue + filteredBudgetsRevenue;
  }, [appointments, calculations, filter]);

  const budgetTotalsByStatus = useMemo(() => {
    const totals: Record<string, number> = {
      Pendente: 0,
      Aprovado: 0,
      'Recusado/Cancelado': 0,
      Pago: 0,
      'Rota Compartilhada': 0
    };

    filteredData.forEach(item => {
      if (reportType === 'budgets') {
        const calc = item as Calculation;
        const status = calc.status || 'Pendente';
        const finalValue = (calc.total || 0) - (calc.discount || 0);
        if (status === 'Recusado' || status === 'Cancelado') {
          totals['Recusado/Cancelado'] += finalValue;
        } else if (totals[status] !== undefined) {
          totals[status] += finalValue;
        }
      }
    });

    return totals;
  }, [filteredData, reportType]);

  const totalPrejuizo = reportType === 'appointments' 
    ? filteredData.reduce((acc, curr) => {
        const app = curr as Appointment;
        if (app.status === 'Cancelado' || app.status === 'Recusado') return acc + ((app.value || 0) - (app.discount || 0));
        return acc;
      }, 0)
    : 0;

  const totalItems = reportType === 'appointments'
    ? filteredData.filter(item => (item as Appointment).status !== 'Pendente').length
    : filteredData.length;

  const handleUpdateCalculationStatus = async (calcId: string, status: 'Pendente' | 'Aprovado' | 'Recusado' | 'Cancelado' | 'Pago' | 'Rota Compartilhada') => {
    try {
      await updateDoc(doc(db, 'calculations', calcId), { status });
      
      if (status === 'Aprovado') {
        const calc = calculations.find(c => c.docId === calcId);
        if (calc && calc.customerId) {
          const customer = customers.find(c => c.docId === calc.customerId);
          const code = `A${Math.floor(10000 + Math.random() * 90000)}`;
          
          await addDoc(collection(db, 'appointments'), {
            id: code,
            customerId: calc.customerId,
            petIds: [],
            dateTime: new Date().toISOString(),
            originCity: calc.originCity || '',
            destinationCity: calc.destinationCity || '',
            city: customer?.city || 'São José do Rio Preto',
            pickupAddress: customer?.address || '',
            destinations: [],
            type: 'Orçamento Aprovado',
            value: calc.total || 0,
            petCount: 0,
            status: 'Pendente',
            discount: calc.discount || 0,
            uid: calc.uid
          });
          alert("Transporte agendado com Sucesso (Orçamento Aprovado)");
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'calculations');
    }
  };

  const handleUpdateCalculationDiscount = async (calcId: string, discount: number) => {
    try {
      await updateDoc(doc(db, 'calculations', calcId), { discount });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'calculations');
    }
  };

  const exportExcel = () => {
    const data = filteredData.map(item => {
      const customer = customers.find(c => c.docId === item.customerId);
      const itemPets = reportType === 'appointments' 
        ? pets.filter(p => (item as Appointment).petIds.includes(p.id)).map(p => p.name).join(', ')
        : '';
      
      const itemDate = reportType === 'appointments' ? (item as Appointment).dateTime : (item as Calculation).timestamp;
      const itemValue = reportType === 'appointments' ? (item as Appointment).value : (item as Calculation).total;
      const itemType = reportType === 'appointments' ? (item as Appointment).type : 'Orçamento';

      return {
        'Data': itemDate ? format(new Date(itemDate), 'dd/MM/yyyy HH:mm') : '-',
        'Cliente': customer?.name || '-',
        'Código': customer?.id || '-',
        'Telefone': customer?.phone || '-',
        'Endereço Busca': reportType === 'appointments' ? (item as Appointment).pickupAddress : '-',
        'Pets': itemPets,
        'Tipo': itemType,
        'Status': reportType === 'appointments' ? (item as Appointment).status : ((item as Calculation).status || 'Pendente'),
        'KM Percorrido': item.totalKm || 0,
        'Valor': itemValue,
        'Desconto': item.discount || 0,
        'Valor Final': (itemValue || 0) - (item.discount || 0),
        'Observações': reportType === 'appointments' ? (item as Appointment).observations : '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportType === 'appointments' ? 'Agendamentos' : 'Orçamentos');
    XLSX.writeFile(wb, `relatorio-${reportType}-${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more columns
    
    // Header
    doc.setFillColor(17, 17, 17);
    doc.rect(0, 0, 297, 45, 'F');
    
    try {
      doc.addImage(LOGO_URL, 'PNG', 15, 5, 35, 35);
    } catch (e) {}
    
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(20);
    doc.text('Leva Pet Táxi Dog Rio Preto', 55, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(180, 180, 180);
    doc.text(`Relatório de ${reportType === 'appointments' ? 'Atendimentos' : 'Orçamentos'}`, 55, 32);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 55, 38);

    // Summary
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`Total Faturado: R$ ${totalFaturado.toFixed(2)}`, 15, 60);
    doc.setFontSize(11);
    doc.text(`Total de Itens: ${totalItems}`, 15, 68);

    // Table
    const tableData = filteredData.map(item => {
      const customer = customers.find(c => c.docId === item.customerId);
      const itemPets = reportType === 'appointments' 
        ? pets.filter(p => (item as Appointment).petIds.includes(p.id)).map(p => p.name).join(', ')
        : '';
      
      const itemDate = reportType === 'appointments' ? (item as Appointment).dateTime : (item as Calculation).timestamp;
      const itemValue = reportType === 'appointments' ? (item as Appointment).value : (item as Calculation).total;

      return [
        itemDate ? format(new Date(itemDate), 'dd/MM/yyyy HH:mm') : '-',
        `${customer?.name || '-'} (${customer?.phone || '-'})`,
        `${item.pickupAddress || '-'}`,
        itemPets,
        reportType === 'appointments' ? (item as Appointment).status : ((item as Calculation).status || 'Pendente'),
        `R$ ${((itemValue || 0) - (item.discount || 0)).toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: 75,
      head: [['Data', 'Cliente (Fone)', 'Endereço', 'Pets', 'Status', 'Valor Final']],
      body: tableData,
      headStyles: { fillColor: [212, 175, 55], textColor: [0, 0, 0] },
    });

    doc.save(`relatorio-${reportType}-${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const exportImage = async () => {
    if (!reportRef.current) return;
    setIsCapturing(true);
    setTimeout(async () => {
      try {
        const dataUrl = await domToJpeg(reportRef.current!, {
          quality: 0.9,
          scale: 2
        });
        const link = document.createElement('a');
        link.download = `relatorio-${reportType}-${format(new Date(), 'yyyyMMdd')}.jpg`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Error generating image:', err);
      } finally {
        setIsCapturing(false);
      }
    }, 100);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#D4AF37]">Relatórios</h2>
        <div className="flex gap-2">
          <button 
            onClick={exportExcel}
            className="bg-[#ffffff0d] text-[#D4AF37] border border-[#D4AF374d] px-3 py-2 rounded-full text-[10px] flex items-center gap-1 hover:bg-[#D4AF37] hover:text-black transition-all"
          >
            <FileText size={14} /> Excel
          </button>
          <button 
            onClick={exportPDF}
            className="bg-[#ffffff0d] text-[#D4AF37] border border-[#D4AF374d] px-3 py-2 rounded-full text-[10px] flex items-center gap-1 hover:bg-[#D4AF37] hover:text-black transition-all"
          >
            <Download size={14} /> PDF
          </button>
          <button 
            onClick={exportImage}
            className="bg-[#D4AF37] text-black px-3 py-2 rounded-full text-[10px] flex items-center gap-1 hover:bg-[#B8962E] transition-all font-bold"
          >
            <Share2 size={14} /> Imagem
          </button>
        </div>
      </div>

      <div ref={reportRef} className={`${isCapturing ? 'p-8 bg-black w-[1000px]' : ''}`}>
        {isCapturing && (
          <div className="flex items-center gap-4 mb-8 border-b border-[#D4AF3733] pb-6">
            <img src={LOGO_URL} alt="Logo" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
            <div>
              <h1 className="text-2xl font-black text-[#D4AF37]">Leva Pet Táxi Dog Rio Preto</h1>
              <p className="text-gray-400 text-sm uppercase tracking-widest">Relatório de {reportType === 'appointments' ? 'Atendimentos' : 'Orçamentos'}</p>
              <p className="text-gray-500 text-xs">Gerado em: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>
        )}

        <div className="flex bg-[#111] p-1 rounded-xl border border-[#ffffff0d] mb-6 no-capture">
          <button 
            onClick={() => setReportType('appointments')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${reportType === 'appointments' ? 'bg-[#D4AF37] text-black' : 'text-gray-500'}`}
          >
            Agendamentos
          </button>
          <button 
            onClick={() => setReportType('budgets')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${reportType === 'budgets' ? 'bg-[#D4AF37] text-black' : 'text-gray-500'}`}
          >
            Orçamentos
          </button>
          <button 
            onClick={() => setReportType('history')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${reportType === 'history' ? 'bg-[#D4AF37] text-black' : 'text-gray-500'}`}
          >
            Histórico
          </button>
        </div>

        {reportType === 'history' ? (
          <div className="space-y-6">
            {/* History Search */}
            <div className="bg-[#111] p-4 rounded-2xl border border-[#ffffff0d]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                <input 
                  type="text"
                  placeholder="Buscar cliente por nome, telefone ou código..."
                  className="w-full bg-black border border-[#ffffff0d] rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-[#D4AF374d]"
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    if (selectedHistoryCustomer) setSelectedHistoryCustomer(null);
                  }}
                />
                {searchTerm && !selectedHistoryCustomer && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#ffffff1a] rounded-xl overflow-hidden z-[100] shadow-2xl">
                    {customers
                      .filter(c => 
                        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.phone.includes(searchTerm)
                      )
                      .slice(0, 5)
                      .map(c => (
                        <button 
                          key={c.docId}
                          onClick={() => {
                            setSelectedHistoryCustomer(c);
                            setSearchTerm('');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-[#D4AF371a] border-b border-[#ffffff0d] last:border-0 flex justify-between items-center"
                        >
                          <div>
                            <p className="text-sm font-bold text-white">{c.name}</p>
                            <p className="text-[10px] text-gray-500">{c.id} • {c.phone}</p>
                          </div>
                          <ChevronRight size={16} className="text-[#D4AF37]" />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {selectedHistoryCustomer && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Customer Summary Card */}
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-6 rounded-3xl border border-[#D4AF374d] relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-[#D4AF371a] rounded-2xl flex items-center justify-center text-[#D4AF37]">
                        <Users size={32} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-white">{selectedHistoryCustomer.name}</h2>
                        <p className="text-[#D4AF37] font-bold text-sm tracking-widest uppercase">{selectedHistoryCustomer.id}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={12} /> {selectedHistoryCustomer.phone}</span>
                          <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={12} /> {selectedHistoryCustomer.city}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/40 p-4 rounded-2xl border border-[#ffffff05]">
                        <p className="text-[10px] text-gray-600 uppercase font-black mb-1">Total Atendimentos</p>
                        <p className="text-xl font-black text-white">
                          {appointments.filter(a => a.customerId === selectedHistoryCustomer.docId).length}
                        </p>
                      </div>
                      <div className="bg-black/40 p-4 rounded-2xl border border-[#ffffff05]">
                        <p className="text-[10px] text-gray-600 uppercase font-black mb-1">Total Pago</p>
                        <p className="text-xl font-black text-green-500">
                          R$ {appointments
                            .filter(a => a.customerId === selectedHistoryCustomer.docId && a.status === 'Pago')
                            .reduce((acc, curr) => acc + (curr.value - (curr.discount || 0)), 0)
                            .toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pets */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#D4AF37] flex items-center gap-2">
                    <Dog size={16} /> Pets Cadastrados
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {pets.filter(p => p.customerId === selectedHistoryCustomer.docId).map(p => (
                      <div key={p.id} className="bg-[#111] p-4 rounded-2xl border border-[#ffffff0d] flex items-center gap-3">
                        <div className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center text-[#D4AF37]">
                          <Dog size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{p.name}</p>
                          <p className="text-[10px] text-gray-500">{p.breed} • {p.size}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Full History List */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#D4AF37] flex items-center gap-2">
                    <Clock size={16} /> Histórico Completo
                  </h3>
                  <div className="space-y-3">
                    {appointments
                      .filter(a => a.customerId === selectedHistoryCustomer.docId)
                      .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
                      .map(app => (
                        <div key={app.docId} className="bg-[#111] p-4 rounded-2xl border border-[#ffffff0d] hover:border-[#D4AF3733] transition-all flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-[#ffffff0d] text-center">
                                <p className="text-[10px] font-black text-gray-500 uppercase">{format(new Date(app.dateTime), 'MMM', { locale: ptBR })}</p>
                                <p className="text-lg font-black text-white">{format(new Date(app.dateTime), 'dd')}</p>
                              </div>
                              <div>
                                <p className="text-sm font-black text-white">{app.type}</p>
                                <p className="text-[10px] text-gray-500 font-bold">{format(new Date(app.dateTime), 'yyyy')} • {format(new Date(app.dateTime), 'HH:mm')}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-black ${app.status === 'Pago' ? 'text-green-500' : 'text-[#D4AF37]'}`}>
                                R$ {(app.value - (app.discount || 0)).toFixed(2)}
                              </p>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${
                                app.status === 'Pago' ? 'bg-green-500 text-black' : 
                                app.status === 'Cancelado' ? 'bg-red-500/20 text-red-500' : 
                                'bg-[#eab30822] text-yellow-500'
                              }`}>
                                {app.status}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-[10px] text-gray-500 border-t border-[#ffffff05] pt-3">
                            <div>
                              <p className="font-black uppercase opacity-40">Origem/Coleta</p>
                              <p className="text-gray-300">{app.pickupAddress}</p>
                            </div>
                            <div>
                              <p className="font-black uppercase opacity-40">Destino(s)</p>
                              {app.destinations.map((d, i) => (
                                <p key={i} className="text-gray-300">• {d || 'N/A'}</p>
                              ))}
                            </div>
                          </div>
                          {app.isMonthly && (
                            <div className="bg-[#D4AF371a] p-2 rounded-lg flex items-center gap-2 border border-[#D4AF3733]">
                              <Calendar size={12} className="text-[#D4AF37]" />
                              <span className="text-[9px] font-black text-[#D4AF37] uppercase tracking-widest">Serviço de Pacote Mensal</span>
                            </div>
                          )}
                        </div>
                      ))}
                    {appointments.filter(a => a.customerId === selectedHistoryCustomer.docId).length === 0 && (
                      <p className="text-center py-10 text-gray-600 text-sm italic">Nenhum atendimento registrado no histórico.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-4 rounded-xl border border-[#D4AF3733]">
            <p className="text-[#6b7280] text-[8px] uppercase tracking-widest font-black mb-1">Total Recebido (PAGO)</p>
            <p className="text-lg font-black text-[#D4AF37]">R$ {stats.totalRecebido.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-4 rounded-xl border border-[#ffffff0d]">
            <p className="text-[#6b7280] text-[8px] uppercase tracking-widest font-black mb-1">Pets Cadastrados</p>
            <p className="text-lg font-black text-white">{pets.length}</p>
          </div>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-4 rounded-xl border border-[#ffffff0d]">
            <p className="text-[#6b7280] text-[8px] uppercase tracking-widest font-black mb-1">Km Rodado (Finalizado)</p>
            <p className="text-lg font-black text-white">{stats.totalKm.toFixed(1)} km</p>
          </div>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-4 rounded-xl border border-[#ffffff0d]">
            <p className="text-[#6b7280] text-[8px] uppercase tracking-widest font-black mb-1">Clientes Cadastrados</p>
            <p className="text-lg font-black text-white">{customers.length}</p>
          </div>
        </div>

        <div className="bg-[#111] p-4 rounded-2xl border border-[#ffffff0d] space-y-4 mb-6 no-capture">
          {reportType === 'budgets' && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              {Object.entries(budgetTotalsByStatus).map(([status, total]) => (
                <div key={status} className="bg-[#00000066] p-2 rounded-xl border border-[#ffffff0d]">
                  <p className="text-[8px] text-gray-500 uppercase font-bold">{status}</p>
                  <p className={`text-xs font-bold ${
                    status === 'Pago' ? 'text-green-500' :
                    status === 'Aprovado' ? 'text-blue-400' :
                    status === 'Recusado/Cancelado' ? 'text-red-400' :
                    status === 'Rota Compartilhada' ? 'text-indigo-400' :
                    'text-yellow-500'
                  }`}>
                    R$ {(total as number).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" size={14} />
              <input 
                type="text" 
                placeholder="Buscar cliente (Nome, Código ou Telefone)..." 
                className="w-full bg-[#000000] border border-[#ffffff1a] rounded-lg py-2 pl-9 pr-3 text-xs outline-none focus:border-[#D4AF37]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <select 
                className="w-full bg-[#000000] border border-[#ffffff1a] rounded-lg py-2 px-3 text-xs outline-none focus:border-[#D4AF37] appearance-none"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos Status</option>
                <option value="Pendente">Pendente</option>
                <option value="Atendido">Atendido</option>
                <option value="Pago">Pago</option>
                <option value="Rota Compartilhada">Rota Compartilhada</option>
                <option value="Recusado">Recusado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] rotate-90 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        <div className="flex bg-[#111111] p-1 rounded-xl border border-[#ffffff0d] mb-6 no-capture">
          {(['day', 'week', 'month'] as const).map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-[#D4AF37] text-[#000000]' : 'text-[#6b7280]'}`}
            >
              {f === 'day' ? 'Hoje' : f === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#6b7280] uppercase tracking-widest mb-2 no-capture">
            {reportType === 'appointments' ? 'Histórico de Atendimentos' : 'Histórico de Orçamentos'}
          </h3>
          {!showList ? (
            <div className="text-center py-16 bg-[#0a0a0a] rounded-3xl border border-dashed border-[#ffffff0d]">
              <Search className="mx-auto text-gray-800 mb-4" size={48} />
              <p className="text-gray-600 text-xs font-black uppercase tracking-[0.2em]">Use os filtros acima ou aguarde seleção</p>
            </div>
          ) : filteredData.length === 0 ? (
            <p className="text-center py-8 text-[#4b5563] italic">Nenhum dado encontrado.</p>
          ) : (
            filteredData.map(item => {
              const customer = customers.find(c => c.docId === item.customerId);
              const itemDate = reportType === 'appointments' ? (item as Appointment).dateTime : (item as Calculation).timestamp;
              const itemValue = reportType === 'appointments' ? (item as Appointment).value : (item as Calculation).total;
              const itemType = reportType === 'appointments' ? (item as Appointment).type : 'Orçamento';
              const itemPets = reportType === 'appointments' ? pets.filter(p => (item as Appointment).petIds.includes(p.id)) : [];

              return (
                <div 
                  key={item.docId} 
                  className={`bg-[#111111] p-4 rounded-xl border border-[#ffffff0d] flex justify-between items-start transition-colors ${!isCapturing ? 'hover:bg-[#ffffff0d] cursor-pointer' : ''}`}
                  onClick={() => !isCapturing && (reportType === 'appointments' ? onViewAppointment(item as Appointment) : onViewBudget(item as Calculation))}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-[#ffffff]">{customer?.name} ({customer?.id})</p>
                      <p className="text-[10px] text-[#D4AF37] font-bold">{customer?.phone}</p>
                    </div>
                    {reportType === 'appointments' && (
                      <p className="text-[10px] text-[#6b7280] flex items-center gap-1 italic">
                        <Navigation size={10} /> { (item as Appointment).pickupAddress }
                      </p>
                    )}
                    <p className="text-[10px] text-[#6b7280]">{itemDate ? format(new Date(itemDate), 'dd/MM HH:mm') : '-'} • {itemType}</p>
                    
                    <div className="flex flex-wrap gap-1 mt-1">
                      {itemPets.map(p => (
                        <span key={p.id} className="text-[8px] bg-[#ffffff0d] px-1.5 py-0.5 rounded text-[#9ca3af]">{p.name}</span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      {reportType === 'appointments' ? (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          (item as Appointment).status === 'Atendido' ? 'bg-[#22c55e33] text-[#22c55e]' :
                          (item as Appointment).status === 'Pago' ? 'bg-[#22c55e] text-[#000000]' :
                          (item as Appointment).status === 'Cancelado' ? 'bg-[#ef444433] text-[#ef4444]' :
                          (item as Appointment).status === 'Recusado' ? 'bg-[#ef444433] text-[#ef4444]' :
                          (item as Appointment).status === 'Rota Compartilhada' ? 'bg-[#6366f133] text-[#818cf8]' :
                          'bg-[#eab30833] text-[#eab308]'
                        }`}>
                          {(item as Appointment).status}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            (item as Calculation).status === 'Pago' ? 'bg-[#22c55e] text-[#000000]' :
                            (item as Calculation).status === 'Aprovado' ? 'bg-[#22c55e33] text-[#22c55e]' :
                            (item as Calculation).status === 'Recusado' ? 'bg-[#ef444433] text-[#ef4444]' :
                            (item as Calculation).status === 'Cancelado' ? 'bg-[#6b728033] text-[#6b7280]' :
                            (item as Calculation).status === 'Rota Compartilhada' ? 'bg-[#6366f133] text-[#818cf8]' :
                            'bg-[#eab30833] text-[#eab308]'
                          }`}>
                            {(item as Calculation).status || 'Pendente'}
                          </span>
                          {!isCapturing && (
                            <select 
                              value={(item as Calculation).status || 'Pendente'}
                              onChange={(e) => handleUpdateCalculationStatus(item.docId!, e.target.value as any)}
                              className="bg-[#000000] border border-[#ffffff1a] rounded text-[9px] px-1 outline-none focus:border-[#D4AF37] text-[#9ca3af]"
                            >
                              <option value="Pendente">Pendente</option>
                              <option value="Aprovado">Aprovado</option>
                              <option value="Pago">Pago</option>
                              <option value="Rota Compartilhada">Rota Compartilhada</option>
                              <option value="Recusado">Recusado</option>
                              <option value="Cancelado">Cancelado</option>
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                    {reportType === 'appointments' && (item as Appointment).observations && (
                      <p className="text-[9px] text-[#4b5563] italic mt-1 border-l border-[#D4AF3733] pl-2">
                        "{(item as Appointment).observations}"
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className={`font-black text-lg ${
                        reportType === 'appointments' && (item as Appointment).status === 'Cancelado' ? 'text-[#ef4444]' : 'text-[#D4AF37]'
                      }`}>
                        R$ {(itemValue - (item.discount || 0)).toFixed(2)}
                      </p>
                      {item.discount > 0 && (
                        <p className="text-[10px] text-[#6b7280] line-through">R$ {itemValue.toFixed(2)}</p>
                      )}
                    </div>
                    {!isCapturing && (
                      <div className="flex gap-2 items-center">
                        {reportType === 'budgets' && (item as Calculation).status === 'Rota Compartilhada' && (
                          <div className="flex items-center gap-1 bg-[#000000] border border-[#ffffff1a] rounded px-1">
                            <span className="text-[9px] text-[#6b7280]">Desc:</span>
                            <input 
                              type="number"
                              className="bg-transparent w-10 text-[10px] outline-none text-[#D4AF37]"
                              value={item.discount || 0}
                              onChange={(e) => handleUpdateCalculationDiscount(item.docId!, parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        )}
                        {reportType === 'budgets' && (
                          <div className="flex gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); onEditCalculation(item as Calculation); }}
                              className="text-[#D4AF374d] hover:text-[#D4AF37]"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setConfirmDelete({ isOpen: true, calculationId: item.docId! }); }}
                              className="text-[#ef44444d] hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </>
    )}
  </div>

      <style>{`
        @media print {
          .no-capture { display: none !important; }
        }
        ${isCapturing ? '.no-capture { display: none !important; }' : ''}
      `}</style>

      <ConfirmationModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, calculationId: null })}
        onConfirm={() => {
          if (confirmDelete.calculationId) {
            onDeleteCalculation(confirmDelete.calculationId);
            setConfirmDelete({ isOpen: false, calculationId: null });
          }
        }}
        title="Excluir Orçamento"
        message="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
      />
    </motion.div>
  );
}

function CalculatorView({ user, customers, editingCalculation, onCancelEdit, onPreview, getPhoneDuplicate }: { 
  user: User, 
  customers: Customer[], 
  editingCalculation?: Calculation | null, 
  onCancelEdit?: () => void,
  onPreview: (calc: Calculation) => void,
  getPhoneDuplicate: (phone: string, skipId?: string) => { docId: string, name: string, type: string } | null
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => (editingCalculation?.customerId) || localStorage.getItem('levapet_calc_customerId') || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '' });
  const [inputs, setInputs] = useState(() => {
    const saved = localStorage.getItem('levapet_calc_draft');
    return saved ? JSON.parse(saved) : {
      originCity: '',
      destinationCity: '',
      distance: 0,
      totalKm: 0,
      fuelPrice: 0,
      carDailyRate: 0,
      carDays: 1,
      toll: 0,
      hotelRate: 0,
      hotelDays: 0,
      food: 0,
      workHours: 0
    };
  });

  // Persistence
  useEffect(() => {
    if (!editingCalculation) {
      localStorage.setItem('levapet_calc_draft', JSON.stringify(inputs));
      localStorage.setItem('levapet_calc_customerId', selectedCustomerId);
    }
  }, [inputs, selectedCustomerId, editingCalculation]);

  useEffect(() => {
    if (editingCalculation) {
      setSelectedCustomerId(editingCalculation.customerId || '');
      setInputs({
        originCity: editingCalculation.originCity || '',
        destinationCity: editingCalculation.destinationCity || '',
        distance: editingCalculation.distance,
        totalKm: editingCalculation.totalKm || 0,
        fuelPrice: editingCalculation.fuelPrice,
        carDailyRate: editingCalculation.carDailyRate,
        carDays: editingCalculation.carDays,
        toll: editingCalculation.toll,
        hotelRate: editingCalculation.hotelRate,
        hotelDays: editingCalculation.hotelDays,
        food: editingCalculation.food,
        workHours: editingCalculation.workHours
      });
    } else {
      setSelectedCustomerId('');
      setInputs({
        originCity: '',
        destinationCity: '',
        distance: 0,
        totalKm: 0,
        fuelPrice: 0,
        carDailyRate: 0,
        carDays: 1,
        toll: 0,
        hotelRate: 0,
        hotelDays: 0,
        food: 0,
        workHours: 0
      });
    }
  }, [editingCalculation]);

  const selectedCustomer = customers.find(c => c.docId === selectedCustomerId);

  const filteredCustomerList = useMemo(() => {
    const search = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.id.toLowerCase().includes(search) || 
      c.phone.includes(search)
    );
  }, [customers, customerSearch]);

  const handleQuickAddCustomer = async () => {
    if (!quickCustomer.name || !quickCustomer.phone) {
      alert("Preencha nome e telefone!");
      return;
    }

    const duplicate = getPhoneDuplicate(quickCustomer.phone);
    if (duplicate) {
      alert(`O telefone ${quickCustomer.phone} já está cadastrado para ${duplicate.name} (${duplicate.type}). Altere o telefone ou use o cadastro existente.`);
      return;
    }

    try {
      const code = `C${Math.floor(1000 + Math.random() * 9000)}`;
      const docRef = await addDoc(collection(db, 'customers'), {
        ...quickCustomer,
        id: code,
        city: inputs.originCity || '',
        address: '',
        uid: user.uid,
        loyaltyCount: 0,
        loyaltyRewardAvailable: false
      });
      setSelectedCustomerId(docRef.id);
      setIsQuickAdding(false);
      setQuickCustomer({ name: '', phone: '' });
      alert(`Cliente ${quickCustomer.name} cadastrado e selecionado!`);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'customers');
    }
  };

  const results = useMemo(() => {
    const fuel = (inputs.distance / 10) * inputs.fuelPrice;
    const car = inputs.carDailyRate * inputs.carDays;
    const hotel = inputs.hotelRate * inputs.hotelDays;
    const work = inputs.workHours * 45;
    const total = fuel + car + hotel + work + inputs.toll + inputs.food;

    return { fuel, car, hotel, work, total };
  }, [inputs]);

  const handleSave = async () => {
    try {
      if (editingCalculation?.docId) {
        await updateDoc(doc(db, 'calculations', editingCalculation.docId), {
          ...inputs,
          customerId: selectedCustomerId,
          customerName: selectedCustomer?.name || 'Não informado',
          total: results.total,
          uid: user.uid
        });
        alert("Orçamento atualizado!");
        if (onCancelEdit) onCancelEdit();
      } else {
        await addDoc(collection(db, 'calculations'), {
          ...inputs,
          customerId: selectedCustomerId,
          customerName: selectedCustomer?.name || 'Não informado',
          total: results.total,
          timestamp: new Date().toISOString(),
          status: 'Pendente',
          uid: user.uid
        });
        alert("Orçamento salvo no histórico!");
      }
      
      // Clear drafts
      localStorage.removeItem('levapet_calc_draft');
      localStorage.removeItem('levapet_calc_customerId');
      
      setInputs({
        originCity: '',
        destinationCity: '',
        distance: 0,
        totalKm: 0,
        fuelPrice: 0,
        carDailyRate: 0,
        carDays: 1,
        toll: 0,
        hotelRate: 0,
        hotelDays: 0,
        food: 0,
        workHours: 0
      });
      setSelectedCustomerId('');
    } catch (e) {
      handleFirestoreError(e, editingCalculation?.docId ? OperationType.UPDATE : OperationType.CREATE, 'calculations');
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Header (Letterhead style)
    doc.setFillColor(17, 17, 17);
    doc.rect(0, 0, 210, 45, 'F');
    
    // Add Logo
    try {
      doc.addImage(LOGO_URL, 'PNG', 15, 5, 35, 35);
    } catch (e) {
      console.error("Could not add logo to PDF", e);
    }
    
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Leva Pet Táxi Dog Rio Preto', 55, 22);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text('Orçamento', 55, 32);
    doc.setFontSize(10);
    doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 55, 38);

    // Client Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados do Cliente:', 15, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${selectedCustomer?.name || 'Não informado'}`, 15, 70);
    doc.text(`Código: ${selectedCustomer?.id || '-'}`, 15, 77);
    doc.text(`Telefone: ${selectedCustomer?.phone || '-'}`, 15, 84);
    doc.text(`Cidade: ${selectedCustomer?.city || '-'}`, 15, 91);

    // Trip Details
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhes do Orçamento:', 15, 102);
    doc.setFont('helvetica', 'normal');
    doc.text(`Origem: ${inputs.originCity || '-'}`, 15, 109);
    doc.text(`Destino: ${inputs.destinationCity || '-'}`, 15, 116);
    
    const details = [
      ['Item', 'Valor/Qtd', 'Subtotal'],
      ['Distância', `${inputs.distance} km`, `R$ ${results.fuel.toFixed(2)}`],
      ['Diárias Carro', `${inputs.carDays}x R$ ${inputs.carDailyRate.toFixed(2)}`, `R$ ${results.car.toFixed(2)}`],
      ['Diárias Hotel', `${inputs.hotelDays}x R$ ${inputs.hotelRate.toFixed(2)}`, `R$ ${results.hotel.toFixed(2)}`],
      ['Pedágio', '-', `R$ ${inputs.toll.toFixed(2)}`],
      ['Alimentação', '-', `R$ ${inputs.food.toFixed(2)}`],
      ['Horas de Trabalho', `${inputs.workHours}h`, `R$ ${results.work.toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: 122,
      head: [details[0]],
      body: details.slice(1),
      theme: 'grid',
      headStyles: { fillColor: [212, 175, 55], textColor: [0, 0, 0] },
    });

    const finalY = ((doc as any).lastAutoTable?.finalY || 100) + 10;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`VALOR TOTAL: R$ ${results.total.toFixed(2)}`, 105, finalY + 10, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Este orçamento é válido por 7 dias.', 105, finalY + 25, { align: 'center' });

    doc.save(`orcamento-${selectedCustomer?.name || 'cliente'}.pdf`);
  };

  const exportExcel = () => {
    const data = [
      ['ORÇAMENTO - LEVA PET'],
      [''],
      ['CLIENTE', selectedCustomer?.name || 'Não informado'],
      ['CÓDIGO', selectedCustomer?.id || '-'],
      ['TELEFONE', selectedCustomer?.phone || '-'],
      ['CIDADE', selectedCustomer?.city || '-'],
      [''],
      ['ORIGEM', inputs.originCity || '-'],
      ['DESTINO', inputs.destinationCity || '-'],
      [''],
      ['DESCRIÇÃO', 'VALOR/QTD', 'SUBTOTAL'],
      ['Distância (Combustível)', `${inputs.distance} km`, results.fuel],
      ['Diárias Carro', inputs.carDays, results.car],
      ['Diárias Hotel', inputs.hotelDays, results.hotel],
      ['Pedágio', '-', inputs.toll],
      ['Alimentação', '-', inputs.food],
      ['Horas de Trabalho', inputs.workHours, results.work],
      [''],
      ['TOTAL', '', results.total]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orçamento");
    XLSX.writeFile(wb, `orcamento-${selectedCustomer?.name || 'cliente'}.xlsx`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#D4AF37]">
          {editingCalculation ? 'Editar Orçamento' : 'Calculadora de Orçamento'}
        </h2>
        <div className="flex gap-3">
          {editingCalculation && (
            <button onClick={onCancelEdit} className="text-gray-500 hover:text-white" title="Cancelar Edição">
              <X size={24} />
            </button>
          )}
          <button onClick={exportExcel} className="text-green-500 hover:scale-110 transition-transform" title="Exportar Planilha">
            <FileText size={24} />
          </button>
          <button 
            onClick={() => {
              const calc: Calculation = {
                ...inputs,
                customerId: selectedCustomerId,
                customerName: selectedCustomer?.name || 'Não informado',
                total: results.total,
                timestamp: editingCalculation?.timestamp || new Date().toISOString(),
                status: editingCalculation?.status || 'Pendente',
                uid: user.uid,
                docId: editingCalculation?.docId || ''
              };
              onPreview(calc);
            }} 
            className="text-red-500 hover:scale-110 transition-transform" 
            title="Exportar PDF (Visualizar)"
          >
            <Download size={24} />
          </button>
          <button onClick={handleSave} className="text-[#D4AF37] hover:scale-110 transition-transform" title="Salvar Orçamento">
            <Save size={24} />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} /> Cliente Vinculado
            </h3>
            <button 
              onClick={() => setIsQuickAdding(!isQuickAdding)}
              className="text-[10px] uppercase font-bold text-[#D4AF37] hover:underline"
            >
              {isQuickAdding ? 'Cancelar' : '+ Novo Cliente'}
            </button>
          </div>
          
          {isQuickAdding ? (
            <div className="bg-[#111] p-4 rounded-xl border border-[#D4AF374d] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nome do Cliente" value={quickCustomer.name} onChange={v => setQuickCustomer({...quickCustomer, name: v})} />
                <Input label="Telefone" value={quickCustomer.phone} onChange={v => setQuickCustomer({...quickCustomer, phone: v})} />
              </div>
              <button 
                onClick={handleQuickAddCustomer}
                className="w-full bg-[#D4AF37] text-black py-2 rounded-lg text-xs font-bold hover:scale-[1.02] transition-transform"
              >
                Cadastrar e Selecionar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <input 
                  type="text" 
                  placeholder="Buscar cliente (Nome, Código ou Telefone)..."
                  className="w-full bg-black border border-[#ffffff1a] rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-[#D4AF37]"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                />
              </div>
              <select 
                className="w-full bg-black border border-[#ffffff1a] rounded-xl p-3 text-sm outline-none focus:border-[#D4AF37]"
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
              >
                <option value="">{customerSearch ? `Resultados para "${customerSearch}"...` : 'Selecione um cliente...'}</option>
                {filteredCustomerList.map(c => <option key={c.docId} value={c.docId}>{c.name} ({c.id})</option>)}
              </select>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <MapPin size={14} /> Rota do Orçamento
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cidade de Origem" value={inputs.originCity} onChange={v => setInputs({...inputs, originCity: v})} />
            <Input label="Cidade de Destino" value={inputs.destinationCity} onChange={v => setInputs({...inputs, destinationCity: v})} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <MapPin size={14} /> Custos do Orçamento
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Input label="Quilometragem (km)" type="number" value={inputs.distance.toString()} onChange={v => setInputs({...inputs, distance: parseFloat(v) || 0})} />
              <p className="text-[9px] text-gray-500 italic">Distância para cálculo</p>
            </div>
            <div className="space-y-1">
              <Input label="Total KM Real" type="number" value={inputs.totalKm.toString()} onChange={v => setInputs({...inputs, totalKm: parseFloat(v) || 0})} />
              <p className="text-[9px] text-gray-500 italic">KM percorrido (para estatísticas)</p>
            </div>
          </div>
          <Input label="Valor Combustível (R$)" type="number" value={inputs.fuelPrice.toString()} onChange={v => setInputs({...inputs, fuelPrice: parseFloat(v) || 0})} />
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Users size={14} /> Custos do Veículo
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Diária Carro (R$)" type="number" value={inputs.carDailyRate.toString()} onChange={v => setInputs({...inputs, carDailyRate: parseFloat(v) || 0})} />
            <Input label="Nº de Diárias" type="number" value={inputs.carDays.toString()} onChange={v => setInputs({...inputs, carDays: parseInt(v) || 0})} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <DollarSign size={14} /> Custos Adicionais
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Pedágio (R$)" type="number" value={inputs.toll.toString()} onChange={v => setInputs({...inputs, toll: parseFloat(v) || 0})} />
            <Input label="Alimentação (R$)" type="number" value={inputs.food.toString()} onChange={v => setInputs({...inputs, food: parseFloat(v) || 0})} />
            <Input label="Diária Hotel (R$)" type="number" value={inputs.hotelRate.toString()} onChange={v => setInputs({...inputs, hotelRate: parseFloat(v) || 0})} />
            <Input label="Nº Diárias Hotel" type="number" value={inputs.hotelDays.toString()} onChange={v => setInputs({...inputs, hotelDays: parseInt(v) || 0})} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Clock size={14} /> Trabalho
          </h3>
          <Input label="Horas Trabalhadas" type="number" value={inputs.workHours.toString()} onChange={v => setInputs({...inputs, workHours: parseFloat(v) || 0})} />
        </section>

        <div className="bg-gradient-to-br from-[#D4AF37] to-[#B8962E] p-8 rounded-3xl text-black shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] shadow-[#D4AF371a] text-center">
          <p className="text-[10px] uppercase font-black tracking-widest mb-1 opacity-70">Total do Orçamento</p>
          <p className="text-5xl font-black">R$ {results.total.toFixed(2)}</p>
          
          <div className="grid grid-cols-2 gap-2 mt-6 pt-6 border-t border-[#0000001a] text-[10px] font-bold uppercase">
            <div className="text-left">Combustível: R$ {results.fuel.toFixed(2)}</div>
            <div className="text-right">Trabalho: R$ {results.work.toFixed(2)}</div>
            <div className="text-left">Carro: R$ {results.car.toFixed(2)}</div>
            <div className="text-right">Hospedagem: R$ {results.hotel.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Shared UI Components ---

// --- Components ---

function LoyaltyCard({ customer, pets, appointments, cardRef }: { customer: Customer, pets: Pet[], appointments: Appointment[], cardRef?: React.RefObject<HTMLDivElement> }) {
  const customerPets = pets.filter(p => p.customerId === customer.docId);
  const petNames = customerPets.map(p => p.name).join(', ');
  
  // Get the last 5 valid appointments for this customer
  const validAppointments = appointments
    .filter(a => a.customerId === customer.docId && (a.status === 'Atendido' || a.status === 'Pago'))
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
    .slice(0, 5)
    .reverse();

  const LOYALTY_IMAGE = "https://lh3.googleusercontent.com/d/15qY3dTF5V2g5b7r0fd63RHXtvK60_YsJ";

  return (
    <div ref={cardRef} className="relative w-full max-w-[500px] aspect-[1.41] mx-auto overflow-hidden rounded-xl shadow-2xl bg-white">
      <img 
        src={LOYALTY_IMAGE} 
        alt="Cartão Fidelidade" 
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
      />
      
      {/* Overlay Data */}
      <div className="absolute inset-0 flex flex-col pointer-events-none">
        {/* Tutor Name */}
        <div className="absolute top-[37.5%] left-[46%] text-[3.2cqw] sm:text-[16px] font-bold text-black uppercase" style={{ containerType: 'size' }}>
          {customer.name}
        </div>
        
        {/* Pet Name */}
        <div className="absolute top-[45.5%] left-[46%] text-[3.2cqw] sm:text-[16px] font-bold text-black uppercase">
          {petNames || '---'}
        </div>

        {/* Dates */}
        <div className="absolute bottom-[26%] left-[22%] right-[10%] flex justify-between items-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[15%] text-center text-[2.2cqw] sm:text-[11px] font-bold text-black">
              {validAppointments[i] ? format(new Date(validAppointments[i].dateTime), 'dd/MM/yy') : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoyaltyModal({ isOpen, onClose, customer, pets, appointments }: { 
  isOpen: boolean, 
  onClose: () => void, 
  customer: Customer | null, 
  pets: Pet[], 
  appointments: Appointment[] 
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  if (!customer) return null;

  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsCapturing(true);
    try {
      const dataUrl = await domToJpeg(cardRef.current, {
        quality: 0.95,
        scale: 3,
        features: {
          removeControlCharacter: true
        }
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `fidelidade-${customer.name}.jpg`, { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Cartão Fidelidade Leva Pet',
          text: `Cartão Fidelidade de ${customer.name}`
        });
      } else {
        const link = document.createElement('a');
        link.download = `fidelidade-${customer.name}.jpg`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Error sharing loyalty card:', err);
      alert('Erro ao compartilhar cartão.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePrint = async () => {
    if (!cardRef.current) return;
    setIsCapturing(true);
    try {
      const dataUrl = await domToJpeg(cardRef.current, {
        quality: 1,
        scale: 4
      });
      const windowPrint = window.open('', '_blank');
      if (windowPrint) {
        windowPrint.document.write(`
          <html>
            <head><title>Imprimir Cartão Fidelidade</title></head>
            <body style="margin:0; display:flex; align-items:center; justify-content:center; height:100vh;">
              <img src="${dataUrl}" style="max-width:100%; height:auto;" />
              <script>
                window.onload = () => {
                  window.print();
                  window.onafterprint = () => window.close();
                }
              </script>
            </body>
          </html>
        `);
        windowPrint.document.close();
      }
    } catch (err) {
      console.error('Error printing loyalty card:', err);
      alert('Erro ao imprimir cartão.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-xl my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[#D4AF37] font-black text-xl uppercase tracking-widest">Cartão Fidelidade</h2>
              <div className="flex gap-2">
                {!isCapturing && (
                  <>
                    <button 
                      onClick={handlePrint}
                      className="p-2 bg-[#ffffff0d] rounded-full text-gray-400 hover:text-white transition-colors"
                      title="Imprimir"
                    >
                      <Printer size={20} />
                    </button>
                    <button 
                      onClick={handleShare}
                      className="p-2 bg-[#ffffff0d] rounded-full text-gray-400 hover:text-white transition-colors"
                      title="Compartilhar"
                    >
                      <Share2 size={20} />
                    </button>
                  </>
                )}
                <button onClick={onClose} className="p-2 bg-[#ffffff0d] rounded-full text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <LoyaltyCard customer={customer} pets={pets} appointments={appointments} cardRef={cardRef} />
            
            <div className="mt-6 text-center space-y-4">
              <div className="space-y-1">
                <p className="text-gray-400 text-sm">
                  A cada 5 atendimentos, você ganha 50% de desconto no próximo transporte!
                </p>
                <div className="flex justify-center gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div 
                      key={i} 
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                        (customer.loyaltyCount || 0) >= i 
                          ? 'bg-[#D4AF37] border-[#D4AF37] text-black font-bold scale-110 shadow-[0_0_10px_rgba(212,175,55,0.5)]' 
                          : 'border-[#ffffff1a] text-gray-600'
                      }`}
                    >
                      {i}
                    </div>
                  ))}
                </div>
              </div>

              {customer.loyaltyRewardAvailable && (
                <motion.div 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="bg-[#D4AF37] text-black font-black py-3 px-6 rounded-xl inline-flex items-center gap-2 shadow-lg animate-bounce"
                >
                  <Gift size={20} />
                  RECOMPENSA DISPONÍVEL: 50% OFF!
                </motion.div>
              )}

              <div className="pt-4 flex flex-col gap-2">
                <button 
                  onClick={handleShare}
                  className="w-full bg-[#D4AF37] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#B8962E] transition-colors"
                >
                  <Share2 size={20} /> Compartilhar Cartão
                </button>
                <button 
                  onClick={onClose}
                  className="w-full bg-[#ffffff0d] text-white font-bold py-3 rounded-xl hover:bg-[#ffffff1a] transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: { label: string, value: string, onChange: (v: string) => void, type?: string, placeholder?: string }) {
  return (
    <div className="space-y-1 w-full">
      <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{label}</label>
      <input 
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#1a1a1a] border border-[#D4AF37] rounded-[10px] p-3 text-sm outline-none focus:ring-1 focus:ring-[#D4AF37] transition-all text-white"
      />
    </div>
  );
}
