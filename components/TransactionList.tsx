import React, { useState, useRef, useMemo } from 'react';
import { Transaction, MovementCategory, Center, MovementType } from '../types';
import { FileText, Filter, ArrowUpRight, ArrowDownRight, Eye, Upload, Calendar, X, Download, Search, ChevronDown, Trash2, Pencil } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { deleteDocument, saveDocument, uploadImage } from '../services/firebaseService';
import TransactionForm from './TransactionForm';

interface TransactionListProps {
  transactions: Transaction[];
  onImport: (data: Transaction[]) => void;
  centers: Center[];
  movementTypes: MovementType[];
  currencies: string[];
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onImport, centers, movementTypes, currencies }) => {
  // --- VIEW FILTERS STATE ---
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // --- CONTENT FILTERS STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTypeId, setFilterTypeId] = useState('');

  // --- EDIT / DELETE STATE ---
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // --- PDF MODAL STATE ---
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfTargetMonth, setPdfTargetMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTypeName = (id: string) => movementTypes.find(m => m.id === id)?.name || 'Desconocido';
  const getCenterName = (id: string) => centers.find(c => c.id === id)?.name || 'Desconocido';
  const isIncome = (id: string) => movementTypes.find(m => m.id === id)?.category === MovementCategory.INCOME;

  // --- ACTIONS LOGIC ---
  const handleDelete = async (id: string) => {
      if (window.confirm('¿Estás seguro de que quieres eliminar este movimiento de forma permanente?')) {
          try {
              await deleteDocument('transactions', id);
          } catch (error) {
              console.error("Error deleting:", error);
              alert("Error al eliminar el registro.");
          }
      }
  };

  const handleUpdate = async (formData: Omit<Transaction, 'id'>) => {
      if (!editingTransaction) return;

      try {
        let attachmentUrl = formData.attachment;
        if (formData.attachment && formData.attachment.startsWith('data:')) {
            const fileName = `receipts/${Date.now()}.jpg`;
            attachmentUrl = await uploadImage(formData.attachment, fileName);
        }

        const transactionToUpdate = {
            ...formData,
            attachment: attachmentUrl || null
        };

        await saveDocument('transactions', transactionToUpdate, editingTransaction.id);
        setEditingTransaction(null); // Close modal
      } catch (error) {
          console.error("Error updating:", error);
          alert("Error al actualizar el registro.");
      }
  };


  // --- FILTERING LOGIC (VIEW) ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
        // 1. Date Filter
        let dateMatch = false;
        if (filterMode === 'month') {
            dateMatch = t.date.startsWith(selectedMonth);
        } else {
            dateMatch = t.date >= dateRange.start && t.date <= dateRange.end;
        }

        // 2. Type Filter
        const typeMatch = filterTypeId ? t.movementTypeId === filterTypeId : true;

        // 3. Detail Search (Case insensitive)
        const searchMatch = searchTerm 
            ? t.detail.toLowerCase().includes(searchTerm.toLowerCase()) 
            : true;

        return dateMatch && typeMatch && searchMatch;
    }).sort((a, b) => b.date.localeCompare(a.date)); // Newest first
  }, [transactions, filterMode, selectedMonth, dateRange, filterTypeId, searchTerm]);


  // --- GROUPING LOGIC FOR DISPLAY (Subtotals) ---
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    
    filteredTransactions.forEach(t => {
        const monthKey = t.date.substring(0, 7); // YYYY-MM
        if (!groups[monthKey]) groups[monthKey] = [];
        groups[monthKey].push(t);
    });

    return Object.entries(groups)
        .sort((a, b) => b[0].localeCompare(a[0]))
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


  // CSV Import Logic
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseSheetCSV(text);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper to split CSV line handling quotes
  const parseCSVLine = (text: string, delimiter: string) => {
    const result = [];
    let current = '';
    let inQuote = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            // Check for escaped quote ""
            if (inQuote && text[i + 1] === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuote = !inQuote;
            }
        } else if (char === delimiter && !inQuote) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
  };

  // Helper normalization function (ASCII, Lowercase, Trim)
  const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const parseSheetCSV = (csvText: string) => {
    try {
        const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) {
            alert("El archivo parece estar vacío o no tiene encabezados.");
            return;
        }

        // 1. Detect Delimiter (count occurrences in first line)
        const firstLine = lines[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const delimiter = semiCount >= commaCount ? ';' : ',';

        console.log(`Detected delimiter: '${delimiter}'`);

        // 2. Parse Headers (Normalize them to ensure accents don't break detection)
        const headers = parseCSVLine(firstLine, delimiter).map(normalize);
        
        console.log("Headers detected (normalized):", headers);

        // 3. Find specific columns
        const idxDate = headers.findIndex(h => h === 'fecha');
        const idxAmount = headers.findIndex(h => h === 'monto2' || h === 'monto');
        const idxDetail = headers.findIndex(h => h === 'detalle');
        const idxCurrency = headers.findIndex(h => h === 'moneda');
        
        // FIX: Search specifically for the description column first.
        // The user's CSV has both 'Tipo_Movimiento' (IDs) and 'Descripcion_Tipo_Movimiento' (Text).
        // We must prioritize the text column.
        let idxTypeDesc = headers.findIndex(h => h === 'descripcion_tipo_movimiento');
        
        // Fallback if the specific description column is not found
        if (idxTypeDesc === -1) {
             idxTypeDesc = headers.findIndex(h => 
                h === 'tipo_movimiento' || 
                h === 'descripcion'
            );
        }

        if (idxDate === -1 || idxAmount === -1) {
            alert(`No se encontraron las columnas requeridas 'Fecha' y 'Monto2' (o 'Monto'). \nColumnas detectadas: ${headers.join(', ')}`);
            return;
        }

        if (idxTypeDesc === -1) {
            alert("Atención: No se encontró la columna 'Descripcion_Tipo_Movimiento' (o similar). La clasificación automática fallará.");
        }

        // Prepare Matching Logic: Sort types by length DESCENDING
        // This ensures "OFRENDAS MISIONERAS" is checked before "OFRENDAS"
        const sortedTypes = [...movementTypes].sort((a, b) => b.name.length - a.name.length);

        const newTransactions: Transaction[] = [];
        let errors = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            
            // Parse line with detected delimiter
            const cols = parseCSVLine(line, delimiter).map(c => c.trim());

            try {
                // 1. Amount
                // Clean spaces/symbols
                let rawAmount = (cols[idxAmount] || '0').replace(/[$\s]/g, ''); 
                
                let amount = 0;
                // Handle formats: 1.000,00 (EU/LATAM) vs 1,000.00 (US)
                if (rawAmount.includes(',') && rawAmount.includes('.')) {
                    amount = parseFloat(rawAmount.replace(/\./g, '').replace(',', '.'));
                } else if (rawAmount.includes(',')) {
                    amount = parseFloat(rawAmount.replace(',', '.'));
                } else {
                    amount = parseFloat(rawAmount);
                }

                if (isNaN(amount) || amount === 0) continue; // Skip empty rows or invalid amounts

                // 2. Date
                let dateStr = cols[idxDate];
                // Handle dd/mm/yyyy
                if (dateStr && dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        // dd/mm/yyyy -> yyyy-mm-dd
                        dateStr = `${parts[2].trim()}-${parts[1].trim().padStart(2, '0')}-${parts[0].trim().padStart(2, '0')}`;
                    }
                } else if (!dateStr || dateStr.trim() === '') {
                     dateStr = new Date().toISOString().split('T')[0];
                }

                // 3. Type Mapping (Revised Logic)
                const rawTypeDesc = idxTypeDesc !== -1 ? (cols[idxTypeDesc] || '') : '';
                const csvTypeNorm = normalize(rawTypeDesc);
                
                let matchedType: MovementType | undefined;

                if (csvTypeNorm) {
                    // Check containment: Does the CSV text CONTAIN the App Type Name?
                    // OR does the App Type Name EQUAL the CSV text?
                    // Because we sorted `sortedTypes` by length descending:
                    // 1. CSV="OFRENDAS MISIONERAS", App="OFRENDAS MISIONERAS" -> Match (contains/equals) -> Found.
                    // 2. CSV="OFRENDAS MISIONERAS", App="OFRENDAS" -> (Matches later, but first loop hits longest).
                    // 3. CSV="INSTALACIONES (IDEM...)", App="INSTALACIONES" -> Match (contains).
                    
                    matchedType = sortedTypes.find(mt => {
                        const mtNameNorm = normalize(mt.name);
                        // Check if CSV description includes the app type name
                        return csvTypeNorm.includes(mtNameNorm);
                    });
                }

                // 4. Currency
                let currencyCode = (cols[idxCurrency] || 'ARS').toUpperCase().trim();
                currencyCode = currencyCode.replace(/[^A-Z]/g, ''); // Keep only letters
                if (!currencyCode || currencyCode.length !== 3) currencyCode = 'ARS';

                newTransactions.push({
                    id: crypto.randomUUID(),
                    date: dateStr,
                    centerId: centers[0]?.id || 'default', 
                    movementTypeId: matchedType ? matchedType.id : (movementTypes[0]?.id || 'unknown'),
                    detail: cols[idxDetail] || rawTypeDesc || 'Importado desde CSV',
                    amount: Math.abs(amount), // Ensure positive
                    currency: currencyCode
                });

            } catch (err) {
                console.warn("Row error:", err);
                errors++;
            }
        }

        if (newTransactions.length > 0) {
            if (window.confirm(`Se encontraron ${newTransactions.length} registros válidos.${errors > 0 ? ` (Ignorados ${errors} errores)` : ''} ¿Desea importarlos?`)) {
                onImport(newTransactions);
            }
        } else {
            alert('No se encontraron registros válidos para importar.');
        }

    } catch (error) {
        console.error(error);
        alert('Error crítico al procesar el archivo.');
    }
  };

  // --- PDF GENERATION LOGIC ---
  const generatePDF = () => {
    const pdfTransactions = transactions.filter(t => t.date.startsWith(pdfTargetMonth));
    if (pdfTransactions.length === 0) { alert("No hay movimientos para el mes seleccionado."); return; }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("PLANILLA DE TESORERIA del M. C y M.", pageWidth / 2, 15, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const [year, month] = pdfTargetMonth.split('-');
    const monthName = new Date(parseInt(year), parseInt(month)-1).toLocaleString('es-ES', { month: 'long' });
    doc.text(`Mes de: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`, 14, 25);
    doc.text(`de: ${year}`, 75, 25);
    doc.text("Iglesia de: Córdoba Capital Peniel", 120, 25);

    let currentY = 32;
    const drawSectionHeader = (title: string, y: number) => {
        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(220, 220, 220);
        doc.rect(14, y, pageWidth - 28, 6, 'FD');
        doc.setFont("times", "bolditalic");
        doc.setFontSize(11);
        doc.text(title, pageWidth / 2, y + 4.5, { align: "center" });
        return y + 6;
    };

    // ENTRADAS
    currentY = drawSectionHeader("ENTRADAS", currentY);
    const incomeTypes = movementTypes.filter(m => m.category === MovementCategory.INCOME);
    const incomeRows = incomeTypes.map(type => {
        const sum = pdfTransactions.filter(t => t.movementTypeId === type.id).reduce((acc, curr) => acc + curr.amount, 0);
        return [type.name, `$ ${sum > 0 ? sum.toLocaleString('es-CL', { minimumFractionDigits: 2 }) : ''}`];
    });
    const totalIncome = pdfTransactions.filter(t => isIncome(t.movementTypeId)).reduce((acc, t) => acc + t.amount, 0);

    autoTable(doc, {
        startY: currentY,
        head: [],
        body: [...incomeRows],
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1, lineColor: 230, lineWidth: 0.1, font: 'helvetica' },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 40, halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    // @ts-ignore
    currentY = doc.lastAutoTable.finalY;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(50, 50, 50); doc.rect(14, currentY, pageWidth - 28, 6); 
    doc.setFont("helvetica", "bolditalic"); doc.setFontSize(9);
    doc.text("TOTAL ENTRADAS", 16, currentY + 4);
    doc.text(`$ ${totalIncome.toLocaleString('es-CL', { minimumFractionDigits: 2 })}`, pageWidth - 16, currentY + 4, { align: 'right' });
    currentY += 9;

    // SALIDAS
    currentY = drawSectionHeader("SALIDAS", currentY);
    const expenseGroups = ["INVERSIONES", "GASTOS ESPECIFICOS DE MINISTERIO", "GASTOS GENERALES"];
    const expenseRows: any[] = [];
    expenseGroups.forEach(group => {
        expenseRows.push([{ content: group, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [252, 252, 252], halign: 'center', fontSize: 8 } }]);
        const groupTypes = movementTypes.filter(m => m.category === MovementCategory.EXPENSE && m.subCategory === group);
        groupTypes.forEach(type => {
            const sum = pdfTransactions.filter(t => t.movementTypeId === type.id).reduce((acc, curr) => acc + curr.amount, 0);
             expenseRows.push([type.name, `$ ${sum > 0 ? sum.toLocaleString('es-CL', { minimumFractionDigits: 2 }) : ''}`]);
        });
    });
    const otherExpenses = movementTypes.filter(m => m.category === MovementCategory.EXPENSE && !expenseGroups.includes(m.subCategory || ''));
    if(otherExpenses.length > 0) {
        expenseRows.push([{ content: "OTROS", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [252, 252, 252] } }]);
        otherExpenses.forEach(type => {
            const sum = pdfTransactions.filter(t => t.movementTypeId === type.id).reduce((acc, c) => acc + c.amount, 0);
            expenseRows.push([type.name, `$ ${sum > 0 ? sum.toLocaleString('es-CL', { minimumFractionDigits: 2 }) : ''}`]);
        });
    }
    const totalExpense = pdfTransactions.filter(t => !isIncome(t.movementTypeId)).reduce((acc, t) => acc + t.amount, 0);

    autoTable(doc, {
        startY: currentY,
        head: [],
        body: expenseRows,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 0.8, lineColor: 230, lineWidth: 0.1, font: 'helvetica' },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 40, halign: 'right' } },
        margin: { left: 14, right: 14 },
        pageBreak: 'auto'
    });
    // @ts-ignore
    currentY = doc.lastAutoTable.finalY;
    doc.setDrawColor(50, 50, 50); doc.rect(14, currentY, pageWidth - 28, 6); 
    doc.setFont("helvetica", "bolditalic"); doc.setFontSize(9);
    doc.text("TOTAL SALIDAS", 16, currentY + 4);
    doc.text(`$ ${totalExpense.toLocaleString('es-CL', { minimumFractionDigits: 2 })}`, pageWidth - 16, currentY + 4, { align: 'right' });

    // FOOTER
    const signatureY = pageHeight - 30;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.line(25, signatureY, 85, signatureY);
    doc.text("Firma y aclaración del tesorero", 55, signatureY + 4, { align: "center" });
    doc.setFontSize(8); doc.text("Sello Iglesia", 105, signatureY + 4, { align: "center" });
    doc.line(125, signatureY, 185, signatureY);
    doc.setFontSize(9);
    doc.text("Firma y aclaración del pastor", 155, signatureY + 4, { align: "center" });

    doc.save(`Planilla_Tesoreria_${pdfTargetMonth}.pdf`);
    setIsPdfModalOpen(false);
  };

  // Helper for formatting month correctly without timezone offset issues
  const formatGroupDate = (yearMonth: string, includeYear: boolean) => {
      const [year, month] = yearMonth.split('-');
      // Construct date using local time components to avoid UTC offset shifts
      const date = new Date(parseInt(year), parseInt(month) - 1, 1); 
      return date.toLocaleString('es-ES', { month: 'long', ...(includeYear && { year: 'numeric' }) });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      
      {/* HEADER: TITLE & ACTIONS */}
      <div className="p-4 border-b bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="font-bold text-xl text-[#1B365D] flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Movimientos Registrados
        </h3>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-slate-50 text-[#1B365D] border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors flex-1 sm:flex-none"
            >
                <Upload className="w-4 h-4" />
                Importar CSV
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />

            <button 
                onClick={() => setIsPdfModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-[#1B365D] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#152a48] transition-colors shadow-sm flex-1 sm:flex-none"
            >
                <FileText className="w-4 h-4" />
                Planilla PDF
            </button>
        </div>
      </div>

      {/* TOOLBAR: LARGE FILTERS */}
      <div className="bg-white p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Date Filter Section (Larger) */}
        <div className="md:col-span-4 flex flex-col gap-2">
            <div className="flex bg-white border border-slate-200 p-1 rounded-lg">
                <button 
                    onClick={() => setFilterMode('month')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${filterMode === 'month' ? 'bg-[#1B365D] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    MENSUAL
                </button>
                <button 
                    onClick={() => setFilterMode('range')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${filterMode === 'range' ? 'bg-[#1B365D] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    RANGO
                </button>
            </div>
            
            <div className="px-1 pb-1">
                {filterMode === 'month' ? (
                    <div className="relative">
                        <Calendar className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="month" 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full pl-10 pr-3 h-10 border border-slate-300 rounded-lg text-base text-slate-900 bg-white font-medium focus:ring-2 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                        />
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <input 
                            type="date" 
                            value={dateRange.start}
                            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                            className="w-full h-10 px-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 bg-white focus:ring-2 focus:ring-[#1B365D]"
                        />
                        <span className="text-slate-400">-</span>
                        <input 
                            type="date" 
                            value={dateRange.end}
                            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                            className="w-full h-10 px-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 bg-white focus:ring-2 focus:ring-[#1B365D]"
                        />
                    </div>
                )}
            </div>
        </div>

        {/* Content Filters */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
             {/* Type Filter */}
             <div className="relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Tipo Movimiento</label>
                <div className="relative">
                    <select 
                        value={filterTypeId}
                        onChange={(e) => setFilterTypeId(e.target.value)}
                        className="w-full h-10 pl-3 pr-8 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-[#1B365D] appearance-none"
                    >
                        <option value="">Todos los Tipos</option>
                        {movementTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
             </div>

             {/* Detail Search */}
             <div className="relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Buscar Detalle</label>
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-[#1B365D] outline-none placeholder:text-slate-400"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
             </div>
        </div>

      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Centro</th>
                    <th className="px-6 py-4">Detalle</th>
                    <th className="px-6 py-4 text-right">Monto</th>
                    <th className="px-6 py-4 text-center">Adjunto</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
            </thead>
            
            {groupedTransactions.length === 0 ? (
                 <tbody>
                    <tr>
                        <td colSpan={7} className="px-6 py-12 text-center flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Filter className="w-8 h-8 opacity-20" />
                            <span>No se encontraron movimientos con los filtros aplicados.</span>
                        </td>
                    </tr>
                 </tbody>
            ) : (
                groupedTransactions.map((group) => (
                    <tbody key={group.month} className="border-b last:border-0">
                        <tr className="bg-slate-50/50">
                            <td colSpan={7} className="px-6 py-2 text-xs font-bold text-[#1B365D] uppercase tracking-wider border-b border-slate-100">
                                {formatGroupDate(group.month, true)}
                            </td>
                        </tr>

                        {group.transactions.map((t) => {
                             const income = isIncome(t.movementTypeId);
                             return (
                                <tr key={t.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group">
                                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">{t.date}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                                            income ? 'bg-lime-100 text-lime-800' : 'bg-rose-100 text-rose-800'
                                        }`}>
                                            {income ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                                            {getTypeName(t.movementTypeId)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{getCenterName(t.centerId)}</td>
                                    <td className="px-6 py-4 max-w-xs truncate" title={t.detail}>{t.detail}</td>
                                    <td className={`px-6 py-4 text-right font-bold tabular-nums ${income ? 'text-[#84cc16]' : 'text-rose-600'}`}>
                                        <span className="text-xs text-slate-400 font-normal mr-1">{t.currency}</span>
                                        {t.amount.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {t.attachment ? (
                                            <button className="text-[#1B365D] hover:text-[#152a48] transition-colors p-1.5 hover:bg-slate-100 rounded-full" title="Ver adjunto">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => setEditingTransaction(t)}
                                                className="p-1.5 text-slate-400 hover:text-[#1B365D] hover:bg-slate-100 rounded transition-colors" 
                                                title="Editar"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(t.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" 
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                             );
                        })}

                        <tr className="bg-[#1B365D]/5 border-t border-[#1B365D]/10">
                            <td colSpan={4} className="px-6 py-3 text-right font-bold text-[#1B365D] text-xs uppercase tracking-wider">
                                Balance {formatGroupDate(group.month, false)}
                            </td>
                            <td colSpan={3} className="px-6 py-3 text-right">
                                <div className="flex flex-col items-end gap-1">
                                    {Object.entries(group.totals).map(([curr, total]: [string, { income: number; expense: number; balance: number }]) => (
                                        <div key={curr} className="text-xs font-medium text-slate-700 bg-white/50 px-2 py-1 rounded border border-slate-200 shadow-sm">
                                            <span className="font-bold text-[#1B365D] mr-2">{curr}</span>
                                            <span className="text-lime-600">+{total.income.toLocaleString()}</span>
                                            <span className="mx-1 text-slate-300">|</span>
                                            <span className="text-rose-600">-{total.expense.toLocaleString()}</span>
                                            <span className="mx-1 text-slate-400">=</span>
                                            <span className={`font-bold ${total.balance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                                                {total.balance.toLocaleString('es-AR', { style: 'currency', currency: curr })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                ))
            )}
        </table>
      </div>

      {/* --- EDIT MODAL --- */}
      {editingTransaction && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-200">
               <div className="relative">
                    <button 
                        onClick={() => setEditingTransaction(null)}
                        className="absolute -top-10 right-0 text-white/80 hover:text-white flex items-center gap-1"
                    >
                        <X size={20} /> Cancelar
                    </button>
                    <TransactionForm 
                        onSave={handleUpdate}
                        onCancel={() => setEditingTransaction(null)}
                        centers={centers}
                        movementTypes={movementTypes}
                        currencies={currencies}
                        initialData={editingTransaction}
                    />
               </div>
            </div>
         </div>
      )}

      {/* --- PDF GENERATION MODAL --- */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
                <div className="bg-[#1B365D] px-6 py-4 flex justify-between items-center">
                    <h3 className="text-white font-bold">Generar Planilla</h3>
                    <button onClick={() => setIsPdfModalOpen(false)} className="text-white/80 hover:text-white">
                        <X size={18} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600">
                        Selecciona el mes y año para generar la <strong>Planilla de Tesorería</strong> con el formato oficial.
                    </p>
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Periodo del Informe</label>
                        <input 
                            type="month" 
                            value={pdfTargetMonth}
                            onChange={(e) => setPdfTargetMonth(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-[#1B365D] outline-none"
                        />
                    </div>
                    
                    <button 
                        onClick={generatePDF}
                        className="w-full py-3 bg-[#1B365D] text-white font-bold rounded-lg hover:bg-[#152a48] transition-colors flex justify-center items-center gap-2 mt-2"
                    >
                        <Download size={18} />
                        Descargar PDF
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TransactionList;