import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, Link } from 'react-router-dom';
import { Home, PieChart, Tags, Plane, Plus, Camera, Menu } from 'lucide-react';
import HomePage from './pages/Home';
import AddReceiptPage from './pages/AddReceipt';
import ChartsPage from './pages/Charts';
import CategoriesPage from './pages/Categories';
import TripsPage from './pages/Trips';
import TripDetailPage from './pages/TripDetail';
import Sidebar from './components/Sidebar';

function App() {
  const [isDark, setIsDark] = useState(() => {
    // Check local storage or system preference on initial load
    if (localStorage.getItem('theme') === 'dark') return true;
    if (localStorage.getItem('theme') === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const location = useLocation();
  const isAddPage = location.pathname.startsWith('/add') || location.pathname.startsWith('/edit');

  // Dynamic FAB configuration
  const getFabConfig = () => {
    const path = location.pathname;

    if (path === '/trips') {
      return {
        to: '/trips', // Typically this would open a modal in TripsPage, or we can add a search param
        icon: <Plane size={24} strokeWidth={2.5} />,
        badgeIcon: <Plus size={10} strokeWidth={4} />,
        label: '新增旅行',
        state: { openAddModal: true } // Pass state to trigger action in target page
      };
    }

    if (path.startsWith('/trips/')) {
      const tripId = path.split('/')[2];
      return {
        to: `/add?tripId=${tripId}`,
        icon: <Camera size={24} strokeWidth={2.5} />,
        badgeIcon: <Plus size={10} strokeWidth={4} />,
        label: '新增收據',
        state: { from: path }
      };
    }

    if (path === '/categories') {
      return {
        to: '/categories',
        icon: <Tags size={24} strokeWidth={2.5} />,
        badgeIcon: <Plus size={10} strokeWidth={4} />,
        label: '新增分類',
        state: { openAddModal: true }
      };
    }

    // Default: Home/Other pages
    return {
      to: '/add',
      icon: <Camera size={24} strokeWidth={2.5} />,
      badgeIcon: <Plus size={10} strokeWidth={4} />,
      label: '掃描收據',
      state: { from: path }
    };
  };

  const fab = getFabConfig();

  return (
    <div className="min-h-screen pb-24 bg-background text-foreground transition-colors duration-300">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isDark={isDark}
        setIsDark={setIsDark}
      />

      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-gray-200/50 dark:border-gray-800/50 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3.5 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors text-gray-600 dark:text-gray-300"
            aria-label="Open Menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center space-x-2 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 "><h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">家計簿</h2></div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/add" element={<AddReceiptPage />} />
          <Route path="/edit/:id" element={<AddReceiptPage />} />
          <Route path="/charts" element={<ChartsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
        </Routes>
      </main>

      {/* Floating Action Button - Dynamic Contextual FAB */}
      {!isAddPage && (
        <Link
          to={fab.to}
          state={fab.state}
          className="fixed right-6 bottom-24 z-30 w-14 h-14 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center active:scale-90 transition-all animate-in zoom-in duration-300 group"
          title={fab.label}
        >
          <div className="relative">
            {fab.icon}
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white text-primary rounded-full flex items-center justify-center">
              {fab.badgeIcon}
            </div>
          </div>
        </Link>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full glass border-t border-gray-200/60 dark:border-gray-800/60 pb-safe z-20">
        <div className="flex justify-around items-center h-16 max-w-2xl mx-auto px-2">
          <NavItem to="/" icon={<Home size={22} />} label="首頁" />
          <NavItem to="/trips" icon={<Plane size={22} />} label="旅行" />
          <div className="w-16" /> {/* Spacer for FAB if needed, or just standard spacing */}
          <NavItem to="/charts" icon={<PieChart size={22} />} label="統計" />
          <NavItem to="/categories" icon={<Tags size={22} />} label="分類" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
        }`
      }
    >
      <div className={`transition-transform duration-200 ${label === "" ? "scale-110 active:scale-95" : "active:scale-90"}`}>
        {icon}
      </div>
      {label && <span className="text-[10px] font-bold mt-1 tracking-tighter">{label}</span>}
    </NavLink>
  );
}

export default App;
