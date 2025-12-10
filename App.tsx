import React, { useState, useEffect } from 'react';
import { Transaction, Center, MovementType, User, UserProfile } from './types';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import MasterData from './components/MasterData';
import Login from './components/Login';
import { LayoutDashboard, PlusCircle, List, Database, Shield, User as UserIcon, Loader2, AlertTriangle, LogOut } from 'lucide-react';
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

// Default Peniel Logo Component (Fallback)
const DefaultLogo = () => (
  <svg viewBox="0 0 100 100" className="w-10 h-10 fill-none" xmlns="http://www.w3.org/2000/svg">
     {/* Blue P shape simulation */}
    <path 
      d="M30 20 C 30 10, 70 10, 70 40 C 70 60, 50 60, 40 60 L 40 90" 
      stroke="#1B365D" 
      strokeWidth="12" 
      strokeLinecap="round"
      fill="none"
    />
    <path 
      d="M20 40 L 80 40" 
      stroke="#84cc16" 
      strokeWidth="8" 
      strokeLinecap="round" 
    />
  </svg>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'new' | 'masters'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  
  // -- AUTH STATE --
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // -- DATA STATE --
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [movementTypes, setMovementTypes] = useState<MovementType[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);

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
            
            unsubConfig = subscribeToConfig((curr, logo) => {
                setCurrencies(curr);
                setAppLogo(logo);
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
            attachment: attachmentUrl
        };
        await saveDocument('transactions', transactionToSave);
        setActiveTab('list');
    } catch (error) {
        console.error("Error saving transaction:", error);
        alert("Error al guardar en la nube.");
    }
  };

  const handleImportTransactions = async (importedData: Transaction[]) => {
    setIsLoading(true);
    try {
        await batchSaveTransactions(importedData);
        alert(`Se han importado ${importedData.length} registros exitosamente.`);
    } catch (error) {
        console.error("Import error:", error);
        alert("Error en la importación masiva.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogout = async () => {
      await logout();
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
            <div className="w-16 h-16 bg-[#1B365D] rounded-xl flex items-center justify-center animate-pulse">
               <DefaultLogo /> 
            </div>
            <p className="text-slate-400 font-medium">Verificando sesión...</p>
        </div>
     );
  }

  // If not logged in, show Login Screen
  if (!currentUser) {
      return <Login appLogo={appLogo} />;
  }

  // If logged in but data is loading
  if (isLoading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
              <Loader2 className="w-10 h-10 text-[#1B365D] animate-spin" />
              <p className="text-slate-500 font-medium">Cargando datos...</p>
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
              <div className="w-10 h-10 flex items-center justify-center overflow-hidden rounded-lg">
                {appLogo ? (
                    <img src={appLogo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                    <DefaultLogo />
                )}
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-[#1B365D] leading-tight tracking-tight">Peniel (MCyM)</h1>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">Libro de Caja Digital (Cloud)</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Desktop Nav */}
                <nav className="hidden md:flex gap-2">
                  <NavButton tab="dashboard" icon={<LayoutDashboard className="w-4 h-4"/>} label="Dashboard" />
                  <NavButton tab="list" icon={<List className="w-4 h-4"/>} label="Movimientos" />
                  
                  {isAdmin && (
                    <>
                        <NavButton tab="new" icon={<PlusCircle className="w-4 h-4"/>} label="Nuevo" />
                        <NavButton tab="masters" icon={<Database className="w-4 h-4"/>} label="Maestros" />
                    </>
                  )}
                </nav>

                <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>

                <button 
                    onClick={handleLogout}
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
          />
        )}
        
        {activeTab === 'new' && isAdmin && (
          <TransactionForm 
            onSave={handleSaveTransaction} 
            onCancel={() => setActiveTab('dashboard')}
            centers={centers}
            movementTypes={movementTypes}
            currencies={currencies}
          />
        )}

        {activeTab === 'masters' && isAdmin && (
          <MasterData
             centers={centers}
             movementTypes={movementTypes}
             currencies={currencies}
             users={users}
             appLogo={appLogo}
          />
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden flex justify-around p-3 z-50 safe-area-bottom">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-[#1B365D]' : 'text-slate-400'}`}>
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-[10px]">Inicio</span>
        </button>
        
        {isAdmin && (
            <button onClick={() => setActiveTab('masters')} className={`flex flex-col items-center gap-1 ${activeTab === 'masters' ? 'text-[#1B365D]' : 'text-slate-400'}`}>
                <Database className="w-6 h-6" />
                <span className="text-[10px]">Datos</span>
            </button>
        )}

        {isAdmin && (
            <button onClick={() => setActiveTab('new')} className={`flex flex-col items-center gap-1 ${activeTab === 'new' ? 'text-[#1B365D]' : 'text-slate-400'}`}>
                <div className="bg-[#1B365D] rounded-full p-3 -mt-8 shadow-lg border-4 border-slate-50 text-white">
                    <PlusCircle className="w-6 h-6" />
                </div>
            </button>
        )}

        <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center gap-1 ${activeTab === 'list' ? 'text-[#1B365D]' : 'text-slate-400'}`}>
            <List className="w-6 h-6" />
            <span className="text-[10px]">Historial</span>
        </button>
      </div>
    </div>
  );
};

export default App;