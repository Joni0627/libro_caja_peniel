import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Inversion } from '../types';
import { TrendingUp, Plus, Calendar, FileText, DollarSign, Clock, Hash, Trash2, Pencil, Eye, X, Upload, Loader2, Save } from 'lucide-react';
import { subscribeToCollection, saveDocument, deleteDocument, uploadImage } from '../services/firebaseService';
import { useToast } from './Toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface InversionsProps {
  isAdmin: boolean;
}

const Inversions: React.FC<InversionsProps> = ({ isAdmin }) => {
  const [inversions, setInversions] = useState<Inversion[]>([]);
  const { showToast } = useToast();
  
  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null); // If not null, delete modal is open
  const [viewImage, setViewImage] = useState<string | null>(null);

  // Form State
  const initialFormState: Partial<Inversion> = {
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    days: 30,
    interest: 0,
    voucher: '',
    status: 'ACTIVE'
  };
  const [formData, setFormData] = useState<Partial<Inversion>>(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeToCollection<Inversion>('inversions', (data) => {
        setInversions(data.sort((a, b) => b.date.localeCompare(a.date)));
    });
    return () => unsub();
  }, []);

  // --- CRUD HANDLERS ---

  const handleEdit = (inv: Inversion) => {
      setFormData(inv);
      setIsFormOpen(true);
  };

  const handleCreate = () => {
      setFormData(initialFormState);
      setIsFormOpen(true);
  };

  const handleDelete = async () => {
      if (!deleteId) return;
      try {
          await deleteDocument('inversions', deleteId);
          showToast("Inversión eliminada correctamente", 'success');
          setDeleteId(null);
      } catch (error) {
          console.error(error);
          showToast("Error al eliminar", 'error');
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setFormData(prev => ({ ...prev, attachment: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.description || !formData.amount || !formData.date) return;
      
      setIsSaving(true);
      try {
          let attachmentUrl = formData.attachment;
          
          // Si hay adjunto y es base64 (nuevo), subirlo
          if (attachmentUrl && attachmentUrl.startsWith('data:')) {
              const fileName = `inversions/${Date.now()}.jpg`;
              attachmentUrl = await uploadImage(attachmentUrl, fileName);
          }

          const dataToSave = {
              ...formData,
              attachment: attachmentUrl || null
          };

          await saveDocument('inversions', dataToSave, formData.id);
          showToast(formData.id ? "Inversión actualizada" : "Inversión registrada", 'success');
          setIsFormOpen(false);
      } catch (error) {
          console.error(error);
          showToast("Error al guardar", 'error');
      } finally {
          setIsSaving(false);
      }
  };

  const totalInvested = inversions.reduce((acc, curr) => acc + curr.amount, 0);
  const potentialInterest = inversions.reduce((acc, curr) => acc + curr.interest, 0);

  // --- CHART DATA (Grouped by Month) ---
  const monthlyChartData = useMemo(() => {
    const grouped: Record<string, { capital: number; interest: number }> = {};

    inversions.forEach(inv => {
        const monthKey = inv.date.substring(0, 7); // YYYY-MM
        if (!grouped[monthKey]) {
            grouped[monthKey] = { capital: 0, interest: 0 };
        }
        grouped[monthKey].capital += inv.amount;
        grouped[monthKey].interest += inv.interest;
    });

    // Convert to array and sort chronologically
    return Object.entries(grouped)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, data]) => {
            const [y, m] = key.split('-');
            const date = new Date(parseInt(y), parseInt(m) - 1);
            // Format: "Ene 24"
            const name = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
            return {
                name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
                ...data
            };
        });
  }, [inversions]);

  return (
    <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1B365D] rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Total Invertido (Capital)</p>
                    <h2 className="text-3xl font-bold">$ {totalInvested.toLocaleString('es-AR')}</h2>
                </div>
                <TrendingUp className="absolute right-4 bottom-4 text-white/10 w-24 h-24" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                 <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Interés Estimado Total</p>
                 <h2 className="text-3xl font-bold text-[#84cc16]">$ {potentialInterest.toLocaleString('es-AR')}</h2>
            </div>
        </div>

        {/* Chart Section */}
        {monthlyChartData.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-4">Evolución Mensual de Inversiones</h3>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} 
                                dy={10} 
                            />
                            <YAxis 
                                hide={false} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                tickFormatter={(value) => `$${value / 1000}k`} 
                            />
                            <Tooltip 
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number, name: string) => [
                                    `$ ${value.toLocaleString('es-AR')}`, 
                                    name === 'capital' ? 'Capital' : 'Interés'
                                ]}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar name="Capital" dataKey="capital" fill="#1B365D" radius={[4, 4, 0, 0]} barSize={40} />
                            <Bar name="Interés" dataKey="interest" fill="#84cc16" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* Action Bar */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-lg text-[#1B365D] flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Cartera de Inversiones
            </h3>
            {isAdmin && (
                <button 
                    onClick={handleCreate}
                    className="bg-[#1B365D] text-white px-4 py-2 rounded-lg hover:bg-[#152a48] transition-colors flex items-center gap-2 text-sm font-bold shadow-sm"
                >
                    <Plus size={16} /> Nueva Inversión
                </button>
            )}
        </div>

        {/* List */}
        <div className="grid grid-cols-1 gap-4">
            {inversions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                    No hay inversiones registradas.
                </div>
            ) : (
                inversions.map(inv => (
                    <div key={inv.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-50 p-3 rounded-lg text-[#1B365D]">
                                <FileText size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-lg">{inv.description}</h4>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                                    <span className="flex items-center gap-1"><Calendar size={14} /> {inv.date}</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> {inv.days} días</span>
                                    <span className="flex items-center gap-1"><Hash size={14} /> Comp: {inv.voucher}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                            <div className="text-right">
                                <p className="text-xs text-slate-400 font-bold uppercase">Monto</p>
                                <p className="font-bold text-lg text-[#1B365D]">$ {inv.amount.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400 font-bold uppercase">Interés</p>
                                <p className="font-bold text-lg text-[#84cc16]">+ $ {inv.interest.toLocaleString()}</p>
                            </div>
                            
                            <div className="flex gap-2 pl-4 border-l border-slate-100">
                                {inv.attachment && (
                                    <button 
                                        onClick={() => setViewImage(inv.attachment || null)}
                                        className="p-2 text-slate-400 hover:text-[#1B365D] hover:bg-slate-50 rounded-lg transition-colors"
                                        title="Ver Adjunto"
                                    >
                                        <Eye size={18} />
                                    </button>
                                )}
                                {isAdmin && (
                                    <>
                                        <button 
                                            onClick={() => handleEdit(inv)}
                                            className="p-2 text-slate-400 hover:text-[#1B365D] hover:bg-slate-50 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button 
                                            onClick={() => setDeleteId(inv.id)}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* --- FORM MODAL --- */}
        {isFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="bg-[#1B365D] px-6 py-4 flex justify-between items-center">
                        <h3 className="text-white font-bold text-lg">
                            {formData.id ? 'Editar Inversión' : 'Nueva Inversión'}
                        </h3>
                        <button onClick={() => setIsFormOpen(false)} className="text-white/80 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({...formData, date: e.target.value})}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comprobante</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="text"
                                        required
                                        placeholder="N° Certificado"
                                        value={formData.voucher}
                                        onChange={e => setFormData({...formData, voucher: e.target.value})}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
                            <input 
                                type="text"
                                required
                                placeholder="Ej: Plazo Fijo Banco Nación"
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto Invertido</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none font-bold text-slate-700"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Interés Estimado</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.interest}
                                        onChange={e => setFormData({...formData, interest: parseFloat(e.target.value)})}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none text-[#84cc16] font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Plazo (Días)</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                <input 
                                    type="number"
                                    required
                                    min="1"
                                    placeholder="Ej: 30"
                                    value={formData.days}
                                    onChange={e => setFormData({...formData, days: parseInt(e.target.value)})}
                                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Adjunto / Comprobante</label>
                            {!formData.attachment ? (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                                >
                                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <p className="text-xs text-slate-500">Click para subir imagen</p>
                                </div>
                            ) : (
                                <div className="relative rounded-lg overflow-hidden border border-slate-200">
                                    <img src={formData.attachment} alt="Adjunto" className="w-full h-32 object-cover" />
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, attachment: undefined})}
                                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-sm hover:bg-red-600"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                        </div>

                        <div className="flex gap-3 pt-4 border-t">
                            <button 
                                type="button" 
                                onClick={() => setIsFormOpen(false)}
                                className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="flex-1 py-2.5 bg-[#1B365D] text-white rounded-lg font-bold hover:bg-[#152a48] flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                                Guardar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* --- DELETE CONFIRMATION MODAL --- */}
        {deleteId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in duration-200">
                    <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="w-8 h-8 text-rose-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">¿Eliminar Inversión?</h3>
                    <p className="text-slate-500 text-sm mb-6">Esta acción no se puede deshacer. Se eliminará el registro de inversión permanentemente.</p>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setDeleteId(null)}
                            className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleDelete}
                            className="flex-1 py-2.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 shadow-sm"
                        >
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- IMAGE VIEWER MODAL --- */}
        {viewImage && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90" onClick={() => setViewImage(null)}>
                <button className="absolute top-4 right-4 text-white hover:text-gray-300">
                    <X size={32} />
                </button>
                <img src={viewImage} alt="Comprobante" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
            </div>
        )}
    </div>
  );
};

export default Inversions;