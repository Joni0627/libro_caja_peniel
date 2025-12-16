import React, { useState, useEffect } from 'react';
import { Center, MovementType, MovementCategory, User, UserProfile, ChurchData } from '../types';
import { Trash2, Plus, X, Building, MapPin, User as UserIcon, Phone, Pencil, Mail, Shield, Loader2, Home, Link, Info } from 'lucide-react';
import { saveDocument, deleteDocument, updateCurrencies, saveChurchData } from '../services/firebaseService';
import { useToast } from './Toast';

interface MasterDataProps {
  centers: Center[];
  movementTypes: MovementType[];
  currencies: string[];
  users: User[];
  churchData: ChurchData;
}

const MasterData: React.FC<MasterDataProps> = ({ 
  centers, movementTypes, currencies, users, churchData
}) => {
  const [activeTab, setActiveTab] = useState<'centers' | 'types' | 'currencies' | 'users' | 'church'>('centers');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // -- Edit Mode Tracking --
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // -- Centers State --
  const [newCenter, setNewCenter] = useState<Partial<Center>>({});
  
  // -- Types State --
  const [newType, setNewType] = useState<Partial<MovementType>>({ category: MovementCategory.INCOME });
  
  // -- Currencies State --
  const [newCurrency, setNewCurrency] = useState('');

  // -- Users State --
  const [newUser, setNewUser] = useState<Partial<User>>({ profile: UserProfile.USER });

  // -- Church Data State --
  const [newChurchData, setNewChurchData] = useState<ChurchData>({ name: '' });

  const { showToast } = useToast();

  // Update form when external churchData changes (if we are in the form)
  useEffect(() => {
    if (activeTab === 'church' && isModalOpen) {
       setNewChurchData(churchData);
    }
  }, [churchData, activeTab, isModalOpen]);


  // -- Handlers --
  const openModal = () => {
    setEditingId(null); // Reset edit mode
    setNewCenter({});
    setNewType({ category: MovementCategory.INCOME, name: '', subCategory: '' });
    setNewCurrency('');
    setNewUser({ profile: UserProfile.USER });
    
    // For Church Data, we always start with existing data
    if (activeTab === 'church') {
        setNewChurchData(churchData);
    }

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  // --- CENTER LOGIC ---
  const handleEditCenter = (center: Center) => {
    setNewCenter(center);
    setEditingId(center.id);
    setIsModalOpen(true);
  };

  const saveCenter = async () => {
    if (newCenter.name && newCenter.code) {
      setIsProcessing(true);
      try {
        const id = editingId || undefined; 
        const data = {
            name: newCenter.name,
            code: newCenter.code,
            address: newCenter.address || null,
            city: newCenter.city || null,
            zipCode: newCenter.zipCode || null,
            responsible: newCenter.responsible || null,
            phone: newCenter.phone || null,
            email: newCenter.email || null
        };
        await saveDocument('centers', data, editingId || undefined);
        showToast(editingId ? "Centro actualizado" : "Centro creado", 'success');
        closeModal();
      } finally {
        setIsProcessing(false);
      }
    } else {
        showToast("Nombre y Código son obligatorios", 'error');
    }
  };

  const deleteCenterHandler = async (id: string) => {
      if(window.confirm("¿Estás seguro de eliminar este centro?")) {
        await deleteDocument('centers', id);
        showToast("Centro eliminado", 'success');
      }
  };

  // --- MOVEMENT TYPE LOGIC ---
  const handleEditType = (type: MovementType) => {
      setNewType(type);
      setEditingId(type.id);
      setIsModalOpen(true);
  };

  const saveTypeHandler = async () => {
    if (newType.name) {
      setIsProcessing(true);
      try {
        await saveDocument('movement_types', { 
            name: newType.name, 
            category: newType.category,
            subCategory: newType.subCategory || null
        }, editingId || undefined);
        showToast(editingId ? "Tipo actualizado" : "Tipo creado", 'success');
        closeModal();
      } finally {
        setIsProcessing(false);
      }
    } else {
        showToast("El nombre es obligatorio", 'error');
    }
  };
  
  const deleteTypeHandler = async (id: string) => {
    if(window.confirm("¿Estás seguro de eliminar este tipo de movimiento?")) {
        await deleteDocument('movement_types', id);
        showToast("Tipo eliminado", 'success');
    }
  };

  // --- CURRENCY LOGIC ---
  const addCurrency = async () => {
    if (newCurrency && !currencies.includes(newCurrency)) {
      setIsProcessing(true);
      try {
        const updated = [...currencies, newCurrency.toUpperCase()];
        await updateCurrencies(updated);
        showToast("Moneda agregada", 'success');
        closeModal();
      } finally {
        setIsProcessing(false);
      }
    }
  };
  const deleteCurrencyHandler = async (c: string) => {
      const updated = currencies.filter(cur => cur !== c);
      await updateCurrencies(updated);
      showToast("Moneda eliminada", 'success');
  };

  // --- USER LOGIC ---
  const handleEditUser = (user: User) => {
      setNewUser(user);
      setEditingId(user.id);
      setIsModalOpen(true);
  };

  const saveUserHandler = async () => {
      if (newUser.name && newUser.lastName && newUser.email) {
          setIsProcessing(true);
          try {
             const data = {
                  name: newUser.name,
                  lastName: newUser.lastName,
                  email: newUser.email,
                  phone: newUser.phone || null,
                  profile: newUser.profile || UserProfile.USER
             };
             await saveDocument('users', data, editingId || undefined);
             showToast(editingId ? "Usuario actualizado" : "Usuario creado", 'success');
             closeModal();
          } finally {
             setIsProcessing(false);
          }
      } else {
          showToast("Nombre, Apellido y Email son obligatorios", 'error');
      }
  };

  const deleteUserHandler = async (id: string) => {
      if (users.length <= 1) {
          showToast("No puedes eliminar el único usuario del sistema.", 'error');
          return;
      }
      if(window.confirm("¿Estás seguro de eliminar este usuario?")) {
        await deleteDocument('users', id);
        showToast("Usuario eliminado", 'success');
      }
  };

  // --- CHURCH DATA LOGIC ---
  
  // Improved Helper to convert Google Drive view links to direct image links using Regex
  const convertDriveLink = (url: string) => {
      if (!url) return '';
      
      // Attempt to extract File ID from common Google Drive URL patterns
      // 1. /file/d/[ID]/...
      // 2. id=[ID]
      // 3. /d/[ID]/...
      const idRegex = /(?:\/d\/|id=)([\w-]+)/;
      const match = url.match(idRegex);
      
      if (match && match[1]) {
          // Construct the direct export link
          return `https://drive.google.com/uc?export=view&id=${match[1]}`;
      }
      
      // Return original if no pattern matched (might be a direct link already)
      return url;
  };

  const saveChurchHandler = async () => {
      if (newChurchData.name) {
          setIsProcessing(true);
          try {
              const processedData = {
                  ...newChurchData,
                  // Convert link on save
                  logoUrl: convertDriveLink(newChurchData.logoUrl || '')
              };
              await saveChurchData(processedData);
              showToast("Datos de la iglesia actualizados", 'success');
              closeModal();
          } finally {
              setIsProcessing(false);
          }
      } else {
          showToast("El nombre de la iglesia es obligatorio", 'error');
      }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('centers')}
          className={`flex-1 py-4 px-4 text-center font-medium transition-colors whitespace-nowrap ${activeTab === 'centers' ? 'bg-[#1B365D] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Centros
        </button>
        <button 
          onClick={() => setActiveTab('types')}
          className={`flex-1 py-4 px-4 text-center font-medium transition-colors whitespace-nowrap ${activeTab === 'types' ? 'bg-[#1B365D] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Tipos Movimiento
        </button>
        <button 
          onClick={() => setActiveTab('currencies')}
          className={`flex-1 py-4 px-4 text-center font-medium transition-colors whitespace-nowrap ${activeTab === 'currencies' ? 'bg-[#1B365D] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Monedas
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-4 px-4 text-center font-medium transition-colors whitespace-nowrap ${activeTab === 'users' ? 'bg-[#1B365D] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Usuarios
        </button>
        <button 
          onClick={() => setActiveTab('church')}
          className={`flex-1 py-4 px-4 text-center font-medium transition-colors whitespace-nowrap ${activeTab === 'church' ? 'bg-[#1B365D] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Datos Iglesia
        </button>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-[#1B365D]">
                {activeTab === 'centers' ? 'Gestión de Centros' : 
                 activeTab === 'types' ? 'Tipos de Movimiento' : 
                 activeTab === 'currencies' ? 'Monedas Habilitadas' : 
                 activeTab === 'church' ? 'Configuración Institucional' :
                 'Gestión de Usuarios'}
            </h2>
            
            {activeTab !== 'church' ? (
                <button 
                    onClick={openModal}
                    className="bg-[#84cc16] text-white px-4 py-2 rounded-lg hover:bg-lime-600 flex items-center gap-2 shadow-sm font-medium"
                >
                    <Plus size={18} /> Agregar Nuevo
                </button>
            ) : (
                <button 
                    onClick={openModal}
                    className="bg-[#1B365D] text-white px-4 py-2 rounded-lg hover:bg-[#152a48] flex items-center gap-2 shadow-sm font-medium"
                >
                    <Pencil size={18} /> Editar Datos
                </button>
            )}
        </div>

        {/* CENTERS LIST */}
        {activeTab === 'centers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {centers.map(c => (
                <div key={c.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-slate-50/50">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <div className="bg-[#1B365D]/10 p-2 rounded-full">
                                <Building className="w-5 h-5 text-[#1B365D]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{c.name}</h3>
                                <span className="text-xs font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">{c.code}</span>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => handleEditCenter(c)} className="text-[#1B365D] hover:bg-slate-200 p-1 rounded transition-colors" title="Editar">
                                <Pencil size={16} />
                            </button>
                            <button onClick={() => deleteCenterHandler(c.id)} className="text-rose-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded transition-colors" title="Eliminar">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1 mt-3 pl-11">
                        {c.address && <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400"/> {c.address} {c.city ? `, ${c.city}` : ''}</p>}
                        {c.responsible && <p className="flex items-center gap-2"><UserIcon size={14} className="text-slate-400"/> {c.responsible}</p>}
                        {c.phone && <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {c.phone}</p>}
                    </div>
                </div>
              ))}
            </div>
        )}

        {/* MOVEMENT TYPES LIST */}
        {activeTab === 'types' && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th className="p-3">Descripción</th>
                    <th className="p-3">Subcategoría</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movementTypes.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-900 font-medium">{m.name}</td>
                      <td className="p-3 text-slate-500 text-xs">{m.subCategory || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${m.category === MovementCategory.INCOME ? 'bg-lime-100 text-lime-700' : 'bg-rose-100 text-rose-700'}`}>
                          {m.category === MovementCategory.INCOME ? 'ENTRADA' : 'SALIDA'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                            <button onClick={() => handleEditType(m)} className="text-[#1B365D] hover:bg-slate-200 p-1 rounded transition-colors" title="Editar">
                                <Pencil size={16} />
                            </button>
                            <button onClick={() => deleteTypeHandler(m.id)} className="text-rose-500 hover:bg-rose-50 p-1 rounded" title="Eliminar">
                                <Trash2 size={16} />
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}

        {/* CURRENCIES LIST */}
        {activeTab === 'currencies' && (
            <div className="max-w-md">
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {currencies.map(c => (
                    <li key={c} className="flex justify-between items-center p-4 hover:bg-slate-50">
                      <span className="font-bold text-[#1B365D]">{c}</span>
                      <button onClick={() => deleteCurrencyHandler(c)} className="text-rose-500 hover:bg-rose-50 p-1 rounded">
                          <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
        )}

        {/* USERS LIST */}
        {activeTab === 'users' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map(u => (
                <div key={u.id} className="border border-slate-200 rounded-lg p-4 flex flex-col gap-3 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                         <div className="flex items-center gap-3">
                             <div className={`p-3 rounded-full ${u.profile === UserProfile.ADMIN ? 'bg-[#1B365D]/10 text-[#1B365D]' : 'bg-slate-100 text-slate-500'}`}>
                                 {u.profile === UserProfile.ADMIN ? <Shield size={20} /> : <UserIcon size={20} />}
                             </div>
                             <div>
                                 <h4 className="font-bold text-slate-800">{u.name} {u.lastName}</h4>
                                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.profile === UserProfile.ADMIN ? 'bg-[#1B365D] text-white' : 'bg-slate-200 text-slate-600'}`}>
                                     {u.profile === UserProfile.ADMIN ? 'ADMINISTRADOR' : 'USUARIO'}
                                 </span>
                             </div>
                         </div>
                         <div className="flex gap-1">
                            <button onClick={() => handleEditUser(u)} className="text-[#1B365D] hover:bg-slate-200 p-1 rounded transition-colors" title="Editar">
                                <Pencil size={16} />
                            </button>
                            <button onClick={() => deleteUserHandler(u.id)} className="text-rose-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded transition-colors" title="Eliminar">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1 ml-12">
                        <div className="flex items-center gap-2"><Mail size={14} className="text-slate-400"/> {u.email}</div>
                        {u.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {u.phone}</div>}
                    </div>
                </div>
              ))}
            </div>
        )}

        {/* CHURCH DATA VIEW */}
        {activeTab === 'church' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 max-w-2xl mx-auto text-center">
                <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-slate-200 shadow-sm overflow-hidden">
                    {churchData.logoUrl ? (
                        <img src={churchData.logoUrl} alt="Logo Iglesia" className="w-full h-full object-contain" />
                    ) : (
                        <Home size={40} className="text-slate-300" />
                    )}
                </div>
                
                <h3 className="text-2xl font-bold text-[#1B365D] mb-1">{churchData.name || 'Nombre no configurado'}</h3>
                <p className="text-slate-500 text-sm mb-6 flex items-center justify-center gap-1">
                    <MapPin size={14} /> {churchData.address || 'Dirección no configurada'}
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-[#1B365D] rounded-lg">
                            <UserIcon size={20} />
                        </div>
                        <div className="text-left">
                            <span className="block text-xs text-slate-400 uppercase font-bold">Pastor</span>
                            <span className="block font-medium text-slate-700">{churchData.pastor || '-'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 text-green-700 rounded-lg">
                            <Phone size={20} />
                        </div>
                        <div className="text-left">
                            <span className="block text-xs text-slate-400 uppercase font-bold">Celular / Tel.</span>
                            <span className="block font-medium text-slate-700">{churchData.phone || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-[#1B365D] px-6 py-4 flex justify-between items-center">
                    <h3 className="text-white font-bold text-lg">
                        {activeTab === 'centers' ? (editingId ? 'Editar Centro' : 'Nuevo Centro') : 
                         activeTab === 'types' ? (editingId ? 'Editar Tipo de Movimiento' : 'Nuevo Tipo de Movimiento') : 
                         activeTab === 'users' ? (editingId ? 'Editar Usuario' : 'Nuevo Usuario') : 
                         activeTab === 'church' ? 'Configurar Datos de Iglesia' : 'Nueva Moneda'}
                    </h3>
                    <button onClick={closeModal} className="text-white/80 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto relative">
                    {isProcessing && (
                         <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
                             <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 text-[#1B365D] animate-spin" />
                                <span className="text-sm font-bold text-[#1B365D]">Procesando...</span>
                             </div>
                         </div>
                    )}
                    
                    {/* CENTER FORM */}
                    {activeTab === 'centers' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Nombre *</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Ej: Sede Central" value={newCenter.name || ''} onChange={e => setNewCenter({...newCenter, name: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Código *</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Ej: HQ" value={newCenter.code || ''} onChange={e => setNewCenter({...newCenter, code: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Dirección</label>
                                <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                    placeholder="Calle y número" value={newCenter.address || ''} onChange={e => setNewCenter({...newCenter, address: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Ciudad</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Ciudad" value={newCenter.city || ''} onChange={e => setNewCenter({...newCenter, city: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">CP</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Código Postal" value={newCenter.zipCode || ''} onChange={e => setNewCenter({...newCenter, zipCode: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Responsable</label>
                                <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                    placeholder="Nombre del responsable" value={newCenter.responsible || ''} onChange={e => setNewCenter({...newCenter, responsible: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Teléfono</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Teléfono contacto" value={newCenter.phone || ''} onChange={e => setNewCenter({...newCenter, phone: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Email</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Email contacto" value={newCenter.email || ''} onChange={e => setNewCenter({...newCenter, email: e.target.value})} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TYPE FORM */}
                    {activeTab === 'types' && (
                        <div className="space-y-4">
                             <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Nombre del Movimiento</label>
                                <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                    placeholder="Ej: Ofrenda Especial" value={newType.name || ''} onChange={e => setNewType({...newType, name: e.target.value})} />
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Subcategoría (Para PDF)</label>
                                <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                    list="subCategories"
                                    placeholder="Ej: INVERSIONES" value={newType.subCategory || ''} onChange={e => setNewType({...newType, subCategory: e.target.value})} />
                                <datalist id="subCategories">
                                    <option value="ENTRADAS" />
                                    <option value="INVERSIONES" />
                                    <option value="GASTOS ESPECIFICOS DE MINISTERIO" />
                                    <option value="GASTOS GENERALES" />
                                </datalist>
                                <p className="text-xs text-slate-400">Agrupará este ítem en el reporte bajo este título.</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Categoría</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setNewType({...newType, category: MovementCategory.INCOME})}
                                        className={`p-3 rounded-lg border text-center font-medium transition-colors ${newType.category === MovementCategory.INCOME ? 'bg-lime-100 border-lime-500 text-lime-700 ring-1 ring-lime-500' : 'bg-white border-slate-200 text-slate-600'}`}
                                    >
                                        ENTRADA (+)
                                    </button>
                                    <button 
                                        onClick={() => setNewType({...newType, category: MovementCategory.EXPENSE})}
                                        className={`p-3 rounded-lg border text-center font-medium transition-colors ${newType.category === MovementCategory.EXPENSE ? 'bg-rose-100 border-rose-500 text-rose-700 ring-1 ring-rose-500' : 'bg-white border-slate-200 text-slate-600'}`}
                                    >
                                        SALIDA (-)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CURRENCY FORM */}
                    {activeTab === 'currencies' && (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Código de Moneda (ISO 4217)</label>
                                <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                    placeholder="Ej: BRL, UYU" value={newCurrency} onChange={e => setNewCurrency(e.target.value)} />
                                <p className="text-xs text-slate-400">Ejemplos: CLP, USD, EUR, ARS</p>
                            </div>
                        </div>
                    )}

                    {/* USER FORM */}
                    {activeTab === 'users' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Nombre *</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Ej: Juan" value={newUser.name || ''} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Apellido *</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Ej: Pérez" value={newUser.lastName || ''} onChange={e => setNewUser({...newUser, lastName: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Email *</label>
                                <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                    type="email" placeholder="usuario@peniel.com" value={newUser.email || ''} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Teléfono</label>
                                <input className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                    placeholder="+54 9 ..." value={newUser.phone || ''} onChange={e => setNewUser({...newUser, phone: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Perfil de Usuario</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setNewUser({...newUser, profile: UserProfile.ADMIN})}
                                        className={`p-3 rounded-lg border text-center font-medium transition-colors flex flex-col items-center gap-1 ${newUser.profile === UserProfile.ADMIN ? 'bg-[#1B365D]/10 border-[#1B365D] text-[#1B365D] ring-1 ring-[#1B365D]' : 'bg-white border-slate-200 text-slate-600'}`}
                                    >
                                        <Shield size={20} />
                                        ADMINISTRADOR
                                    </button>
                                    <button 
                                        onClick={() => setNewUser({...newUser, profile: UserProfile.USER})}
                                        className={`p-3 rounded-lg border text-center font-medium transition-colors flex flex-col items-center gap-1 ${newUser.profile === UserProfile.USER ? 'bg-slate-100 border-slate-400 text-slate-800 ring-1 ring-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}
                                    >
                                        <UserIcon size={20} />
                                        USUARIO
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CHURCH DATA FORM */}
                    {activeTab === 'church' && (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Nombre de la Iglesia *</label>
                                <div className="relative">
                                    <Home className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                    <input className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Ej: Peniel (MCyM)" value={newChurchData.name} onChange={e => setNewChurchData({...newChurchData, name: e.target.value})} />
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Dirección</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                    <input className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Ej: Av. Principal 123" value={newChurchData.address || ''} onChange={e => setNewChurchData({...newChurchData, address: e.target.value})} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Pastor</label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                        <input className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                            placeholder="Nombre Pastor" value={newChurchData.pastor || ''} onChange={e => setNewChurchData({...newChurchData, pastor: e.target.value})} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Teléfono</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                        <input className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                            placeholder="+54 9..." value={newChurchData.phone || ''} onChange={e => setNewChurchData({...newChurchData, phone: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500">Logo (Enlace Google Drive)</label>
                                <div className="relative">
                                    <Link className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                    <input className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D]" 
                                        placeholder="Pegar enlace de compartir aquí..." value={newChurchData.logoUrl || ''} onChange={e => setNewChurchData({...newChurchData, logoUrl: e.target.value})} />
                                </div>
                                <div className="bg-blue-50 p-2 rounded text-[10px] text-blue-700 flex gap-2">
                                    <Info size={14} className="shrink-0 mt-0.5" />
                                    <span>
                                        Pega el enlace de "Compartir" de Google Drive. El sistema lo convertirá automáticamente para que sea visible. Asegúrate que el archivo esté configurado como "Público" (Cualquier persona con el enlace).
                                    </span>
                                </div>
                                
                                {newChurchData.logoUrl && (
                                    <div className="mt-3 bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Vista Previa</span>
                                        {/* Use converter for immediate preview */}
                                        <img 
                                            src={convertDriveLink(newChurchData.logoUrl)} 
                                            alt="Vista Previa" 
                                            className="w-16 h-16 object-contain rounded-full border border-slate-300 mx-auto bg-white shadow-sm" 
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).parentElement!.innerHTML += '<span class="text-xs text-rose-500">Error al cargar imagen. Verifique el link.</span>';
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t">
                    <button onClick={closeModal} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button 
                        disabled={isProcessing}
                        onClick={() => {
                            if (activeTab === 'centers') saveCenter();
                            if (activeTab === 'types') saveTypeHandler();
                            if (activeTab === 'currencies') addCurrency();
                            if (activeTab === 'users') saveUserHandler();
                            if (activeTab === 'church') saveChurchHandler();
                        }}
                        className="px-4 py-2 bg-[#1B365D] text-white font-medium rounded-lg hover:bg-[#152a48] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                        {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                        Guardar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MasterData;