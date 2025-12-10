import React, { useState, useEffect } from 'react';
import { Transaction, Center, MovementType, User, UserProfile } from './types';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import MasterData from './components/MasterData';
import Annotations from './components/Annotations';
import Login from './components/Login';
import { LayoutDashboard, PlusCircle, List, Database, Shield, User as UserIcon, Loader2, AlertTriangle, LogOut, X, ClipboardList } from 'lucide-react';
import { 
  subscribeToCollection, 
  subscribeToTransactions, 
  subscribeToConfig, 
  seedInitialData,
  saveDocument,
  batchSaveTransactions,
  uploadImage
} from './services/firebaseService';
import { subscribeToAuth, logout } from './services/authService';
import { useToast } from './components/Toast';

const App: React.FC = () => {
  // Changed default types for tab to include annotations and remove 'new' (handled in list)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'annotations' | 'masters'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  
  // -- LOGOUT MODAL STATE --
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // -- AUTH STATE --
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // -- DATA STATE --
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [movementTypes, setMovementTypes] = useState<MovementType[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const { showToast } = useToast();

  // -- AUTH LISTENER --
  useEffect(() => {
    const unsubAuth = subscribeToAuth((firebaseUser, appUser) => {
        if (firebaseUser && appUser) {
            setCurrentUser(appUser);
        } else {
            setCurrentUser(null);
        }
        setIsAuthChecking(false);
    });

    return () => unsubAuth();
  }, []);


  // -- DATA LISTENERS (Only if logged in) --
  useEffect(() => {
    let unsubTx: () => void;
    let unsubCenters: () => void;
    let unsubTypes: () => void;
    let unsubUsers: () => void;
    let unsubConfig: () => void;

    const initData = async () => {
        if (!currentUser) return; // Don't fetch data if not logged in

        try {
            await seedInitialData();
            
            // Subscribe to Collections
            unsubTx = subscribeToTransactions(setTransactions);
            unsubCenters = subscribeToCollection<Center>('centers', setCenters);
            unsubTypes = subscribeToCollection<MovementType>('movement_types', setMovementTypes);
            unsubUsers = subscribeToCollection<User>('users', setUsers);
            
            unsubConfig = subscribeToConfig((curr, _logo) => {
                setCurrencies(curr);
            });

        } catch (error: any) {
            console.error("Error fatal inicializando Firebase:", error);
            if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
                setInitError("Permisos denegados: Verifica las Reglas de Firestore en la consola de Firebase.");
            } else {
                setInitError("No se pudo conectar con la base de datos.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (currentUser) {
        setIsLoading(true);
        initData();
    } else {
        setIsLoading(false);
    }

    return () => {
        if(unsubTx) unsubTx();
        if(unsubCenters) unsubCenters();
        if(unsubTypes) unsubTypes();
        if(unsubUsers) unsubUsers();
        if(unsubConfig) unsubConfig();
    };
  }, [currentUser]); // Re-run when user logs in/out

  const handleSaveTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    try {
        let attachmentUrl = newTx.attachment;
        if (newTx.attachment && newTx.attachment.startsWith('data:')) {
            const fileName = `receipts/${Date.now()}.jpg`;
            attachmentUrl = await uploadImage(newTx.attachment, fileName);
        }

        const transactionToSave = {
            ...newTx,
            // FIX: Ensure undefined becomes null for Firestore
            attachment: attachmentUrl || null
        };
        await saveDocument('transactions', transactionToSave);
        showToast("Movimiento registrado correctamente", 'success');
        // No need to switch tab as we are already in List view usually
    } catch (error) {
        console.error("Error saving transaction:", error);
        showToast("Error al guardar en la nube. Verifique la consola.", 'error');
    }
  };

  const handleImportTransactions = async (importedData: Transaction[]) => {
    setIsLoading(true);
    try {
        await batchSaveTransactions(importedData);
        showToast(`Se han importado ${importedData.length} registros exitosamente.`, 'success');
    } catch (error) {
        console.error("Import error:", error);
        showToast("Error en la importación masiva.", 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const confirmLogout = async () => {
      await logout();
      setIsLogoutModalOpen(false);
      setActiveTab('dashboard');
  };

  const NavButton: React.FC<{ tab: typeof activeTab; icon: React.ReactNode; label: string }> = ({ tab, icon, label }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        activeTab === tab 
        ? 'bg-[#1B365D] text-white shadow-md' 
        : 'text-slate-600 hover:bg-slate-200'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  // --- RENDERING STATES ---

  if (isAuthChecking) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <h1 className="text-3xl font-bold text-[#1B365D] tracking-tight">PENIEL</h1>
            <p className="text-slate-400 font-medium text-sm">Cargando sistema...</p>
        </div>
     );
  }

  // If not logged in, show Login Screen
  if (!currentUser) {
      return <Login />;
  }

  // If logged in but data is loading
  if (isLoading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
              <Loader2 className="w-10 h-10 text-[#1B365D] animate-spin" />
              <p className="text-slate-500 font-medium">Sincronizando...</p>
          </div>
      );
  }

  if (initError) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
              <div className="bg-rose-100 p-4 rounded-full mb-4">
                  <AlertTriangle className="w-10 h-10 text-rose-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Error de Conexión</h2>
              <p className="text-slate-600 max-w-md mb-6">{initError}</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-[#1B365D] text-white px-6 py-2 rounded-lg hover:bg-[#152a48]"
              >
                  Reintentar
              </button>
          </div>
      );
  }

  const isAdmin = currentUser.profile === UserProfile.ADMIN;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-[#84cc16]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-[#1B365D] leading-none tracking-tight">Peniel (MCyM)</h1>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline mt-1">Libro de Caja Digital</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Desktop Nav */}
                <nav className="hidden md:flex gap-2">
                  <NavButton tab="dashboard" icon={<LayoutDashboard className="w-4 h-4"/>} label="Dashboard" />
                  <NavButton tab="list" icon={<List className="w-4 h-4"/>} label="Movimientos" />
                  
                  {isAdmin && (
                    <>
                        {/* New Transaction button moved to List view, replaced here with Annotations */}
                        <NavButton tab="annotations" icon={<ClipboardList className="w-4 h-4"/>} label="Anotaciones" />
                        <NavButton tab="masters" icon={<Database className="w-4 h-4"/>} label="Maestros" />
                    </>
                  )}
                </nav>

                <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>

                <button 
                    onClick={() => setIsLogoutModalOpen(true)}
                    title="Cerrar Sesión"
                    className="flex items-center gap-2 text-slate-500 hover:text-rose-600 transition-colors p-2 hover:bg-rose-50 rounded-lg"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="hidden sm:inline text-sm font-medium">Salir</span>
                </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* WELCOME BANNER */}
        <div className="mb-6 flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-600">
                <div className={`p-2 rounded-full ${isAdmin ? 'bg-[#1B365D] text-white' : 'bg-[#84cc16] text-white'}`}>
                    {isAdmin ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                </div>
                <div>
                    <p className="text-xs text-slate-400 font-medium">Hola,</p>
                    <p className="text-sm font-bold leading-none">{currentUser.name} {currentUser.lastName}</p>
                </div>
            </div>
            {!isAdmin && (
                <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-500 font-medium">Modo Lectura</span>
            )}
        </div>


        {activeTab === 'dashboard' && (
          <Dashboard 
            transactions={transactions} 
            movementTypes={movementTypes} 
          />
        )}
        
        {activeTab === 'list' && (
          <TransactionList 
            transactions={transactions} 
            onImport={handleImportTransactions}
            centers={centers}
            movementTypes={movementTypes}
            currencies={currencies}
            onSaveNew={handleSaveTransaction}
            isAdmin={isAdmin}
          />
        )}
        
        {/* Annotation Tab */}
        {activeTab === 'annotations' && isAdmin && (
          <Annotations />
        )}

        {activeTab === 'masters' && isAdmin && (
          <MasterData
             centers={centers}
             movementTypes={movementTypes}
             currencies={currencies}
             users={users}
          />
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden flex justify-around p-3 z-50 safe-area-bottom">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-[#1B365D]' : 'text-slate-400'}`}>
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-[10px]">Inicio</span>
        </button>
        
        <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center gap-1 ${activeTab === 'list' ? 'text-[#1B365D]' : 'text-slate-400'}`}>
            <List className="w-6 h-6" />
            <span className="text-[10px]">Historial</span>
        </button>

        {isAdmin && (
            <button onClick={() => setActiveTab('annotations')} className={`flex flex-col items-center gap-1 ${activeTab === 'annotations' ? 'text-[#1B365D]' : 'text-slate-400'}`}>
                <ClipboardList className="w-6 h-6" />
                <span className="text-[10px]">Notas</span>
            </button>
        )}

        {isAdmin && (
            <button onClick={() => setActiveTab('masters')} className={`flex flex-col items-center gap-1 ${activeTab === 'masters' ? 'text-[#1B365D]' : 'text-slate-400'}`}>
                <Database className="w-6 h-6" />
                <span className="text-[10px]">Datos</span>
            </button>
        )}
      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
                <div className="p-6 text-center space-y-4">
                    <div className="bg-rose-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-rose-600">
                        <LogOut size={32} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">¿Cerrar Sesión?</h3>
                        <p className="text-slate-500 text-sm mt-2">¿Estás seguro de que deseas salir del sistema?</p>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => setIsLogoutModalOpen(false)}
                            className="flex-1 py-2.5 px-4 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmLogout}
                            className="flex-1 py-2.5 px-4 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition-colors shadow-sm"
                        >
                            Salir
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;