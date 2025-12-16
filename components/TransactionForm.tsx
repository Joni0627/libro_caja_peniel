import React, { useState, useRef, useEffect } from 'react';
import { Transaction, Center, MovementType } from '../types';
import { Camera, Loader2, X, Save, FileText, CheckCircle, Clock, TrendingUp, Hash, DollarSign } from 'lucide-react';

interface TransactionFormProps {
  onSave: (transaction: Omit<Transaction, 'id'>, inversionData?: any) => Promise<void>;
  onCancel: () => void;
  centers: Center[];
  movementTypes: MovementType[];
  currencies: string[];
  initialData?: Transaction; // Optional prop for editing mode
}

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  onSave, onCancel, centers, movementTypes, currencies, initialData 
}) => {
  // Initialize state with default values or initialData if provided
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [centerId, setCenterId] = useState(initialData?.centerId || (centers.length > 0 ? centers[0].id : ''));
  const [movementTypeId, setMovementTypeId] = useState(initialData?.movementTypeId || (movementTypes.length > 0 ? movementTypes[0].id : ''));
  const [detail, setDetail] = useState(initialData?.detail || '');
  const [amount, setAmount] = useState<string>(initialData ? initialData.amount.toString() : '');
  const [currency, setCurrency] = useState<string>(initialData?.currency || (currencies[0] || 'ARS'));
  const [attachment, setAttachment] = useState<string | undefined>(initialData?.attachment);
  
  // Default: Include in PDF (excludeFromPdf = false). 
  // If editing, we invert the stored value (because stored is 'exclude', UI is 'include')
  const [includeInPdf, setIncludeInPdf] = useState(initialData ? !initialData.excludeFromPdf : true);
  
  // --- NEW: INVERSION SPECIFIC FIELDS ---
  const [isInversionType, setIsInversionType] = useState(false);
  const [invDays, setInvDays] = useState(30);
  const [invInterest, setInvInterest] = useState('');
  const [invVoucher, setInvVoucher] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if selected type is "INVERSIONES PENIEL" (ID: egr_inversiones)
  useEffect(() => {
    setIsInversionType(movementTypeId === 'egr_inversiones');
  }, [movementTypeId]);

  // If initialData changes (e.g. modal opens with new data), update state
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

  // Image Compression Utility
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const elem = document.createElement('canvas');
          const maxWidth = 1000; // Resize to max 1000px width
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
          elem.width = width;
          elem.height = height;
          const ctx = elem.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality
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
      try {
        const compressedBase64 = await compressImage(file);
        setAttachment(compressedBase64);
      } catch (error) {
        console.error("Error compressing image:", error);
      } finally {
        setIsProcessingImage(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
        alert("El monto debe ser mayor a 0");
        return;
    }

    setIsSaving(true);
    
    // Base transaction Data
    const transactionData = {
      date,
      centerId,
      movementTypeId,
      detail,
      amount: parseFloat(amount),
      currency,
      attachment,
      excludeFromPdf: !includeInPdf
    };

    // Optional Inversion Data (Only if type is inversion and we are creating, not editing existing)
    // Note: Editing existing transactions linked to inversions is complex, simplified here to creation only.
    let inversionData = null;
    if (isInversionType && !initialData) {
        inversionData = {
            date,
            description: detail, // Link description
            amount: parseFloat(amount),
            days: invDays,
            interest: parseFloat(invInterest) || 0,
            voucher: invVoucher,
            status: 'ACTIVE'
        };
    }

    try {
        await onSave(transactionData, inversionData);
    } catch (error) {
        console.error(error);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
      
      {/* --- STANDARD TRANSACTION FIELDS --- */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
          <input 
            type="date" 
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Centro</label>
          <select 
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none bg-white"
          >
            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Movimiento</label>
            <select 
                value={movementTypeId}
                onChange={(e) => setMovementTypeId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none bg-white"
            >
                {movementTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
        </div>
      </div>

      {/* --- INVERSION SPECIFIC FIELDS (CONDITIONAL) --- */}
      {isInversionType && !initialData && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-[#1B365D] mb-1">
                  <TrendingUp size={16} />
                  <span className="text-sm font-bold">Datos de la Inversión</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Plazo (Días)</label>
                      <div className="relative">
                          <Clock className="absolute left-2 top-2 text-slate-400 w-3 h-3" />
                          <input 
                              type="number" 
                              required={isInversionType}
                              value={invDays}
                              onChange={(e) => setInvDays(parseInt(e.target.value) || 0)}
                              className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-[#1B365D] outline-none"
                          />
                      </div>
                  </div>
                  <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Interés Estimado</label>
                      <div className="relative">
                          <DollarSign className="absolute left-2 top-2 text-slate-400 w-3 h-3" />
                          <input 
                              type="number" 
                              step="0.01"
                              required={isInversionType}
                              placeholder="0.00"
                              value={invInterest}
                              onChange={(e) => setInvInterest(e.target.value)}
                              className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-[#1B365D] outline-none text-green-600 font-bold"
                          />
                      </div>
                  </div>
              </div>
              <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">N° Comprobante / Certificado</label>
                  <div className="relative">
                      <Hash className="absolute left-2 top-2 text-slate-400 w-3 h-3" />
                      <input 
                          type="text" 
                          required={isInversionType}
                          value={invVoucher}
                          onChange={(e) => setInvVoucher(e.target.value)}
                          placeholder="Ej: 8839201"
                          className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-[#1B365D] outline-none"
                      />
                  </div>
              </div>
          </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
            {isInversionType ? 'Descripción de la Inversión' : 'Detalle / Descripción'}
        </label>
        <div className="relative">
             <FileText className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
             <input 
                type="text" 
                required
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={isInversionType ? "Ej: Plazo Fijo Banco Nación" : "Descripción del movimiento"}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none"
             />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto</label>
           <input 
             type="number" 
             step="0.01"
             required
             value={amount}
             onChange={(e) => setAmount(e.target.value)}
             className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#1B365D] outline-none"
           />
        </div>
        <div>
           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda</label>
           <select 
             value={currency}
             onChange={(e) => setCurrency(e.target.value)}
             className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] outline-none bg-white"
           >
             {currencies.map(c => <option key={c} value={c}>{c}</option>)}
           </select>
        </div>
      </div>

      {/* Checkbox for PDF exclusion */}
      <div className="flex items-center gap-2 pt-1">
          <input 
            type="checkbox" 
            id="includePdf"
            checked={includeInPdf}
            onChange={(e) => setIncludeInPdf(e.target.checked)}
            className="w-4 h-4 text-[#1B365D] rounded focus:ring-[#1B365D] border-slate-300"
          />
          <label htmlFor="includePdf" className="text-sm text-slate-600 cursor-pointer select-none">
             Incluir en Planilla PDF
          </label>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Comprobante (Imagen)</label>
        
        {!attachment ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors"
          >
            {isProcessingImage ? (
               <Loader2 className="w-8 h-8 text-[#1B365D] animate-spin mx-auto mb-2" />
            ) : (
               <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            )}
            <p className="text-xs text-slate-500">
               {isProcessingImage ? 'Procesando...' : 'Click para subir foto'}
            </p>
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden border border-slate-200">
            <img src={attachment} alt="Preview" className="w-full h-32 object-cover" />
            <button 
              type="button"
              onClick={() => setAttachment(undefined)}
              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-sm hover:bg-red-600"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          capture="environment"
          onChange={handleFileChange} 
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button 
          type="button" 
          onClick={onCancel}
          className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          disabled={isSaving || isProcessingImage}
          className="flex-1 py-2.5 bg-[#1B365D] text-white rounded-lg font-bold hover:bg-[#152a48] transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
          Guardar
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;