import React, { useState, useRef, useEffect } from 'react';
import { Transaction, Center, MovementType } from '../types';
import { Camera, Loader2, X, Save, FileText, Clock, TrendingUp, Hash, DollarSign, Search, ChevronDown } from 'lucide-react';

interface TransactionFormProps {
  onSave: (transaction: Omit<Transaction, 'id'>, inversionData?: any) => Promise<void>;
  onCancel: () => void;
  centers: Center[];
  movementTypes: MovementType[];
  currencies: string[];
  initialData?: Transaction;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  onSave, onCancel, centers, movementTypes, currencies, initialData 
}) => {
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [centerId, setCenterId] = useState(initialData?.centerId || (centers.length > 0 ? centers[0].id : ''));
  const [movementTypeId, setMovementTypeId] = useState(initialData?.movementTypeId || (movementTypes.length > 0 ? movementTypes[0].id : ''));
  const [detail, setDetail] = useState(initialData?.detail || '');
  const [amount, setAmount] = useState<string>(initialData ? initialData.amount.toString() : '');
  const [currency, setCurrency] = useState<string>(initialData?.currency || (currencies[0] || 'ARS'));
  const [attachment, setAttachment] = useState<string | undefined>(initialData?.attachment);
  const [includeInPdf, setIncludeInPdf] = useState(initialData ? !initialData.excludeFromPdf : true);
  
  const [isInversionType, setIsInversionType] = useState(false);
  const [invDays, setInvDays] = useState(30);
  const [invInterest, setInvInterest] = useState('');
  const [invVoucher, setInvVoucher] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Searchable Type Select State ---
  const [typeSearch, setTypeSearch] = useState('');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedType = movementTypes.find(m => m.id === movementTypeId);
    if (selectedType) setTypeSearch(selectedType.name);
  }, [movementTypeId, movementTypes]);

  useEffect(() => {
    setIsInversionType(movementTypeId === 'egr_inversiones');
  }, [movementTypeId]);

  useEffect(() => {
    if (initialData) {
        setDate(initialData.date);
        setCenterId(initialData.centerId);
        setMovementTypeId(initialData.movementTypeId);
        setDetail(initialData.detail);
        setAmount(initialData.amount.toString());
        setCurrency(initialData.currency);
        setAttachment(initialData.attachment);
        setIncludeInPdf(!initialData.excludeFromPdf);
    }
  }, [initialData]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
        // Reset search to current selection if closed without selecting
        const current = movementTypes.find(m => m.id === movementTypeId);
        if (current) setTypeSearch(current.name);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [movementTypeId, movementTypes]);

  const filteredMovementTypes = movementTypes.filter(m => 
    m.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const elem = document.createElement('canvas');
          const maxWidth = 1000;
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
          elem.width = width; elem.height = height;
          const ctx = elem.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(elem.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingImage(true);
      try { const compressedBase64 = await compressImage(file); setAttachment(compressedBase64); } 
      catch (error) { console.error(error); } 
      finally { setIsProcessingImage(false); }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    setIsSaving(true);
    const transactionData = { date, centerId, movementTypeId, detail, amount: parseFloat(amount), currency, attachment, excludeFromPdf: !includeInPdf };
    let inversionData = null;
    if (isInversionType && !initialData) {
        inversionData = { date, description: detail, amount: parseFloat(amount), currency, days: invDays, interest: parseFloat(invInterest) || 0, voucher: invVoucher, status: 'ACTIVE' };
    }
    try { await onSave(transactionData, inversionData); } 
    catch (error) { console.error(error); } 
    finally { setIsSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 flex flex-col">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-[#1B365D] outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Centro</label>
          <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-[#1B365D] outline-none bg-white">
            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* --- Searchable Movement Type Select --- */}
      <div className="relative" ref={typeDropdownRef}>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo Movimiento</label>
        <div 
          className="relative group cursor-text"
          onClick={() => setIsTypeDropdownOpen(true)}
        >
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 group-focus-within:text-[#1B365D]" />
          <input 
            type="text" 
            value={typeSearch}
            onChange={(e) => {
              setTypeSearch(e.target.value);
              setIsTypeDropdownOpen(true);
            }}
            onFocus={() => setIsTypeDropdownOpen(true)}
            placeholder="Buscar tipo de movimiento..."
            className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-[#1B365D] outline-none bg-white font-medium"
          />
          <ChevronDown className={`w-4 h-4 absolute right-3 top-2.5 text-slate-400 transition-transform ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
        </div>
        
        {isTypeDropdownOpen && (
          <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
            {filteredMovementTypes.length > 0 ? (
              filteredMovementTypes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMovementTypeId(m.id);
                    setTypeSearch(m.name);
                    setIsTypeDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center justify-between group ${movementTypeId === m.id ? 'bg-blue-50 text-[#1B365D] font-bold' : 'text-slate-700'}`}
                >
                  <span>{m.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-black ${m.category === 'INCOME' ? 'bg-lime-100 text-lime-700' : 'bg-rose-100 text-rose-700'}`}>
                    {m.category === 'INCOME' ? 'Entrada' : 'Salida'}
                  </span>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-slate-400 text-xs italic">
                No se encontraron tipos que coincidan
              </div>
            )}
          </div>
        )}
      </div>

      {isInversionType && !initialData && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 text-[#1B365D] mb-1">
                  <TrendingUp size={14} />
                  <span className="text-xs font-bold">Datos Inversión</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                  <input type="number" required placeholder="Días" value={invDays} onChange={(e) => setInvDays(parseInt(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-xs" />
                  <input type="number" step="0.01" placeholder="Interés Est." value={invInterest} onChange={(e) => setInvInterest(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs text-green-600 font-bold" />
              </div>
              <input type="text" placeholder="N° Comprobante" value={invVoucher} onChange={(e) => setInvVoucher(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs" />
          </div>
      )}

      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Detalle</label>
        <input type="text" required value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Descripción" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-[#1B365D] outline-none" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto</label>
           <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-bold focus:ring-2 focus:ring-[#1B365D] outline-none" />
        </div>
        <div>
           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Moneda</label>
           <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-[#1B365D] outline-none bg-white">
             {currencies.map(c => <option key={c} value={c}>{c}</option>)}
           </select>
        </div>
      </div>

      <div className="flex items-center gap-2 py-1">
          <input type="checkbox" id="includePdf" checked={includeInPdf} onChange={(e) => setIncludeInPdf(e.target.checked)} className="w-4 h-4 text-[#1B365D] border-slate-300" />
          <label htmlFor="includePdf" className="text-xs text-slate-600 cursor-pointer">Incluir en Planilla PDF</label>
      </div>

      <div>
        {!attachment ? (
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:bg-slate-50 transition-colors">
            {isProcessingImage ? <Loader2 className="w-6 h-6 text-[#1B365D] animate-spin mx-auto mb-1" /> : <Camera className="w-6 h-6 text-slate-400 mx-auto mb-1" />}
            <p className="text-[10px] text-slate-500">{isProcessingImage ? 'Procesando...' : 'Subir foto'}</p>
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden border border-slate-200">
            <img src={attachment} alt="Preview" className="w-full h-24 object-cover" />
            <button type="button" onClick={() => setAttachment(undefined)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><X size={12} /></button>
          </div>
        )}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-100 mt-auto">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold text-sm">Cancelar</button>
        <button type="submit" disabled={isSaving || isProcessingImage} className="flex-1 py-2.5 bg-[#1B365D] text-white rounded-lg font-bold text-sm flex justify-center items-center gap-2 shadow-sm disabled:opacity-70">
          {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;