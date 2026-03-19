import React, { useState, useRef, useMemo } from 'react';
import { Inversion, Center, MovementType, MovementCategory } from '../types';
import { TrendingUp, Plus, Calendar, FileText, DollarSign, Clock, Hash, Trash2, Pencil, Eye, X, Upload, Loader2, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { saveDocument, deleteDocument, uploadImage } from '../services/firebaseService';
import { useToast } from './Toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface InversionsProps {
  isAdmin: boolean;
  inversions: Inversion[]; 
  centers?: Center[]; 
  currencies?: string[];
  movementTypes: MovementType[]; 
}

const Inversions: React.FC<InversionsProps> = ({ isAdmin, inversions, centers = [], currencies = ['ARS'], movementTypes }) => {
  const { showToast } = useToast();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteData, setDeleteData] = useState<Inversion | null>(null); 
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [finishModal, setFinishModal] = useState<{ isOpen: boolean; data: Inversion | null }>({ isOpen: false, data: null });
  const [finishInterest, setFinishInterest] = useState('');
  const [finishMonth, setFinishMonth] = useState('');

  const initialFormState: Partial<Inversion> = {
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    currency: currencies[0] || 'ARS', 
    days: 30,
    interest: 0,
    voucher: '',
    status: 'ACTIVE'
  };
  const [formData, setFormData] = useState<Partial<Inversion>>(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const findTypeByExactName = (name: string, category: MovementCategory) => {
      const type = movementTypes.find(m => m.name.toUpperCase() === name.toUpperCase() && m.category === category);
      return type ? type.id : null;
  };

  const getRecuperoTypeId = () => findTypeByExactName('RECUPERO INVERSIONES PENIEL', MovementCategory.INCOME) || 'ing_recupero_inversion';
  const getInversionSalidaTypeId = () => findTypeByExactName('INVERSIONES PENIEL', MovementCategory.EXPENSE) || 'egr_inversiones';
  const getOtrosIngresosTypeId = () => findTypeByExactName('OTROS INGRESOS', MovementCategory.INCOME) || findTypeByExactName('OTRAS ENTRADAS', MovementCategory.INCOME) || 'ing_otras_entradas';

  const getMaturityInfo = (dateStr: string, days: number) => {
      const start = new Date(dateStr + 'T12:00:00');
      const maturityDate = new Date(start);
      maturityDate.setDate(start.getDate() + days);
      const today = new Date(); today.setHours(0,0,0,0);
      const mDate = new Date(maturityDate); mDate.setHours(0,0,0,0);
      const isMature = today >= mDate;
      const diffTime = mDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { maturityDate: mDate.toLocaleDateString('es-AR'), isMature, daysRemaining: diffDays > 0 ? diffDays : 0 };
  };

  const handleEdit = (inv: Inversion) => { 
      if (!isAdmin) {
          showToast("No tienes permisos para editar inversiones", 'error');
          return;
      }
      setFormData(inv); 
      setIsFormOpen(true); 
  };
  const handleCreate = () => { 
      if (!isAdmin) {
          showToast("No tienes permisos para crear inversiones", 'error');
          return;
      }
      setFormData({ ...initialFormState, currency: currencies[0] || 'ARS' }); 
      setIsFormOpen(true); 
  };

  const handleDelete = async () => {
      if (!deleteData) return;
      if (!isAdmin) {
          showToast("No tienes permisos para eliminar inversiones", 'error');
          return;
      }
      setIsSaving(true);
      try {
          if (deleteData.linkedTransactionId && deleteData.status === 'ACTIVE') {
              try { await deleteDocument('transactions', deleteData.linkedTransactionId); } 
              catch (e) { console.error(e); }
          }
          await deleteDocument('inversions', deleteData.id);
          showToast("Inversión eliminada", 'success');
          setDeleteData(null);
      } catch (error) { showToast("Error al eliminar", 'error'); } 
      finally { setIsSaving(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setFormData(prev => ({ ...prev, attachment: reader.result as string }));
          reader.readAsDataURL(file);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.description || !formData.amount || !formData.date) return;
      setIsSaving(true);
      try {
          let attachmentUrl = formData.attachment;
          if (attachmentUrl && attachmentUrl.startsWith('data:')) {
              attachmentUrl = await uploadImage(attachmentUrl, `inversions/${Date.now()}.jpg`);
          }
          if (formData.id) {
              await saveDocument('inversions', { ...formData, attachment: attachmentUrl || null }, formData.id);
              if (formData.linkedTransactionId && formData.status === 'ACTIVE') {
                  await saveDocument('transactions', { date: formData.date, detail: formData.description, amount: formData.amount, currency: formData.currency }, formData.linkedTransactionId);
              }
              showToast("Actualizado", 'success');
          } else {
              const savedTxId = await saveDocument('transactions', { date: formData.date, centerId: centers[0]?.id || 'c1', movementTypeId: getInversionSalidaTypeId(), detail: formData.description || 'Inversión', amount: formData.amount, currency: formData.currency || 'ARS', attachment: attachmentUrl || null, excludeFromPdf: false });
              await saveDocument('inversions', { ...formData, linkedTransactionId: savedTxId, attachment: attachmentUrl || null, status: 'ACTIVE' });
              showToast("Inversión registrada", 'success');
          }
          setIsFormOpen(false);
      } catch (error) { showToast("Error al guardar", 'error'); } 
      finally { setIsSaving(false); }
  };

  const openFinishModal = (inv: Inversion) => {
    if (!isAdmin) {
        showToast("No tienes permisos para cobrar inversiones", 'error');
        return;
    }
    setFinishModal({ isOpen: true, data: inv });
    setFinishInterest(inv.interest.toString());
    const monthName = new Date().toLocaleString('es-ES', { month: 'long' });
    setFinishMonth(monthName.charAt(0).toUpperCase() + monthName.slice(1));
  };

  const handleFinishInversion = async () => {
      if (!finishModal.data) return;
      const interestAmount = parseFloat(finishInterest);
      if (isNaN(interestAmount) || interestAmount < 0 || !finishMonth) return;
      setIsSaving(true);
      try {
          const finishDate = new Date().toISOString().split('T')[0];
          const centerId = centers[0]?.id || 'c1';
          await saveDocument('transactions', { date: finishDate, centerId, movementTypeId: getRecuperoTypeId(), detail: `Recupero - ${finishModal.data.description}`, amount: finishModal.data.amount, currency: finishModal.data.currency || 'ARS', attachment: null, excludeFromPdf: true });
          if (interestAmount > 0) {
              await saveDocument('transactions', { date: finishDate, centerId, movementTypeId: getOtrosIngresosTypeId(), detail: `Interés - ${finishModal.data.description} - ${finishMonth}`, amount: interestAmount, currency: finishModal.data.currency || 'ARS', attachment: null, excludeFromPdf: false });
          }
          await saveDocument('inversions', { status: 'FINISHED' }, finishModal.data.id);
          showToast("Inversión cobrada", 'success');
          setFinishModal({ isOpen: false, data: null });
      } catch (error) { showToast("Error al procesar", 'error'); } 
      finally { setIsSaving(false); }
  };

  const totalInvested = inversions.filter(i => i.status === 'ACTIVE').reduce((acc, curr) => acc + curr.amount, 0);
  const potentialInterest = inversions.filter(i => i.status === 'ACTIVE').reduce((acc, curr) => acc + curr.interest, 0);

  const monthlyChartData = useMemo(() => {
    const grouped: Record<string, { capital: number; interest: number }> = {};
    inversions.forEach(inv => {
        const key = inv.date.substring(0, 7);
        if (!grouped[key]) grouped[key] = { capital: 0, interest: 0 };
        grouped[key].capital += inv.amount;
        grouped[key].interest += inv.interest;
    });
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])).map(([key, data]) => {
        const [y, m] = key.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1);
        const name = date.toLocaleString('es-ES', { month: 'short' });
        return { name: name.charAt(0).toUpperCase() + name.slice(1), ...data };
    });
  }, [inversions]);

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1B365D] rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Capital Activo</p>
                    <h2 className="text-3xl font-bold">$ {totalInvested.toLocaleString()}</h2>
                </div>
                <TrendingUp className="absolute right-4 bottom-4 text-white/10 w-24 h-24" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                 <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Interés Estimado</p>
                 <h2 className="text-3xl font-bold text-[#84cc16]">$ {potentialInterest.toLocaleString()}</h2>
            </div>
        </div>

        {monthlyChartData.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChartData}>
                        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip />
                        <Bar name="Capital" dataKey="capital" fill="#1B365D" radius={[4, 4, 0, 0]} />
                        <Bar name="Interés" dataKey="interest" fill="#84cc16" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )}

        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
            <h3 className="font-bold text-[#1B365D] flex items-center gap-2"><TrendingUp size={18} /> Inversiones</h3>
            {isAdmin && <button onClick={handleCreate} className="bg-[#1B365D] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Plus size={16} /> Nueva</button>}
        </div>

        <div className="space-y-4">
            {inversions.map(inv => {
                const isFinished = inv.status === 'FINISHED';
                const { isMature, maturityDate, daysRemaining } = getMaturityInfo(inv.date, inv.days);
                return (
                    <div key={inv.id} className={`rounded-xl p-4 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${isFinished ? 'bg-slate-50 opacity-80' : 'bg-white'}`}>
                        <div className="flex gap-4">
                            <div className={`p-3 rounded-lg ${isFinished ? 'bg-slate-200' : 'bg-blue-50 text-[#1B365D]'}`}><FileText size={20} /></div>
                            <div>
                                <h4 className={`font-bold ${isFinished ? 'text-slate-400 line-through' : ''}`}>{inv.description}</h4>
                                <div className="text-[10px] text-slate-400 font-bold flex flex-wrap gap-2 mt-1">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">{inv.date}</span>
                                    {!isFinished && <span className={isMature ? 'bg-lime-100 text-lime-700 px-1.5 py-0.5 rounded' : 'bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded'}>{isMature ? 'Listo para cobrar' : `Vence: ${maturityDate}`}</span>}
                                    {isFinished && <span className="bg-slate-200 px-1.5 py-0.5 rounded uppercase">Finalizada</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-6">
                            <div className="text-right"><p className="text-[10px] text-slate-400 font-bold">MONTO</p><p className="font-bold text-[#1B365D]">$ {inv.amount.toLocaleString()}</p></div>
                            <div className="flex gap-2">
                                {isAdmin && !isFinished && (
                                    <button onClick={() => openFinishModal(inv)} disabled={!isMature} className={`p-2 rounded-lg text-white ${isMature ? 'bg-[#84cc16]' : 'bg-slate-200'}`} title="Cobrar Inversión">
                                        <CheckCircle size={16} />
                                    </button>
                                )}
                                {isAdmin && (
                                    <>
                                        <button onClick={() => handleEdit(inv)} className="p-2 text-slate-400 hover:text-[#1B365D]" title="Editar Inversión">
                                            <Pencil size={16} />
                                        </button>
                                        <button onClick={() => setDeleteData(inv)} className="p-2 text-slate-400 hover:text-rose-600" title="Eliminar Inversión">
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>

        {isFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                    <div className="bg-[#1B365D] px-4 py-3 flex justify-between items-center shrink-0">
                        <h3 className="text-white font-bold">{formData.id ? 'Editar Inversión' : 'Nueva Inversión'}</h3>
                        <button onClick={() => setIsFormOpen(false)} className="text-white/80"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 border rounded text-sm" />
                            <input type="text" required placeholder="N° Certificado" value={formData.voucher} onChange={e => setFormData({...formData, voucher: e.target.value})} className="w-full p-2 border rounded text-sm" />
                        </div>
                        <input type="text" required placeholder="Descripción" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 border rounded text-sm" />
                        <div className="grid grid-cols-2 gap-3">
                            <input type="number" required placeholder="Monto" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm font-bold" />
                            <select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="w-full p-2 border rounded text-sm">{currencies?.map(c => <option key={c} value={c}>{c}</option>)}</select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input type="number" required placeholder="Días" value={formData.days} onChange={e => setFormData({...formData, days: parseInt(e.target.value)})} className="w-full p-2 border rounded text-sm" />
                            <input type="number" required placeholder="Interés Est." value={formData.interest} onChange={e => setFormData({...formData, interest: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm text-[#84cc16] font-bold" />
                        </div>
                        <div className="pt-4 border-t flex gap-3">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2.5 border rounded-lg text-slate-600 font-bold">Cancelar</button>
                            <button type="submit" disabled={isSaving} className="flex-1 py-2.5 bg-[#1B365D] text-white rounded-lg font-bold flex justify-center items-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={18} />} Guardar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {finishModal.isOpen && finishModal.data && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                 <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                     <h3 className="text-[#84cc16] font-bold text-lg flex items-center gap-2"><CheckCircle /> Cobrar Intereses</h3>
                     <input type="text" value={finishMonth} onChange={e => setFinishMonth(e.target.value)} placeholder="Mes" className="w-full p-2 border rounded" />
                     <input type="number" value={finishInterest} onChange={e => setFinishInterest(e.target.value)} className="w-full p-2 border rounded text-lg font-bold text-[#84cc16]" />
                     <div className="flex gap-3 pt-2"><button onClick={() => setFinishModal({ isOpen: false, data: null })} className="flex-1 py-2 border rounded">Cerrar</button><button onClick={handleFinishInversion} disabled={isSaving} className="flex-1 py-2 bg-[#84cc16] text-white rounded font-bold">Confirmar</button></div>
                 </div>
            </div>
        )}
        
        {deleteData && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-xl p-6 w-full max-w-sm text-center">
                    <Trash2 className="mx-auto text-rose-600 w-12 h-12 mb-4" />
                    <h3 className="font-bold mb-2">¿Eliminar Inversión?</h3>
                    <div className="flex gap-2 mt-4"><button onClick={() => setDeleteData(null)} className="flex-1 py-2 border rounded">No</button><button onClick={handleDelete} className="flex-1 py-2 bg-rose-600 text-white rounded">Sí, Eliminar</button></div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Inversions;