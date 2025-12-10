import React, { useState, useRef } from 'react';
import { Center, MovementType, MovementCategory, User, UserProfile } from '../types';
import { Trash2, Plus, X, Building, MapPin, User as UserIcon, Phone, Image as ImageIcon, Pencil, Mail, Shield, Upload, Loader2 } from 'lucide-react';
import { saveDocument, deleteDocument, updateCurrencies, updateLogoUrl, uploadImage } from '../services/firebaseService';

interface MasterDataProps {
  centers: Center[];
  movementTypes: MovementType[];
  currencies: string[];
  users: User[];
  appLogo: string | null;
}

const MasterData: React.FC<MasterDataProps> = ({ 
  centers, movementTypes, currencies, users, appLogo
}) => {
  const [activeTab, setActiveTab] = useState<'centers' | 'types' | 'currencies' | 'users' | 'config'>('centers');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  // -- Handlers --
  const openModal = () => {
    setEditingId(null); // Reset edit mode
    setNewCenter({});
    setNewType({ category: MovementCategory.INCOME, name: '', subCategory: '' });
    setNewCurrency('');
    setNewUser({ profile: UserProfile.USER });
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
        const id = editingId || undefined; // Let firebase gen id if new? actually saveDocument handles add if no id
        // For add we typically want auto-ID or we generate one. saveDocument supports both.
        // Let's rely on saveDocument logic. If editingId exists, it updates. If not, it adds.
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
        closeModal();
      } finally {
        setIsProcessing(false);
      }
    } else {
        alert("Nombre y Código son obligatorios");
    }
  };

  const deleteCenterHandler = async (id: string) => {
      if(window.confirm("¿Estás seguro de eliminar este centro?")) {
        await deleteDocument('centers', id);
      }
  };

  // --- MOVEMENT TYPE LOGIC ---
  const addType = async () => {
    if (newType.name) {
      setIsProcessing(true);
      try {
        await saveDocument('movement_types', { 
            name: newType.name, 
            category: newType.category,
            subCategory: newType.subCategory || null
        });
        closeModal();
      } finally {
        setIsProcessing(false);
      }
    }
  };
  const deleteTypeHandler = async (id: string) => await deleteDocument('movement_types', id);

  // --- CURRENCY LOGIC ---
  const addCurrency = async () => {
    if (newCurrency && !currencies.includes(newCurrency)) {
      setIsProcessing(true);
      try {
        const updated = [...currencies, newCurrency.toUpperCase()];
        await updateCurrencies(updated);
        closeModal();
      } finally {
        setIsProcessing(false);
      }
    }
  };
  const deleteCurrencyHandler = async (c: string) => {
      const updated = currencies.filter(cur => cur !== c);
      await updateCurrencies(updated);
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
             closeModal();
          } finally {
             setIsProcessing(false);
          }
      } else {
          alert("Nombre, Apellido y Email son obligatorios");
      }
  };

  const deleteUserHandler = async (id: string) => {
      if (users.length <= 1) {
          alert("No puedes eliminar el único usuario del sistema.");
          return;
      }
      if(window.confirm("¿Estás seguro de eliminar este usuario?")) {
        await deleteDocument('users', id);
      }
  };


  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) { 
            alert("La imagen es demasiado grande. Intenta subir una imagen de menos de 2MB.");
            return;
        }
        
        setIsProcessing(true);
        try {
            const url = await uploadImage(file, 'app_config/logo.png');
            await updateLogoUrl(url);
        } catch (error) {
            console.error(error);
            alert("Error al subir imagen");
        } finally {
            setIsProcessing(false);
        }
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
          onClick={() => setActiveTab('config')}
          className={`flex-1 py-4 px-4 text-center font-medium transition-colors whitespace-nowrap ${activeTab === 'config' ? 'bg-[#1B365D] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Configuración
        </button>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-[#1B365D]">
                {activeTab === 'centers' ? 'Gestión de Centros' : 
                 activeTab === 'types' ? 'Tipos de Movimiento' : 
                 activeTab === 'currencies' ? 'Monedas Habilitadas' : 
                 activeTab === 'users' ? 'Gestión de Usuarios' : 'Configuración de la App'}
            </h2>
            
            {activeTab !== 'config' && (
                <button 
                    onClick={openModal}
                    className="bg-[#84cc16] text-white px-4 py-2 rounded-lg hover:bg-lime-600 flex items-center gap-2 shadow-sm font-medium"
                >
                    <Plus size={18} /> Agregar Nuevo
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
                        <button onClick={() => deleteTypeHandler(m.id)} className="text-rose-500 hover:bg-rose-50 p-1 rounded">
                          <Trash2 size={16} />
                        </button>
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

        {/* CONFIG (LOGO) */}
        {activeTab === 'config' && (
            <div className="max-w-xl">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                    <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-[#1B365D]" />
                        Logo de la Institución
                    </h3>
                    
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="w-32 h-32 bg-white rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative">
                            {isProcessing && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#1B365D]" />
                                </div>
                            )}
                            {appLogo ? (
                                <img src={appLogo} alt="Logo Actual" className="w-full h-full object-contain p-2" />
                            ) : (
                                <span className="text-xs text-slate-400 text-center px-2">Sin logo personalizado</span>
                            )}
                        </div>
                        
                        <div className="flex-1 space-y-3">
                            <p className="text-sm text-slate-600">
                                Sube el logo de la iglesia para que aparezca en la cabecera de la aplicación y en los reportes PDF.
                            </p>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => logoInputRef.current?.click()}
                                    disabled={isProcessing}
                                    className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                                >
                                    <Upload className="w-4 h-4" />
                                    Subir Imagen
                                </button>
                                {appLogo && (
                                    <button 
                                        onClick={async () => {
                                            if(window.confirm('¿Eliminar logo?')) await updateLogoUrl(null);
                                        }}
                                        disabled={isProcessing}
                                        className="text-rose-500 px-4 py-2 rounded-lg hover:bg-rose-50 transition-colors text-sm font-medium disabled:opacity-50"
                                    >
                                        Eliminar
                                    </button>
                                )}
                            </div>
                            <input 
                                type="file" 
                                ref={logoInputRef} 
                                className="hidden" 
                                accept="image/png, image/jpeg, image/svg+xml"
                                onChange={handleLogoUpload}
                            />
                            <p className="text-xs text-slate-400">Recomendado: PNG o SVG fondo transparente.</p>
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
                         activeTab === 'types' ? 'Nuevo Tipo de Movimiento' : 
                         activeTab === 'users' ? (editingId ? 'Editar Usuario' : 'Nuevo Usuario') : 'Nueva Moneda'}
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

                </div>

                <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t">
                    <button onClick={closeModal} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button 
                        disabled={isProcessing}
                        onClick={() => {
                            if (activeTab === 'centers') saveCenter();
                            if (activeTab === 'types') addType();
                            if (activeTab === 'currencies') addCurrency();
                            if (activeTab === 'users') saveUserHandler();
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