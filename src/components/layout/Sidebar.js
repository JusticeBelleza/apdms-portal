// src/components/layout/Sidebar.js
import React from 'react';
import { LayoutDashboard, Database, FileSpreadsheet, FileText, Users, Building, FileClock, Settings, User, LogOut } from 'lucide-react';

const Sidebar = ({ user, onNavigate, onLogout, currentPage }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, permission: true },
        { id: 'databank', label: 'Databank', icon: <Database className="w-5 h-5" />, permission: true },
        { id: 'reports', label: 'Reports', icon: <FileSpreadsheet className="w-5 h-5" />, permission: user.permissions?.canExportData },
        { id: 'submissions', label: 'My Submissions', icon: <FileText className="w-5 h-5" />, permission: user.role === 'Facility User' },
        { id: 'users', label: 'Manage Users', icon: <Users className="w-5 h-5" />, permission: user.permissions?.canManageUsers },
        { id: 'facilities', label: 'Manage Facilities', icon: <Building className="w-5 h-5" />, permission: user.permissions?.canManageFacilities },
        { id: 'audit', label: 'Audit Log', icon: <FileClock className="w-5 h-5" />, permission: user.permissions?.canViewAuditLog },
        { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" />, permission: user.permissions?.canManagePermissions || user.permissions?.canManagePrograms },
        { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" />, permission: true },
    ];

    const filteredNavItems = navItems.filter(item => {
        // --- FIX: Hide the 'Reports' link specifically for 'Facility Admin' ---
        if (item.id === 'reports' && user.role === 'Facility Admin') {
            return false;
        }
        return item.permission;
    });

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 bg-gray-800 text-white">
                <div className="flex items-center justify-center h-20 border-b border-gray-700">
                    <img src="https://placehold.co/40x40/1a202c/76e2d9?text=A" alt="Logo" className="w-10 h-10 rounded-full" />
                    <h1 className="text-xl font-bold ml-2">APDMS</h1>
                </div>
                <nav className="flex-1 px-4 py-4 space-y-2">
                    {filteredNavItems.map(item => (
                        <button 
                            key={item.id} 
                            onClick={() => onNavigate(item.id)} 
                            className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${currentPage === item.id ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}
                        >
                            {item.icon}
                            <span className="ml-3">{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="px-4 py-4 border-t border-gray-700">
                    <button 
                        onClick={onLogout} 
                        className="w-full flex items-center px-4 py-2 rounded-lg hover:bg-red-600 transition-colors duration-200"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="ml-3">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 text-white flex justify-around p-2 border-t border-gray-700 z-50">
                {filteredNavItems.map(item => (
                    <button 
                        key={item.id} 
                        onClick={() => onNavigate(item.id)} 
                        className={`flex flex-col items-center p-2 rounded-lg ${currentPage === item.id ? 'text-primary' : 'hover:bg-gray-700'}`}
                    >
                        {item.icon}
                    </button>
                ))}
            </div>
        </>
    );
};

export default Sidebar;
