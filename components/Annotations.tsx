import React, { useState } from 'react';
import { Annotation } from '../types';
import { Plus, Trash2, Calendar, ClipboardList, Pencil, X } from 'lucide-react';
import { saveDocument, deleteDocument } from '../services/firebaseService';
import { useToast } from './Toast';

interface AnnotationsProps {
    annotations: Annotation[]; // Recibir datos por props
}

const Annotations: React.FC<AnnotationsProps> = ({ annotations }) => {
  // Eliminado estado interno 'annotations' y 'useEffect'
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    setIsSaving(true);
    try {
        const dataToSave: any = {
            date,
            title,
            description,
        };

        // Only add createdAt for new records
        if (!editingId) {
            dataToSave.createdAt = Date.now();
        }

        await saveDocument('annotations', dataToSave, editingId || undefined);
        
        showToast(editingId ? "Anotación actualizada" : "Anotación guardada", 'success');
        resetForm();
    } catch (error) {
        console.error(error);
        showToast("Error al guardar la anotación", 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(window.confirm("¿Eliminar esta anotación?")) {
          try {
            await deleteDocument('annotations', id);
            showToast("Anotación eliminada", 'success');
            // If we were editing this exact note, cancel edit mode
            if (editingId === id) resetForm();
          } catch(err) {
            showToast("Error al eliminar", 'error');
          }
      }
  };

  const handleEdit = (note: Annotation) => {
      setEditingId(note.id);
      setDate(note.date);
      setTitle(note.title);
      setDescription(note.description);
      // Smooth scroll to form on mobile/tablet
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
      setEditingId(null);
      setTitle('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="md:col-span-1">
            <div className={`rounded-xl shadow-sm border p-6 sticky top-24 transition-colors ${editingId ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${editingId ? 'text-amber-700' : 'text-[#1B365D]'}`}>
                        {editingId ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />} 
                        {editingId ? 'Editar Anotación' : 'Nueva Anotación'}
                    </h3>
                    {editingId && (
                        <button onClick={resetForm} className="text-amber-600 hover:text-amber-800" title="Cancelar edición">
                            <X size={20} />
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                        <input 
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            required
                            className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1B365D] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                        <input 
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            placeholder="Ej: Reunión de líderes"
                            className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1B365D] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
                        <textarea 
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            required
                            rows={4}
                            placeholder="Detalles del evento o nota..."
                            className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1B365D] outline-none resize-none"
                        />
                    </div>
                    
                    <div className="flex gap-2">
                        {editingId && (
                            <button 
                                type="button"
                                onClick={resetForm}
                                className="flex-1 bg-white border border-slate-300 text-slate-700 font-bold py-3 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                        )}
                        <button 
                            type="submit"
                            disabled={isSaving}
                            className={`flex-1 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#1B365D] hover:bg-[#152a48]'}`}
                        >
                            {isSaving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar Nota')}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        {/* Timeline Section */}
        <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-lg text-[#1B365D] mb-6 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" /> Vitácora de Movimientos
                </h3>

                {annotations.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        No hay anotaciones registradas.
                    </div>
                ) : (
                    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                        {annotations.map((note) => (
                            <div key={note.id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active ${editingId === note.id ? 'opacity-50 pointer-events-none' : ''}`}>
                                {/* Icon */}
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                    <Calendar className="w-5 h-5 text-[#1B365D]" />
                                </div>
                                
                                {/* Content */}
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group-hover:border-[#1B365D]/20">
                                    <div className="flex justify-between items-start mb-1">
                                        <time className="font-mono text-xs font-bold text-[#84cc16] mb-1 block">{note.date}</time>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => handleEdit(note)}
                                                className="text-slate-300 hover:text-[#1B365D] transition-colors p-1"
                                                title="Editar nota"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(note.id)}
                                                className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                                                title="Eliminar nota"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-2">{note.title}</h4>
                                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{note.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default Annotations;