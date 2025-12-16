import React, { useState, useEffect } from 'react';
import { login } from '../services/authService';
import { subscribeToConfig } from '../services/firebaseService';
import { Loader2, Lock, Mail, AlertCircle } from 'lucide-react';

interface LoginProps {}

const Login: React.FC<LoginProps> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Branding State
  const [churchName, setChurchName] = useState('Peniel (MCyM)');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    // Attempt to fetch public config for branding
    // Note: This requires the 'app_config/main' document to be readable by unauthenticated users in Firestore Rules
    // If not readable, it will gracefully fallback to defaults.
    const unsub = subscribeToConfig((_, data) => {
        if (data) {
            setChurchName(data.name || 'Peniel (MCyM)');
            setLogoUrl(data.logoUrl || null);
            setLogoError(false); // Reset error state on new data
        }
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
      // Auth state listener in App.tsx will handle the redirect
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Credenciales incorrectas. Verifique email y contraseña.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Demasiados intentos fallidos. Intente más tarde.");
      } else {
        setError("Error al iniciar sesión. Intente nuevamente.");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Header Branding */}
        <div className="bg-[#1B365D] p-8 text-center relative overflow-hidden flex flex-col items-center">
          <div className="absolute top-0 left-0 w-full h-2 bg-[#84cc16]"></div>
          
          {logoUrl && !logoError && (
             <div className="w-24 h-24 bg-white rounded-full mb-4 flex items-center justify-center p-1 shadow-lg border-2 border-white/20">
                 <img 
                    src={logoUrl} 
                    alt="Logo Iglesia" 
                    className="w-full h-full object-contain rounded-full"
                    onError={() => setLogoError(true)} 
                 />
             </div>
          )}

          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{churchName}</h1>
          <p className="text-blue-200 text-xs font-medium tracking-wide uppercase opacity-80">Libro de Caja Digital</p>
        </div>

        {/* Login Form */}
        <div className="p-8 pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@peniel.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#1B365D] outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#1B365D] outline-none transition-all"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#1B365D] text-white font-bold py-3 rounded-lg hover:bg-[#152a48] transition-colors shadow-lg shadow-blue-900/20 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              Si no tienes cuenta, contacta al administrador de la iglesia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;