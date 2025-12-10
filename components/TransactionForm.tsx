import React, { useState, useRef } from 'react';
import { Transaction, Center, MovementType } from '../types';
import { Camera, Loader2, X } from 'lucide-react';
// import { analyzeReceiptImage } from '../services/geminiService'; // Desactivado

interface TransactionFormProps {
  onSave: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  onCancel: () => void;
  centers: Center[];
  movementTypes: MovementType[];
  currencies: string[];
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onSave, onCancel, centers, movementTypes, currencies }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [centerId, setCenterId] = useState(centers.length > 0 ? centers[0].id : '');
  const [movementTypeId, setMovementTypeId] = useState(movementTypes.length > 0 ? movementTypes[0].id : '');
  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>(currencies[0] || 'ARS');
  const [attachment, setAttachment] = useState<string | undefined>(undefined);
  
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setAttachment(base64);
        // AI Analysis removed
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        await onSave({
          date,
          centerId,
          movementTypeId,
          detail,
          amount: parseFloat(amount),
          currency,
          attachment
        });
    } catch (error) {
        // Error handling done in parent
    } finally {
        setIsSaving(false);
    }
  };

  const removeAttachment = () => {
    setAttachment(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto space-y-6 border-t-4 border-[#1B365D]">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold text-[#1B365D]">Registrar Movimiento</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
          <input 
            type="date" 
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-white text-slate-900 rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#1B365D] focus:outline-none"
          />
        </div>

        {/* Center */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Centro</label>
          <select 
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            className="w-full bg-white text-slate-900 rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#1B365D] focus:outline-none"
          >
            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Movement Type */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Movimiento</label>
          <select 
            value={movementTypeId}
            onChange={(e) => setMovementTypeId(e.target.value)}
            className="w-full bg-white text-slate-900 rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#1B365D] focus:outline-none"
          >
            {movementTypes.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.category === 'INCOME' ? '+' : '-'})
              </option>
            ))}
          </select>
        </div>

        {/* Detail */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Detalle / Descripción</label>
          <input 
            type="text" 
            required
            placeholder="Ej: Pago de servicios básicos"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className="w-full bg-white text-slate-900 rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#1B365D] focus:outline-none"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Monto</label>
          <input 
            type="number" 
            required
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white text-slate-900 rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#1B365D] focus:outline-none"
          />
        </div>

        {/* Currency */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
          <select 
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full bg-white text-slate-900 rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#1B365D] focus:outline-none"
          >
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Attachment */}
        <div className="md:col-span-2">
           <label className="block text-sm font-medium text-slate-700 mb-2">Adjunto (Recibo/Factura)</label>
           
           {!attachment ? (
             <div 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors group"
             >
                <div className="bg-slate-100 p-3 rounded-full mb-3 group-hover:bg-[#1B365D]/10 transition-colors">
                    <Camera className="w-6 h-6 text-[#1B365D]" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Toca para tomar foto o subir archivo</p>
                <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
             </div>
           ) : (
             <div className="relative inline-block border rounded-lg overflow-hidden bg-white">
                <img src={attachment} alt="Adjunto" className="h-48 object-cover" />
                <button 
                    type="button"
                    onClick={removeAttachment}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 shadow-md"
                >
                    <X className="w-4 h-4" />
                </button>
             </div>
           )}
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t mt-4">
        <button 
            type="button" 
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 py-3 px-4 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors bg-white disabled:opacity-50"
        >
            Cancelar
        </button>
        <button 
            type="submit" 
            disabled={isSaving}
            className="flex-1 py-3 px-4 rounded-lg bg-[#1B365D] text-white font-medium hover:bg-[#152a48] transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
        >
            {isSaving ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                </>
            ) : (
                'Guardar Movimiento'
            )}
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;