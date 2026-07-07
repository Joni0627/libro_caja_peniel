import React, { useState, useEffect } from 'react';
import { Transaction, Center, MovementType, User, UserProfile, ChurchData, Inversion, Annotation } from './types';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import MasterData from './components/MasterData';
import Annotations from './components/Annotations';
import Inversions from './components/Inversions'; // Import New Component
import Login from './components/Login';
import { LayoutDashboard, PlusCircle, List, Database, Shield, User as UserIcon, Loader2, AlertTriangle, LogOut, X, ClipboardList, TrendingUp } from 'lucide-react';
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
import { auth, isFirebaseConfigured } from './firebase';
import { useToast } from './components/Toast';

const App: React.FC = () => {
  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 md:p-12">
        <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-[#1B365D] p-6 text-center relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500"></div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500 animate-pulse" />
              Configuración de Firebase Requerida
            </h1>
            <p className="text-blue-200 text-xs uppercase font-bold tracking-wider mt-1">Libro de Caja Peniel</p>
          </div>
          
          {/* Body */}
          <div className="p-8 space-y-6 text-slate-700">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm leading-relaxed flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Faltan variables de entorno críticas de Firebase.</strong> La aplicación no puede inicializarse ni conectarse a la base de datos hasta que se configuren estos valores en Vercel o en el entorno de desarrollo.
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Variables que deben configurarse:</h3>
              <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2 border border-slate-800">
                <div><span className="text-slate-500"># Credenciales de Firebase (Vite)</span></div>
                <div><span className="text-amber-400">VITE_FIREBASE_API_KEY</span>=<span className="text-emerald-400">"tu-api-key"</span></div>
                <div><span className="text-amber-400">VITE_FIREBASE_AUTH_DOMAIN</span>=<span className="text-emerald-400">"tu-auth-domain"</span></div>
                <div><span className="text-amber-400">VITE_FIREBASE_PROJECT_ID</span>=<span className="text-emerald-400">"tu-project-id"</span></div>
                <div><span className="text-amber-400">VITE_FIREBASE_APP_ID</span>=<span className="text-emerald-400">"tu-app-id"</span></div>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">¿Cómo solucionar esto?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-black text-xs text-[#1B365D] uppercase tracking-wider mb-2">En Google AI Studio</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ve al menú de <strong className="font-semibold text-slate-800">Ajustes (Settings)</strong> en la esquina superior derecha del chat, ingresa los valores correspondientes en la sección de variables de entorno, guarda los cambios y la app se recargará sola.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-black text-xs text-[#1B365D] uppercase tracking-wider mb-2">En Vercel (Producción)</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ve al panel de control del proyecto en Vercel, dirígete a <strong className="font-semibold text-slate-800">Settings &gt; Environment Variables</strong>, añade cada una de las variables listadas arriba con sus valores reales y redespliega la aplicación.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
            <span>Libro de Caja Peniel &bull; Sistema de Gestión</span>
            <button 
              onClick={() => window.location.reload()}
              className="bg-[#1B365D] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#152a48] transition-colors"
            >
              Recargar Página
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Update Type for Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'inversions' | 'annotations' | 'masters'>('dashboard');
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
  const [churchData, setChurchData] = useState<ChurchData>({ name: 'Peniel (MCyM)' });
  
  // -- CACHED DATA STATES (Moved from children to here) --
  const [inversions, setInversions] = useState<Inversion[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

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
    let unsubInversions: () => void;
    let unsubAnnotations: () => void;

    const initData = async () => {
        // Double check both our state and the Firebase instance
        if (!currentUser || !auth.currentUser) {
            console.log("Waiting for full authentication before fetching data...");
            return;
        }

        try {
            await seedInitialData();
            
            // Subscribe to Collections
            unsubTx = subscribeToTransactions(setTransactions);
            unsubCenters = subscribeToCollection<Center>('centers', setCenters);
            unsubTypes = subscribeToCollection<MovementType>('movement_types', setMovementTypes);
            unsubUsers = subscribeToCollection<User>('users', setUsers);
            
            // Centralized Subscriptions for Cache
            unsubInversions = subscribeToCollection<Inversion>('inversions', (data) => {
                setInversions(data.sort((a, b) => b.date.localeCompare(a.date)));
            });
            unsubAnnotations = subscribeToCollection<Annotation>('annotations', (data) => {
                setAnnotations(data.sort((a, b) => b.date.localeCompare(a.date)));
            });
            
            unsubConfig = subscribeToConfig((curr, cData) => {
                setCurrencies(curr);
                if (cData) setChurchData(cData);
            });

        } catch (error: any) {
            console.error("Error fatal inicializando Firebase:", error);
            let errorMessage = "No se pudo conectar con la base de datos.";
            
            try {
                // Try to parse detailed error info if it's a JSON string
                const detailedError = JSON.parse(error.message);
                if (detailedError.error?.includes('insufficient permissions')) {
                    errorMessage = "Permisos denegados: Tu perfil no tiene autorización para esta acción o las Reglas de Firestore son incorrectas.";
                }
            } catch (e) {
                if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
                    errorMessage = "Permisos denegados: Verifica las Reglas de Firestore en la consola de Firebase.";
                }
            }
            
            setInitError(errorMessage);
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
        if(unsubInversions) unsubInversions();
        if(unsubAnnotations) unsubAnnotations();
    };
  }, [currentUser]); // Re-run when user logs in/out

  const handleSaveTransaction = async (newTx: Omit<Transaction, 'id'>, inversionData?: any) => {
    try {
        let attachmentUrl = newTx.attachment;
        if (newTx.attachment && newTx.attachment.startsWith('data:')) {
            const fileName = `receipts/${Date.now()}.jpg`;
            attachmentUrl = await uploadImage(newTx.attachment, fileName);
        }

        // 1. Save Transaction (Gasto de Caja)
        const transactionToSave = {
            ...newTx,
            // FIX: Ensure undefined becomes null for Firestore
            attachment: attachmentUrl || null
        };
        // Get the ID of the new transaction
        const savedTxId = await saveDocument('transactions', transactionToSave);

        // 2. If Inversion Data is present, create Inversion Record automatically
        if (inversionData) {
            const inversionToSave = {
                ...inversionData,
                // Link the transaction ID so we can edit/delete both later
                linkedTransactionId: savedTxId,
                // Use the same image URL generated above
                attachment: attachmentUrl || null
            };
            await saveDocument('inversions', inversionToSave);
            showToast("Movimiento de Inversión creado automáticamente.", 'success');
        }

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
              {churchData.logoUrl && (
                  <img src={churchData.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-full border border-slate-100 shadow-sm" />
              )}
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-[#1B365D] leading-none tracking-tight">{churchData.name || 'Peniel (MCyM)'}</h1>
                <span className="text-[10px] text-slate-500 font-medium hidden sm:inline mt-0.5">Libro de Caja Digital</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Desktop Nav */}
                <nav className="hidden md:flex gap-2">
                  <NavButton tab="dashboard" icon={<LayoutDashboard className="w-4 h-4"/>} label="Dashboard" />
                  <NavButton tab="list" icon={<List className="w-4 h-4"/>} label="Movimientos" />
                  
                  {/* Both Admin and User can see Inversions, but only Admin can edit inside */}
                  <NavButton tab="inversions" icon={<TrendingUp className="w-4 h-4"/>} label="Inversiones" />

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

        {/* Inversions Tab - Now receiving movementTypes too */}
        {activeTab === 'inversions' && (
          <Inversions 
              isAdmin={isAdmin} 
              inversions={inversions}
              centers={centers}
              currencies={currencies}
              movementTypes={movementTypes}
          />
        )}
        
        {/* Annotation Tab - Now receiving data as props */}
        {activeTab === 'annotations' && isAdmin && (
          <Annotations annotations={annotations} />
        )}

        {activeTab === 'masters' && isAdmin && (
          <MasterData
             centers={centers}
             movementTypes={movementTypes}
             currencies={currencies}
             users={users}
             churchData={churchData}
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
        
        <button onClick={() => setActiveTab('inversions')} className={`flex flex-col items-center gap-1 ${activeTab === 'inversions' ? 'text-[#1B365D]' : 'text-slate-400'}`}>
            <TrendingUp className="w-6 h-6" />
            <span className="text-[10px]">Inversión</span>
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