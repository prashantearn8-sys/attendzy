import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Clock,
  BookOpen,
  CalendarCheck,
  User,
  Settings,
} from 'lucide-react';
import { UserProfile } from '../types/attendance';

export type NavTab = 'dashboard' | 'calendar' | 'timetable' | 'subjects' | 'settings' | 'privacy' | 'terms';

export const TAB_ROUTES: Record<NavTab, string> = {
  dashboard: '/home',
  calendar: '/calendar',
  timetable: '/schedule',
  subjects: '/subjects',
  settings: '/settings',
  privacy: '/privacy',
  terms: '/terms',
};

export function getTabFromPath(path: string): NavTab {
  const normalized = path.toLowerCase().replace(/\/+$/, '') || '/';
  if (normalized === '/calendar' || normalized === '/calender') {
    return 'calendar';
  }
  if (normalized === '/schedule' || normalized === '/timetable') {
    return 'timetable';
  }
  if (normalized === '/subjects') {
    return 'subjects';
  }
  if (normalized === '/settings' || normalized === '/profile') {
    return 'settings';
  }
  if (normalized === '/privacy' || normalized === '/privacy-policy') {
    return 'privacy';
  }
  if (normalized === '/terms' || normalized === '/terms-of-service') {
    return 'terms';
  }
  return 'dashboard';
}

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  user?: UserProfile | null;
  isSignedIn?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  isSignedIn = false,
  onSignIn,
}) => {
  // Desktop navigation items (4 primary views, with profile/settings on top right)
  const desktopNavItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; path: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/home' },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon, path: '/calendar' },
    { id: 'timetable', label: 'Schedule', icon: Clock, path: '/schedule' },
    { id: 'subjects', label: 'Subjects', icon: BookOpen, path: '/subjects' },
  ];

  // Mobile bottom navigation items (5 core destinations for 1-thumb reachability)
  const mobileNavItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; path: string }[] = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard, path: '/home' },
    { id: 'timetable', label: 'Schedule', icon: Clock, path: '/schedule' },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon, path: '/calendar' },
    { id: 'subjects', label: 'Subjects', icon: BookOpen, path: '/subjects' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <>
      {/* Top Header for Desktop & Mobile */}
      <header
        id="app-header"
        className="sticky top-0 z-40 w-full border-b border-gray-200/90 bg-white/95 backdrop-blur-md px-3.5 sm:px-6 py-2 sm:py-2.5 transition-colors shadow-2xs"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <a
            id="brand-logo-btn"
            href="/home"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none group shrink-0 min-h-[44px]"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gray-900 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
              <CalendarCheck className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <span className="text-base sm:text-xl font-extrabold tracking-tight text-gray-900 font-['Plus_Jakarta_Sans'] block leading-tight">
                Attendzy
              </span>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium hidden sm:block leading-tight mt-0.5">
                Class & Attendance Tracker
              </p>
            </div>
          </a>

          {/* Right Navigation Controls & User Profile Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Desktop Navigation Links */}
            <nav
              id="desktop-nav"
              className="hidden md:flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl border border-gray-200/80 shadow-2xs relative"
            >
              {desktopNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <a
                    key={item.id}
                    id={`nav-desktop-${item.id}`}
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab(item.id);
                    }}
                    className={`relative h-9 px-3.5 rounded-lg flex items-center gap-2 text-xs sm:text-sm select-none cursor-pointer transition-colors duration-150 ${
                      isActive
                        ? 'text-gray-950 font-semibold'
                        : 'text-gray-600 hover:text-gray-900 font-medium'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeDesktopNavTab"
                        className="absolute inset-0 bg-white rounded-lg shadow-xs border border-gray-200/80 -z-0"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-gray-900' : 'text-gray-500'}`} />
                      <span>{item.label}</span>
                    </span>
                  </a>
                );
              })}
            </nav>

            {/* Sign In Button if not signed in */}
            {!isSignedIn && onSignIn && (
              <motion.button
                id="header-signin-btn"
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={onSignIn}
                className="h-9 min-h-[38px] px-3 sm:px-3.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </motion.button>
            )}

            {/* Profile Logo Button -> Direct access to Settings & Profile (shown only when signed in) */}
            {isSignedIn && (
              <motion.a
                id="header-profile-logo-btn"
                href="/settings"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('settings');
                }}
                className={`h-8.5 w-8.5 sm:h-10 sm:w-10 rounded-full border transition-colors flex items-center justify-center overflow-hidden shrink-0 shadow-2xs cursor-pointer outline-none focus:outline-none min-h-[36px] min-w-[36px] ${
                  activeTab === 'settings'
                    ? 'ring-2 ring-gray-900 ring-offset-2 border-gray-900 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
                title={user?.name ? `${user.name} - Profile & Settings` : 'Student Profile & Settings'}
                aria-label="Profile and Settings"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || 'Student Profile'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : user?.name ? (
                  <div
                    className={`w-full h-full flex items-center justify-center font-bold text-xs sm:text-sm select-none ${
                      activeTab === 'settings' ? 'bg-gray-900 text-white' : 'bg-slate-700 text-white'
                    }`}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-full h-full bg-gray-100 text-gray-700 flex items-center justify-center">
                    <User className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </div>
                )}
              </motion.a>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (5 Primary Destinations) */}
      <nav
        id="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200/90 px-2 pt-1 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg select-none"
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <a
              key={item.id}
              id={`nav-mobile-${item.id}`}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab(item.id);
              }}
              className={`relative min-h-[48px] min-w-[56px] flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 ${
                isActive
                  ? 'text-gray-950 font-bold'
                  : 'text-gray-400 hover:text-gray-700 font-medium'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeMobileNavTab"
                  className="absolute inset-x-1.5 inset-y-1 bg-gray-100/90 rounded-xl -z-0"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex flex-col items-center gap-0.5">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'text-gray-950 scale-110' : 'text-gray-400'
                  }`}
                />
                <span className={`text-[10px] tracking-tight leading-none ${isActive ? 'font-bold text-gray-950' : 'text-gray-500'}`}>
                  {item.label}
                </span>
              </span>
            </a>
          );
        })}
      </nav>
    </>
  );
};
