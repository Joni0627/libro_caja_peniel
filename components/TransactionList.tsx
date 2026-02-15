import React, { useState, useRef, useMemo } from 'react';
import { Transaction, MovementCategory, Center, MovementType } from '../types';
import { FileText, Filter, ArrowUpRight, ArrowDownRight, Eye, Upload, Calendar, X, Download, Search, ChevronDown, Trash2, Pencil, Plus, EyeOff, FileSpreadsheet, TrendingUp, TrendingDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { deleteDocument, saveDocument, uploadImage } from '../services/firebaseService';
import TransactionForm from './TransactionForm';
import { useToast } from './Toast';

interface TransactionListProps {
  transactions: Transaction[];
  onImport: (data: Transaction[]) => void;
  centers: Center[];
  movementTypes: MovementType[];
  currencies: string[];
  onSaveNew: (data: Omit<Transaction, 'id'>) => Promise<void>;
  isAdmin: boolean;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onImport, centers, movementTypes, currencies, onSaveNew, isAdmin }) => {
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTypeId, setFilterTypeId] = useState('');

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    data?: Transaction;
  }>({ isOpen: false, mode: 'create' });

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfTargetMonth, setPdfTargetMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [viewImage, setViewImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const getTypeName = (id: string) => movementTypes.find(m => m.id === id)?.name || 'Desconocido';
  const getCenterName = (id: string) => centers.find(c => c.id === id)?.name || 'Desconocido';
  const isIncome = (id: string) => movementTypes.find(m => m.id === id)?.category === MovementCategory.INCOME;

  const handleDelete = async (id: string) => {
      if (window.confirm('¿Estás seguro de que quieres eliminar este movimiento?')) {
          try {
              await deleteDocument('transactions', id);
              showToast("Registro eliminado", 'success');
          } catch (error) {
              showToast("Error al eliminar", 'error');
          }
      }
  };

  const handleOpenEdit = (t: Transaction) => {
      setModalState({ isOpen: true, mode: 'edit', data: t });
  };

  const handleOpenCreate = () => {
      setModalState({ isOpen: true, mode: 'create' });
  };

  const handleCloseModal = () => {
      setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleFormSubmit = async (formData: Omit<Transaction, 'id'>) => {
      try {
        if (modalState.mode === 'create') {
            await onSaveNew(formData);
        } else if (modalState.mode === 'edit' && modalState.data) {
            let attachmentUrl = formData.attachment;
            if (formData.attachment && formData.attachment.startsWith('data:')) {
                const fileName = `receipts/${Date.now()}.jpg`;
                attachmentUrl = await uploadImage(formData.attachment, fileName);
            }
            const transactionToUpdate = { ...formData, attachment: attachmentUrl || null };
            await saveDocument('transactions', transactionToUpdate, modalState.data.id);
            showToast("Registro actualizado", 'success');
        }
        handleCloseModal();
      } catch (error) {
          showToast("Error al guardar", 'error');
      }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
        let dateMatch = filterMode === 'month' ? t.date.startsWith(selectedMonth) : (t.date >= dateRange.start && t.date <= dateRange.end);
        const typeMatch = filterTypeId ? t.movementTypeId === filterTypeId : true;
        const searchMatch = searchTerm ? t.detail.toLowerCase().includes(searchTerm.toLowerCase()) : true;
        return dateMatch && typeMatch && searchMatch;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filterMode, selectedMonth, dateRange, filterTypeId, searchTerm]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(t => {
        const monthKey = t.date.substring(0, 7);
        if (!groups[monthKey]) groups[monthKey] = [];
        groups[monthKey].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, txs]) => ({
            month,
            transactions: txs,
            totals: txs.reduce((acc, curr) => {
                const currCode = curr.currency || 'ARS';
                if (!acc[currCode]) acc[currCode] = { income: 0, expense: 0, balance: 0 };
                const type = movementTypes.find(m => m.id === curr.movementTypeId);
                if (type?.category === MovementCategory.INCOME) {
                    acc[currCode].income += curr.amount;
                    acc[currCode].balance += curr.amount;
                } else {
                    acc[currCode].expense += curr.amount;
                    acc[currCode].balance -= curr.amount;
                }
                return acc;
            }, {} as Record<string, { income: number; expense: number; balance: number }>)
        }));
  }, [filteredTransactions, movementTypes]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => parseSheetCSV(event.target?.result as string);
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const parseCSVLine = (text: string, delimiter: string) => {
    const result = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuote && text[i + 1] === '"') { current += '"'; i++; } else { inQuote = !inQuote; }
        } else if (char === delimiter && !inQuote) { result.push(current); current = ''; }
        else { current += char; }
    }
    result.push(current);
    return result;
  };

  const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const parseSheetCSV = (csvText: string) => {
    try {
        const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) { showToast("Archivo vacío", 'error'); return; }
        const firstLine = lines[0];
        const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
        const headers = parseCSVLine(firstLine, delimiter).map(normalize);
        const idxDate = headers.findIndex(h => h === 'fecha');
        const idxAmount = headers.findIndex(h => h === 'monto2' || h === 'monto');
        const idxDetail = headers.findIndex(h => h === 'detalle');
        const idxCurrency = headers.findIndex(h => h === 'moneda');
        let idxTypeDesc = headers.findIndex(h => h === 'descripcion_tipo_movimiento' || h === 'tipo_movimiento' || h === 'descripcion');
        if (idxDate === -1 || idxAmount === -1) { showToast("Columnas requeridas no encontradas", 'error'); return; }
        const sortedTypes = [...movementTypes].sort((a, b) => b.name.length - a.name.length);
        const newTransactions: Transaction[] = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i], delimiter).map(c => c.trim());
            let rawAmount = (cols[idxAmount] || '0').replace(/[$\s]/g, ''); 
            let amount = rawAmount.includes(',') && rawAmount.includes('.') ? parseFloat(rawAmount.replace(/\./g, '').replace(',', '.')) : (rawAmount.includes(',') ? parseFloat(rawAmount.replace(',', '.')) : parseFloat(rawAmount));
            if (isNaN(amount) || amount === 0) continue; 
            let dateStr = cols[idxDate];
            if (dateStr && dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) dateStr = `${parts[2].trim()}-${parts[1].trim().padStart(2, '0')}-${parts[0].trim().padStart(2, '0')}`;
            } else if (!dateStr) dateStr = new Date().toISOString().split('T')[0];
            const rawTypeDesc = idxTypeDesc !== -1 ? (cols[idxTypeDesc] || '') : '';
            const matchedType = sortedTypes.find(mt => normalize(rawTypeDesc).includes(normalize(mt.name)));
            let currencyCode = (cols[idxCurrency] || 'ARS').toUpperCase().trim().replace(/[^A-Z]/g, '');
            if (!currencyCode || currencyCode.length !== 3) currencyCode = 'ARS';
            newTransactions.push({ id: crypto.randomUUID(), date: dateStr, centerId: centers[0]?.id || 'default', movementTypeId: matchedType ? matchedType.id : movementTypes[0]?.id, detail: cols[idxDetail] || rawTypeDesc || 'Importado', amount: Math.abs(amount), currency: currencyCode, excludeFromPdf: false });
        }
        if (newTransactions.length > 0 && window.confirm(`Importar ${newTransactions.length} registros?`)) onImport(newTransactions);
    } catch (error) { showToast('Error al procesar archivo', 'error'); }
  };

  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) { showToast("Nada que exportar", 'info'); return; }
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Centro', 'Detalle', 'Monto', 'Moneda', 'Incluir en Planilla'];
    const rows = filteredTransactions.map(t => {
        const type = movementTypes.find(m => m.id === t.movementTypeId);
        const center = centers.find(c => c.id === t.centerId);
        return [t.date, `"${type?.name || ''}"`, type?.category === MovementCategory.INCOME ? 'ENTRADA' : 'SALIDA', `"${center?.name || ''}"`, `"${t.detail.replace(/"/g, '""')}"`, t.amount.toString().replace('.', ','), t.currency, t.excludeFromPdf ? 'NO' : 'SI'].join(';');
    });
    const csvContent = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Movimientos.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDF = () => {
    const pdfTransactions = transactions.filter(t => t.date.startsWith(pdfTargetMonth) && !t.excludeFromPdf);
    if (pdfTransactions.length === 0) { showToast("Sin movimientos en planilla para el mes", 'info'); return; }
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    doc.setFont("times", "bold"); doc.setFontSize(16); doc.text("PLANILLA DE TESORERIA del M. C y M.", pageWidth / 2, 15, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const [year, month] = pdfTargetMonth.split('-');
    const monthName = new Date(parseInt(year), parseInt(month)-1).toLocaleString('es-ES', { month: 'long' });
    doc.text(`Mes de: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`, 14, 25);
    doc.text("Iglesia de: Córdoba Capital Peniel", 120, 25);
    let currentY = 32;
    const totalIncome = pdfTransactions.filter(t => isIncome(t.movementTypeId)).reduce((acc, t) => acc + t.amount, 0);
    const incomeRows = movementTypes.filter(m => m.category === MovementCategory.INCOME).map(type => [type.name, `$ ${pdfTransactions.filter(t => t.movementTypeId === type.id).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('es-CL', { minimumFractionDigits: 2 })}`]);
    autoTable(doc, { startY: currentY, body: incomeRows, theme: 'plain', styles: { fontSize: 8 } });
    currentY = (doc as any).lastAutoTable.finalY + 10;
    const totalExpense = pdfTransactions.filter(t => !isIncome(t.movementTypeId)).reduce((acc, t) => acc + t.amount, 0);
    doc.text(`TOTAL ENTRADAS: $ ${totalIncome.toLocaleString()}`, 14, currentY);
    doc.save(`Planilla_${pdfTargetMonth}.pdf`);
    setIsPdfModalOpen(false);
  };

  const formatGroupDate = (ym: string, iy: boolean) => {
      const [y, m] = ym.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1, 1); 
      return date.toLocaleString('es-ES', { month: 'long', ...(iy && { year: 'numeric' }) });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="font-bold text-xl text-[#1B365D] flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Movimientos Registrados
        </h3>
        <div className="flex flex-col-reverse sm:flex-row items-center gap-2 w-full sm:w-auto">
            {isAdmin && (
                <div className="flex items-center bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
                     <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-slate-600 hover:text-[#1B365D] hover:bg-white px-3 py-2 rounded-md transition-all text-sm font-medium"><Upload className="w-4 h-4" /> Importar</button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <button onClick={handleExportExcel} className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-slate-600 hover:text-green-700 hover:bg-white px-3 py-2 rounded-md transition-all text-sm font-medium"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
                    <button onClick={() => setIsPdfModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-slate-600 hover:text-rose-700 hover:bg-white px-3 py-2 rounded-md transition-all text-sm font-medium"><FileText className="w-4 h-4" /> PDF</button>
                </div>
            )}
            {isAdmin && (
                <button onClick={handleOpenCreate} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#84cc16] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-lime-600 transition-colors shadow-sm"><Plus className="w-5 h-5" /> Nuevo Movimiento</button>
            )}
        </div>
      </div>

      <div className="bg-white p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4 flex flex-col gap-2">
            <div className="flex bg-white border border-slate-200 p-1 rounded-lg">
                <button onClick={() => setFilterMode('month')} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${filterMode === 'month' ? 'bg-[#1B365D] text-white shadow-sm' : 'text-slate-500'}`}>MENSUAL</button>
                <button onClick={() => setFilterMode('range')} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${filterMode === 'range' ? 'bg-[#1B365D] text-white shadow-sm' : 'text-slate-500'}`}>RANGO</button>
            </div>
            {filterMode === 'month' ? (
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full px-3 h-10 border border-slate-300 rounded-lg text-sm" />
            ) : (
                <div className="flex gap-2"><input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="w-full h-10 px-2 border border-slate-300 rounded-lg text-xs" /><input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="w-full h-10 px-2 border border-slate-300 rounded-lg text-xs" /></div>
            )}
        </div>
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
             <select value={filterTypeId} onChange={(e) => setFilterTypeId(e.target.value)} className="w-full h-10 pl-3 bg-white border border-slate-300 rounded-lg text-sm"><option value="">Todos los Tipos</option>{movementTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
             <div className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-lg text-sm" /></div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Centro</th><th className="px-6 py-4">Detalle</th><th className="px-6 py-4 text-right">Monto</th><th className="px-6 py-4 text-center">Adjunto</th><th className="px-6 py-4 text-right">Acciones</th></tr>
            </thead>
            <tbody>
                {groupedTransactions.map((group) => (
                    <React.Fragment key={group.month}>
                        <tr className="bg-slate-100/80 border-y border-slate-200">
                            <td colSpan={7} className="px-6 py-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <span className="text-xs font-black text-[#1B365D] uppercase tracking-widest">
                                        {formatGroupDate(group.month, true)}
                                    </span>
                                    
                                    {/* --- RESUMEN DE TOTALES POR MES --- */}
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                        {/* Fix: Explicitly type 'val' to avoid TypeScript 'unknown' property access errors */}
                                        {Object.entries(group.totals).map(([curr, val]: [string, any]) => (
                                            <div key={curr} className="flex items-center gap-4 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                                <span className="text-[10px] font-black text-[#1B365D] bg-slate-100 px-1.5 py-0.5 rounded">{curr}</span>
                                                <div className="flex items-center gap-4 text-[10px] font-bold">
                                                    <div className="flex items-center gap-1.5 text-lime-600">
                                                        <TrendingUp size={12} className="shrink-0" />
                                                        <span>ENTRADA:</span>
                                                        <span className="font-black text-xs">$ {val.income.toLocaleString('es-AR')}</span>
                                                    </div>
                                                    <div className="w-px h-3 bg-slate-200"></div>
                                                    <div className="flex items-center gap-1.5 text-rose-600">
                                                        <TrendingDown size={12} className="shrink-0" />
                                                        <span>SALIDA:</span>
                                                        <span className="font-black text-xs">$ {val.expense.toLocaleString('es-AR')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </td>
                        </tr>
                        {group.transactions.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50 border-b border-slate-50 group">
                                <td className="px-6 py-4 font-mono text-xs">{t.date}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isIncome(t.movementTypeId) ? 'bg-lime-100 text-lime-800' : 'bg-rose-100 text-rose-800'}`}>
                                        {isIncome(t.movementTypeId) ? 'Entrada' : 'Salida'} - {getTypeName(t.movementTypeId)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500">{getCenterName(t.centerId)}</td>
                                <td className="px-6 py-4 max-w-xs truncate">{t.detail}</td>
                                <td className={`px-6 py-4 text-right font-bold ${isIncome(t.movementTypeId) ? 'text-[#84cc16]' : 'text-rose-600'}`}>{t.currency} {t.amount.toLocaleString()}</td>
                                <td className="px-6 py-4 text-center">{t.attachment ? <button onClick={() => setViewImage(t.attachment || null)} className="text-[#1B365D] p-1"><Eye className="w-4 h-4" /></button> : '-'}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenEdit(t)} className="p-1 text-slate-400 hover:text-[#1B365D]"><Pencil className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(t.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </React.Fragment>
                ))}
            </tbody>
        </table>
      </div>

      {modalState.isOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-sm overflow-hidden">
            <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="bg-[#1B365D] px-4 py-3 sm:px-6 flex justify-between items-center shrink-0">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        {modalState.mode === 'create' ? <Plus size={20}/> : <Pencil size={20} />}
                        {modalState.mode === 'create' ? 'Nuevo Movimiento' : 'Editar Movimiento'}
                    </h3>
                    <button type="button" className="text-white/80 hover:text-white p-1" onClick={handleCloseModal}><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto bg-white">
                    <TransactionForm 
                        onSave={handleFormSubmit}
                        onCancel={handleCloseModal}
                        centers={centers}
                        movementTypes={movementTypes}
                        currencies={currencies}
                        initialData={modalState.mode === 'edit' ? modalState.data : undefined}
                    />
                </div>
            </div>
         </div>
      )}

      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4">
                <h3 className="font-bold text-[#1B365D]">Generar Planilla</h3>
                <input type="month" value={pdfTargetMonth} onChange={(e) => setPdfTargetMonth(e.target.value)} className="w-full p-3 border rounded-lg" />
                <div className="flex gap-2"><button onClick={() => setIsPdfModalOpen(false)} className="flex-1 py-3 border rounded-lg">Cerrar</button><button onClick={generatePDF} className="flex-1 py-3 bg-[#1B365D] text-white rounded-lg">Descargar</button></div>
            </div>
        </div>
      )}
      {viewImage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90" onClick={() => setViewImage(null)}>
              <img src={viewImage} className="max-w-full max-h-full rounded-lg" alt="Adjunto" />
          </div>
      )}
    </div>
  );
};

export default TransactionList;