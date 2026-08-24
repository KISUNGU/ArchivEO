import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Printer,
  HandCoins,
  FolderTree,
  DatabaseIcon,
  ScanTextIcon,
  Menu,
  X,
  Search,
  Bell,
  User,
  ChevronRight,
  Settings,
  Sun,
  Moon,
  ImportIcon,
  ArchiveIcon,
  LogOut,
  Shield,
  Building2,
  Workflow,
} from 'lucide-react';
import ScanDirect from '../pages/ScanDirect';
import Parametres from '../pages/Parametres';
import Impression from '../pages/Impression';
import Importation from '../pages/Importation';
import Archives from '../pages/Archives';
import Explorateur from '../pages/Explorateur';
import Partage from '../pages/Partage';
import Securite from '../pages/Securite';
import WorkflowPage from '../pages/Workflow';
import DashboardGeneral from '../pages/DashboardGeneral';
import ChatBot from './ChatBot';
import { ChatProvider } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import { useSession } from '../context/SessionContext';

export default function Accueil() {
  const rosaceRef = useRef(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const { isDark, toggle } = useTheme();
  const { session, initializing, signIn, signOut, isSuperAdmin } = useSession();

  const goHome = () => setActiveMenu(null);

  // Document à ouvrir dans les Archives (liens du chatbot)
  const [focusDocId, setFocusDocId] = useState(null);
  const openDocumentFromChat = (docId) => {
    setFocusDocId(docId);
    setActiveMenu('database');
  };

  const pageMap = {
    dashboard: <DashboardGeneral onBack={goHome} />,
    scan: <ScanDirect onBack={goHome} />,
    impression: <Impression onBack={goHome} />,
    importation: <Importation onBack={goHome} />,
    database: <Archives onBack={goHome} focusDocumentId={focusDocId} onFocusHandled={() => setFocusDocId(null)} />,
    explorateur: <Explorateur onBack={goHome} />,
    partage: <Partage onBack={goHome} />,
    securite: <Securite onBack={goHome} />,
    workflow: <WorkflowPage onBack={goHome} />,
    parametres: <Parametres onBack={goHome} />,
  };

  const handleAnimationEnd = () => {
    if (rosaceRef.current) {
      rosaceRef.current.style.animation = 'none';
    }
  };

  const modules = isSuperAdmin
    ? [
        {
          id: 'dashboard',
          title: 'Tableau de bord',
          icon: <Building2 className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#2563EB',
          startAngle: -180,
          endAngle: -120,
        },
        {
          id: 'impression',
          title: 'Impression',
          icon: <Printer className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#92278F',
          startAngle: -120,
          endAngle: -60,
        },
        {
          id: 'database',
          title: 'Archives',
          icon: <ArchiveIcon className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#7AC143',
          startAngle: -60,
          endAngle: 0,
        },
        {
          id: 'explorateur',
          title: 'Explorateur',
          icon: <FolderTree className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#F5A623',
          startAngle: 0,
          endAngle: 60,
        },
        {
          id: 'securite',
          title: 'Sécurité',
          icon: <Shield className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#B45309',
          startAngle: 60,
          endAngle: 120,
        },
        {
          id: 'workflow',
          title: 'Flux & Automat',
          icon: <Workflow className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#0284C7',
          startAngle: 120,
          endAngle: 180,
        },
      ]
    : [
        {
          id: 'importation',
          title: 'Importation',
          icon: <ImportIcon className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#008B8B',
          startAngle: -120,
          endAngle: -60,
        },
        {
          id: 'scan',
          title: 'Scan Direct',
          icon: <ScanTextIcon className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#D91B5C',
          startAngle: -60,
          endAngle: 0,
        },
        {
          id: 'database',
          title: 'Archives',
          icon: <ArchiveIcon className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#7AC143',
          startAngle: 0,
          endAngle: 60,
        },
        {
          id: 'impression',
          title: 'Impression',
          icon: <Printer className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#92278F',
          startAngle: 60,
          endAngle: 120,
        },
        {
          id: 'explorateur',
          title: 'Explorateur',
          icon: <FolderTree className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#F5A623',
          startAngle: 120,
          endAngle: 180,
        },
        {
          id: 'partage',
          title: 'Partage',
          icon: <Share2 className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={1.2} />,
          color: '#F26522',
          startAngle: 180,
          endAngle: 240,
        },
      ];

  const generateArcPath = (x, y, innerRadius, outerRadius, startAngleDegrees, endAngleDegrees) => {
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const startAngleRad = toRadians(startAngleDegrees);
    const endAngleRad = toRadians(endAngleDegrees);

    const xInnerStart = x + innerRadius * Math.cos(startAngleRad);
    const yInnerStart = y + innerRadius * Math.sin(startAngleRad);
    const xInnerEnd = x + innerRadius * Math.cos(endAngleRad);
    const yInnerEnd = y + innerRadius * Math.sin(endAngleRad);

    const xOuterStart = x + outerRadius * Math.cos(startAngleRad);
    const yOuterStart = y + outerRadius * Math.sin(startAngleRad);
    const xOuterEnd = x + outerRadius * Math.cos(endAngleRad);
    const yOuterEnd = y + outerRadius * Math.sin(endAngleRad);

    const largeArcFlag = endAngleDegrees - startAngleDegrees <= 180 ? 0 : 1;

    return `
      M ${xOuterStart} ${yOuterStart}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${xOuterEnd} ${yOuterEnd}
      L ${xInnerEnd} ${yInnerEnd}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${xInnerStart} ${yInnerStart}
      Z
    `.trim();
  };

  const cx = 50;
  const cy = 50;

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoggingIn(true);
    try {
      await signIn(loginForm.email, loginForm.password);
      setLoginError('');
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoggingIn(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(135deg,_#020617,_#0f172a_55%,_#111827)]">
        <div className="h-8 w-8 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.25),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(139,92,246,0.22),_transparent_28%),linear-gradient(135deg,_#020617,_#0f172a_55%,_#111827)] p-4 text-slate-100">
        <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/60 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div className="p-6 sm:p-8 lg:p-10 flex items-center justify-center">
            <form onSubmit={handleLogin} className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-7 shadow-2xl">
              <div className="mb-7">
                <p className="text-xs uppercase tracking-[0.35em] text-blue-300">Connexion</p>
                <h2 className="mt-2 text-3xl font-black text-white">Accéder à votre compte</h2>
                <p className="mt-2 text-sm text-slate-400">Saisissez vos identifiants pour ouvrir la session.</p>
              </div>

              <div className="space-y-4">
                <label className="block text-sm text-slate-300">
                  <span className="mb-1.5 block">Email</span>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="nom@archiveo.cd"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  <span className="mb-1.5 block">Mot de passe</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="••••••••"
                  />
                </label>
              </div>

              {loginError && <p className="mt-4 text-sm text-rose-300">{loginError}</p>}

              <button
                type="submit"
                disabled={loggingIn}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:scale-[1.01] disabled:opacity-60"
              >
                {loggingIn ? 'Connexion…' : 'Se connecter'}
              </button>

              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-400">
                Accès sécurisé — contactez le Super Admin pour obtenir ou réinitialiser un compte.
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatProvider onOpenDocument={openDocumentFromChat}>
    <div className="h-screen bg-gradient-to-tr from-slate-100 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 flex flex-col p-0 relative overflow-hidden font-sans select-none">

      {/* Flous morphiques en arrière-plan */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* ── HEADER (visible uniquement quand une page est ouverte) ── */}
      <AnimatePresence>
        {activeMenu && (
          <motion.header
            key="header"
            initial={{ opacity: 0, y: -48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -48 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            className="relative z-30 flex items-center gap-4 px-6 py-3 bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl border-b border-slate-200 dark:border-white/5"
          >
            {/* Breadcrumb */}
            <div
              className="flex items-center gap-2 text-sm font-semibold cursor-pointer"
              onClick={goHome}
            >
              <span className="text-slate-900 dark:text-white tracking-wider font-black">
                ARCHIV<span className="text-blue-500">ÉO</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span className="text-slate-600 dark:text-slate-300">
                {modules.find(m => m.id === activeMenu)?.title || (activeMenu === 'parametres' ? 'Paramètres' : '')}
              </span>
            </div>

            {/* Barre de recherche (centre) */}
            <div className="flex-1 mx-2 sm:mx-6 max-w-xl relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher un document, une référence…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:bg-white dark:focus:bg-white/8 transition-all"
              />
            </div>

            {/* Identifiants utilisateur (droite) */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Bouton thème */}
              <button
                onClick={toggle}
                title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              </button>
              <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-white/10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="leading-none hidden md:block">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{session.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isSuperAdmin ? 'Super admin · vue globale' : `${session.province} · ${session.role}`}
                  </p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Déconnexion
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* ── ZONE PRINCIPALE (sidebar + contenu) ── */}
      <div className="flex flex-1 overflow-hidden">
      <motion.div
        className="self-stretch shrink-0 bg-white/80 dark:bg-slate-950/40 backdrop-blur-2xl border-r border-slate-200 dark:border-white/5 flex flex-col py-6 z-20 relative overflow-y-auto overflow-x-hidden"
        animate={{
          width: activeMenu ? (isSidebarCollapsed ? '96px' : '280px') : '0px',
          opacity: activeMenu ? 1 : 0,
          paddingLeft: activeMenu ? '8px' : '0px',
          paddingRight: activeMenu ? '8px' : '0px'
        }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      >
        {activeMenu && (
          <div className={`mb-6 flex items-center gap-3 px-2 ${isSidebarCollapsed ? 'flex-col' : 'flex-row'}`}>
            {/* Bouton hamburger : ouvre/replie la barre (style Microsoft) */}
            <button
              onClick={() => setIsSidebarCollapsed(c => !c)}
              className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
              title={isSidebarCollapsed ? 'Ouvrir le menu' : 'Replier le menu'}
            >
              <Menu className="h-7 w-7" />
            </button>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="cursor-pointer font-black text-slate-900 dark:text-white tracking-wider text-center hover:text-blue-500 dark:hover:text-blue-400 transition-colors whitespace-nowrap"
              onClick={goHome}
            >
              {isSidebarCollapsed ? (
                <span className="text-sm">A<span className="text-blue-500">É</span></span>
              ) : (
                <span className="text-sm">ARCHIV<span className="text-blue-500">ÉO</span></span>
              )}
            </motion.div>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full px-2">
          {modules.map((mod) => {
            const isSelected = activeMenu === mod.id;
            return (
              <div key={`sidebar-${mod.id}`} className="relative group">
                <motion.button
                  onClick={() => setActiveMenu(mod.id)}
                  className={`flex items-center rounded-xl transition-all w-full ${
                    isSidebarCollapsed
                      ? 'justify-center p-0 w-16 h-16 mx-auto'
                      : `gap-3 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 ${isSelected ? 'bg-slate-100 dark:bg-white/10' : ''}`
                  }`}
                  style={isSidebarCollapsed ? { backgroundColor: mod.color } : undefined}
                  whileHover={{ scale: isSidebarCollapsed ? 1.08 : 1.02 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <span
                    className={`flex items-center justify-center rounded-xl shrink-0 ${
                      isSidebarCollapsed ? 'w-16 h-16' : 'w-14 h-14 shadow-lg'
                    }`}
                    style={isSidebarCollapsed ? undefined : { backgroundColor: mod.color }}
                  >
                    {React.cloneElement(mod.icon, { className: 'h-8 w-8 md:h-9 md:w-9 text-white' })}
                  </span>
                  {!isSidebarCollapsed && (
                    <span className="text-slate-900 dark:text-white text-sm font-medium truncate text-left flex-1">
                      {mod.title}
                    </span>
                  )}
                </motion.button>

                {isSelected && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-slate-800 dark:bg-white rounded-r-full"
                  />
                )}
                {/* Info-bulle uniquement en mode replié */}
                {isSidebarCollapsed && (
                  <div className="absolute left-20 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30 shadow-xl border border-slate-200 dark:border-white/10">
                    {mod.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bas de sidebar : Paramètres (en bas à gauche) puis Fermer */}
        {activeMenu && (
          <div className="mt-auto flex flex-col gap-1 pt-4">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setActiveMenu('parametres')}
              title="Paramètres — scanners et imprimantes"
              className={`transition-colors p-2 rounded-lg flex items-center gap-3 ${
                activeMenu === 'parametres'
                  ? 'text-slate-900 dark:text-white bg-slate-200 dark:bg-white/15'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
              } ${isSidebarCollapsed ? 'justify-center' : 'px-4'}`}
            >
              <Settings className="h-6 w-6" />
              {!isSidebarCollapsed && <span className="text-sm">Paramètres</span>}
            </motion.button>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={goHome}
              title="Fermer et revenir à l'accueil"
              className={`text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg flex items-center gap-3 ${
                isSidebarCollapsed ? 'justify-center' : 'px-4'
              }`}
            >
              <X className="h-6 w-6" />
              {!isSidebarCollapsed && <span className="text-sm">Fermer</span>}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Zone de contenu principale */}
      <div className="flex-1 min-w-0 flex items-center justify-center p-3 sm:p-4 lg:p-6 relative min-h-0">
        <AnimatePresence mode="wait">
          {!activeMenu ? (

            // Dashboard en rosace
            <motion.div
              key="dashboard-wheel"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7, x: -100, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 100, damping: 20, filter: { type: 'tween', duration: 0.3 } }}
              className="w-full max-w-[min(85vw,85vh)] aspect-square relative select-none bg-slate-200/40 dark:bg-white/[0.03] backdrop-blur-xl rounded-full p-4 border border-slate-300/50 dark:border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.12)] dark:shadow-[0_0_50px_rgba(0,0,0,0.3)]"
            >
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]"
              >
                <defs>
                  <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>

                  <filter id="round" x="-4%" y="-4%" width="108%" height="108%">
                    <feGaussianBlur stdDeviation="1" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 22 -9" result="round" />
                    <feComposite in="SourceGraphic" in2="round" operator="in" />
                  </filter>

                  <filter id="content-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="0.4" stdDeviation="0.5" floodColor="#000" floodOpacity="0.45" />
                  </filter>

                  <linearGradient id="centerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="40%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#020617" />
                  </linearGradient>

                  <style>
                    {`
                      @keyframes spinRosace {
                        0% { transform: rotate(1080deg); opacity: 0; filter: blur(4px); }
                        60% { filter: blur(0px); }
                        100% { transform: rotate(0deg); opacity: 1; }
                      }
                      @keyframes counterSpin {
                        0% { transform: rotate(-1080deg); }
                        100% { transform: rotate(0deg); }
                      }
                      .animated-rosace {
                        transform-origin: 50px 50px;
                        animation: spinRosace 2.5s cubic-bezier(0.25, 1, 0.2, 1) forwards;
                      }
                      .pedal-content {
                        animation: counterSpin 2.5s cubic-bezier(0.25, 1, 0.2, 1) forwards;
                      }
                      .slice-group {
                        cursor: pointer;
                        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                        transform-origin: 50px 50px;
                      }
                      .slice-group:hover {
                        transform: scale(1.03);
                        filter: url(#neon-glow);
                      }
                      .slice-path {
                        transition: opacity 0.25s ease;
                      }
                      .animated-rosace:hover .slice-group:not(:hover) .slice-path {
                        opacity: 0.4;
                      }
                      .center-btn {
                        cursor: pointer;
                        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                        transform-origin: 50px 50px;
                      }
                      .center-btn:hover {
                        transform: scale(1.05);
                      }
                      .flat-text {
                        font-family: ui-sans-serif, system-ui, sans-serif;
                        font-weight: 500;
                        font-size: 3px;
                        letter-spacing: 0.04em;
                        fill: #ffffff;
                        text-anchor: middle;
                        dominant-baseline: middle;
                      }
                    `}
                  </style>
                </defs>

                <g ref={rosaceRef} className="animated-rosace" onAnimationEnd={handleAnimationEnd}>
                  {modules.map((mod) => {
                    const pathData = generateArcPath(cx, cy, 22, 47, mod.startAngle + 1.2, mod.endAngle - 1.2);
                    const midAngleDegrees = (mod.startAngle + mod.endAngle) / 2;
                    const midAngleRad = (midAngleDegrees * Math.PI) / 180;

                    const contentRadius = 34.5;
                    const contentX = cx + contentRadius * Math.cos(midAngleRad);
                    const contentY = cy + contentRadius * Math.sin(midAngleRad);

                    return (
                      <g
                        key={mod.id}
                        className="slice-group"
                        onClick={() => setActiveMenu(mod.id)}
                      >
                        <path d={pathData} fill={mod.color} className="slice-path" filter="url(#round)" />

                        <g className="pedal-content" style={{ transformOrigin: `${contentX}px ${contentY}px` }}>
                          <g transform={`translate(${contentX - 3.36}, ${contentY - 7}) scale(0.28)`} filter="url(#content-shadow)">
                            {mod.icon}
                          </g>
                          <text x={contentX} y={contentY + 2.5} className="flat-text" filter="url(#content-shadow)">
                            {mod.title}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>

                {/* Logo central fixe */}
                <g className="center-btn" onClick={goHome}>
                  <circle cx={cx} cy={cy} r={18.5} fill="url(#centerGrad)" className="stroke-white/20 stroke-[0.5px]" />
                  <circle cx={cx} cy={cy} r={17.5} fill="none" className="stroke-white/90 stroke-[0.8px]" />
                  <text x="50" y="49.5" className="font-sans font-black text-center fill-white tracking-wider" style={{ fontSize: '3.4px', textAnchor: 'middle' }}>
                    ARCHIV<tspan className="fill-blue-500">ÉO</tspan>
                  </text>
                  <text x="50" y="53.5" className="font-sans font-bold text-center fill-slate-400 tracking-widest" style={{ fontSize: '1.1px', textAnchor: 'middle' }}>
                    ECOSYSTEM
                  </text>
                </g>
              </svg>
            </motion.div>

          ) : (

            // Vue du module actif
            <motion.div
              key={`page-${activeMenu}`}
              initial={{ opacity: 0, x: 100, filter: 'blur(8px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 100, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 120, damping: 19, filter: { type: 'tween', duration: 0.3 } }}
              className="w-full h-full bg-white/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-6 lg:p-8 text-slate-900 dark:text-white shadow-2xl overflow-auto"
            >
              {pageMap[activeMenu]}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      </div>{/* fin zone principale */}

      {/* Paramètres accessible depuis l'accueil (sidebar masquée) — en bas à gauche */}
      {!activeMenu && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setActiveMenu('parametres')}
          title="Paramètres — scanners et imprimantes"
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 border border-slate-300 dark:border-white/15 backdrop-blur-md shadow-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <Settings className="h-6 w-6" />
        </motion.button>
      )}

      {/* Bouton thème — en bas à gauche, adjacent au bouton paramètres */}
      {!activeMenu && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={toggle}
          title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className="fixed bottom-4 left-20 sm:bottom-6 sm:left-24 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 border border-slate-300 dark:border-white/15 backdrop-blur-md shadow-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          {isDark ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
        </motion.button>
      )}

      {/* ── FOOTER (visible uniquement quand une page est ouverte) ── */}
      <AnimatePresence>
        {activeMenu && (
          <motion.footer
            key="footer"
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            className="relative z-30 flex items-center justify-between px-6 py-2.5 bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 text-[11px] text-slate-500"
          >
            <span>ArchivÉo Ecosystem &mdash; v2.0.1</span>
            <span className="text-slate-400 dark:text-slate-600">Système d'archivage électronique</span>
            <span>© {new Date().getFullYear()} Tous droits réservés</span>
          </motion.footer>
        )}
      </AnimatePresence>

      <ChatBot />

    </div>
    </ChatProvider>
  );
}
