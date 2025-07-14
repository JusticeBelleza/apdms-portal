import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Bell, AlertTriangle, CheckCircle2, Clock, Upload, FileText, User, LogOut, LayoutDashboard, ChevronDown, ChevronUp, Search, X, FileSpreadsheet, Printer, Settings, PlusCircle, Trash2, Edit, Users, Calendar, HelpCircle, Download, Building, FileClock, ShieldCheck, Database, Check, Ban } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { getFirestore, collection, getDocs, getDoc, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp, orderBy, writeBatch, updateDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getDatabase, ref, onValue, off, set, onDisconnect } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";


// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID,
  databaseURL: process.env.REACT_APP_DATABASE_URL,
};

if (!firebaseConfig.apiKey) {
    alert("Firebase API Key is missing. Please check your .env file and ensure REACT_APP_API_KEY is set.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);
const storage = getStorage(app);


// --- HELPER FUNCTIONS ---
const getStatusForProgram = (facilityName, program, submissions) => {
    const lastSubmission = submissions
        .filter(s => s.facilityName === facilityName && s.programName === program.name)
        .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate))[0];

    if (!lastSubmission) return { text: 'Pending', style: 'bg-yellow-100 text-yellow-800 border border-yellow-300', icon: <Clock className="w-4 h-4" />, isActionable: false };

    if (lastSubmission.status === 'Rejected') {
        return { text: 'Rejected', style: 'bg-red-100 text-red-800 border border-red-300', icon: <Ban className="w-4 h-4" />, isActionable: false };
    }

    if (!lastSubmission.confirmed) {
        return { text: 'Pending Confirmation', style: 'bg-orange-100 text-orange-800 border border-orange-300', icon: <HelpCircle className="w-4 h-4" />, isActionable: true, submissionId: lastSubmission.id, fileURL: lastSubmission.fileURL, fileName: lastSubmission.fileName };
    }

    const today = new Date();
    const submissionDate = new Date(lastSubmission.submissionDate);
    let daysDiff = (today - submissionDate) / (1000 * 60 * 60 * 24);

    let deadlineDays;
    switch (program.frequency) {
        case 'Weekly': deadlineDays = 7; break;
        case 'Monthly': deadlineDays = 30; break;
        case 'Quarterly': deadlineDays = 90; break;
        default: deadlineDays = 30;
    }

    if (daysDiff <= deadlineDays) {
        return { text: 'Submitted', style: 'bg-green-100 text-green-800 border border-green-300', icon: <CheckCircle2 className="w-4 h-4" />, isActionable: false };
    } else {
        return { text: 'Overdue', style: 'bg-red-100 text-red-800 border border-red-300', icon: <AlertTriangle className="w-4 h-4" />, isActionable: false };
    }
};

const getOverallFacilityStatus = (facilityName, programs, submissions, users) => {
    const facilityUser = users.find(u => u.facilityName === facilityName);
    if (!facilityUser) return { text: 'No User', style: 'bg-gray-100 text-gray-800' };

    const assignedPrograms = programs.filter(p => facilityUser.assignedPrograms?.includes(p.id));
    if (assignedPrograms.length === 0) return { text: 'N/A', style: 'bg-gray-100 text-gray-800' };

    const statuses = assignedPrograms.map(p => getStatusForProgram(facilityName, p, submissions).text);

    if (statuses.includes('Overdue')) return { text: 'Overdue', style: 'bg-red-100 text-red-800' };
    if (statuses.includes('Pending') || statuses.includes('Pending Confirmation')) return { text: 'Pending', style: 'bg-yellow-100 text-yellow-800' };
    if (statuses.every(s => s === 'Submitted')) return { text: 'Submitted', style: 'bg-green-100 text-green-800' };

    return { text: 'Pending', style: 'bg-yellow-100 text-yellow-800' };
};

const getMorbidityWeek = (d = new Date()) => {
    const date = new Date(d.valueOf());
    date.setHours(0, 0, 0, 0);
    // Sunday is the first day of the week
    const day = date.getDay();
    const diff = date.getDate() - day;
    const startOfWeek = new Date(date.setDate(diff));

    const year = startOfWeek.getFullYear();
    // The first week is the one with Jan 4th in it
    const jan4 = new Date(year, 0, 4);
    jan4.setHours(0, 0, 0, 0);
    const firstDayOfWeek1 = new Date(jan4.setDate(jan4.getDate() - jan4.getDay()));

    const diffMillis = startOfWeek - firstDayOfWeek1;
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const week = Math.round(diffMillis / oneWeek) + 1;
    
    if (week > 52) {
        const nextYearJan4 = new Date(year + 1, 0, 4);
        nextYearJan4.setHours(0, 0, 0, 0);
        const nextYearFirstDayOfWeek1 = new Date(nextYearJan4.setDate(nextYearJan4.getDate() - nextYearJan4.getDay()));
        if (startOfWeek >= nextYearFirstDayOfWeek1) {
            return 1;
        }
    }
    
    if (week < 1) {
         const prevYearJan4 = new Date(year - 1, 0, 4);
         prevYearJan4.setHours(0, 0, 0, 0);
         const prevYearFirstDayOfWeek1 = new Date(prevYearJan4.setDate(prevYearJan4.getDate() - prevYearJan4.getDay()));
         const prevYearDiffMillis = startOfWeek - prevYearFirstDayOfWeek1;
         return Math.round(prevYearDiffMillis / oneWeek) + 1;
    }
    
    return week;
};

const getDatesForMorbidityWeek = (week, year) => {
    const jan4 = new Date(year, 0, 4);
    jan4.setHours(0, 0, 0, 0);
    const firstDayOfWeek1 = new Date(jan4.setDate(jan4.getDate() - jan4.getDay()));
    
    const startDate = new Date(firstDayOfWeek1);
    startDate.setDate(startDate.getDate() + (week - 1) * 7);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    return { startDate, endDate };
}

const generateMorbidityWeeks = () => {
    const weeks = [];
    const currentWeek = getMorbidityWeek();
    for (let i = 0; i < 52; i++) {
        const week = currentWeek - i;
        if (week > 0) {
            weeks.push(week);
        }
    }
    return weeks;
};

const logAudit = async (db, user, action, details) => {
    try {
        await addDoc(collection(db, "audit_logs"), {
            timestamp: serverTimestamp(),
            userId: user.uid,
            userName: user.name,
            userRole: user.role,
            action: action,
            details: details,
        });
    } catch (error) {
        console.error("Error writing to audit log:", error);
    }
};

const exportToCSV = (data, filename) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = "data:text/csv;charset=utf-8,"
        + [headers.join(","), ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(","))].join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const getFileIcon = (fileName) => {
    if (!fileName) return <FileText className="w-5 h-5 text-gray-500" />;
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
        case 'pdf':
            return <FileText className="w-5 h-5 text-red-500" />;
        case 'csv':
            return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
        case 'xlsx':
        case 'xls':
            return <FileSpreadsheet className="w-5 h-5 text-green-700" />;
        case 'mdb':
            return <Database className="w-5 h-5 text-blue-500" />;
        default:
            return <FileText className="w-5 h-5 text-gray-500" />;
    }
};

// --- UI & LAYOUT COMPONENTS ---

const LoadingScreen = () => (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><div className="text-center"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-primary mx-auto"></div><h1 className="text-3xl font-bold mt-4">APDMS</h1><p className="text-lg text-gray-300">Abra PHO Disease Data Management System</p><p className="mt-2 text-primary">Loading Application...</p></div></div>
);

const LoginScreen = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); onLogin(email, password); };
    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4"><div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8"><div className="text-center mb-8"><img src="https://placehold.co/100x100/1a202c/76e2d9?text=APDMS" alt="APDMS Logo" className="w-24 h-24 mx-auto rounded-full mb-4 border-4 border-primary" /><h1 className="text-3xl font-bold text-white">APDMS Portal</h1><p className="text-gray-400">Abra PHO Disease Data Management System</p></div><form onSubmit={handleSubmit} className="space-y-6"><div><label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g., admin@pho.gov.ph" required /></div><div><label className="block text-sm font-medium text-gray-300 mb-1">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary" placeholder="************" required /></div><button type="submit" className="w-full bg-primary hover:bg-secondary text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105">Secure Login</button></form><div className="text-center mt-4 text-xs text-gray-500"><p>Use a valid email and 'password' to log in.</p></div></div><p className="text-center text-gray-500 text-xs mt-8">&copy;2025 Abra Provincial Health Office. All rights reserved.</p></div>
    );
};

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

    const filteredNavItems = navItems.filter(item => item.permission);

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 bg-gray-800 text-white"><div className="flex items-center justify-center h-20 border-b border-gray-700"><img src="https://placehold.co/40x40/1a202c/76e2d9?text=A" alt="Logo" className="w-10 h-10 rounded-full" /><h1 className="text-xl font-bold ml-2">APDMS</h1></div><nav className="flex-1 px-4 py-4 space-y-2">{filteredNavItems.map(item => (<button key={item.id} onClick={() => onNavigate(item.id)} className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${currentPage === item.id ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>{item.icon}<span className="ml-3">{item.label}</span></button>))}</nav><div className="px-4 py-4 border-t border-gray-700"><button onClick={onLogout} className="w-full flex items-center px-4 py-2 rounded-lg hover:bg-red-600 transition-colors duration-200"><LogOut className="w-5 h-5" /><span className="ml-3">Logout</span></button></div></aside>

            {/* Mobile Bottom Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 text-white flex justify-around p-2 border-t border-gray-700 z-50">
                {filteredNavItems.map(item => (
                    <button key={item.id} onClick={() => onNavigate(item.id)} className={`flex flex-col items-center p-2 rounded-lg ${currentPage === item.id ? 'text-primary' : 'hover:bg-gray-700'}`}>
                        {item.icon}
                    </button>
                ))}
            </div>
        </>
    );
};

const Header = ({ user, onLogout, unreadCount, onBellClick }) => (
    <header className="flex items-center justify-between h-auto md:h-20 p-2 sm:p-4 bg-white border-b">
        <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 truncate">Welcome, {user.name}!</h2>
            <p className="text-xs sm:text-sm text-gray-500">
                <span className="hidden sm:inline">{user.facilityName} - </span>
                <span>{user.role}</span>
            </p>
            <div className="flex items-center text-xs text-gray-500 mt-1">
                <Calendar className="w-4 h-4 mr-1.5" />
                <span>Morbidity Week: {getMorbidityWeek()}</span>
            </div>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2">
            <button onClick={onBellClick} className="relative p-2 rounded-full hover:bg-gray-200">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                )}
            </button>
            <button onClick={onLogout} className="p-2 rounded-full hover:bg-gray-200 md:hidden"><LogOut className="w-5 h-5 text-gray-600" /></button>
        </div>
    </header>
);

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Confirm</button>
                </div>
            </div>
        </div>
    );
};

const FacilityDashboard = ({ user, allPrograms, submissions, setSubmissions, db }) => {
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);

    const handleUploadClick = (program) => { setSelectedProgram(program); setShowUploadModal(true); };

    const handleFileUpload = async (file, morbidityWeek) => {
        if (!file || !selectedProgram) return;

        const fileRef = storageRef(storage, `submissions/${user.facilityName}/${selectedProgram.name}/${morbidityWeek}/${file.name}`);
        
        try {
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const newSubmission = {
                facilityName: user.facilityName,
                programName: selectedProgram.name,
                submissionDate: new Date().toISOString(),
                status: 'Pending Confirmation',
                fileURL: downloadURL, 
                fileName: file.name,
                confirmed: false,
                uploaderName: user.name,
                morbidityWeek: morbidityWeek,
            };

            await addDoc(collection(db, "submissions"), newSubmission);
            
            setShowUploadModal(false);
            setSelectedProgram(null);
            alert(`Proof for "${selectedProgram.name}" uploaded successfully for Morbidity Week ${morbidityWeek}. Pending PHO confirmation.`);
        } catch (error) {
            console.error("Error uploading file:", error);
            alert(`File upload failed: ${error.message}`);
        }
    };

    const userPrograms = allPrograms.filter(p => p.active && user.assignedPrograms.includes(p.id));

    return (
        <div className="space-y-6"><h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Your Reporting Dashboard</h1><div className="bg-white p-6 rounded-lg shadow-md"><h2 className="text-xl font-semibold mb-4 text-gray-700">Reporting Obligations Checklist</h2><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{userPrograms.map(program => { const status = getStatusForProgram(user.facilityName, program, submissions); return (<tr key={program.id} className={status.text === 'Overdue' ? 'bg-red-50' : ''}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{program.name}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{program.frequency}</td><td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.style}`}>{status.icon}<span className="ml-1.5">{status.text}</span></span></td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{program.type === 'upload' ? (<button onClick={() => handleUploadClick(program)} className="text-primary hover:text-secondary flex items-center"><Upload className="w-4 h-4 mr-1"/> Upload Report</button>) : (<button onClick={() => handleUploadClick(program)} className="text-indigo-600 hover:text-indigo-900 flex items-center"><Upload className="w-4 h-4 mr-1"/> Upload Proof</button>)}</td></tr>);})}</tbody></table></div></div>{showUploadModal && <UploadModal program={selectedProgram} onClose={() => setShowUploadModal(false)} onFileUpload={handleFileUpload} />}</div>
    );
};

const PhoAdminDashboard = ({ user, programs, submissions, users, onConfirm, onDeny }) => {
    const assignedProgramIds = user.assignedPrograms || [];
    const myPrograms = programs.filter(p => assignedProgramIds.includes(p.id));
    const myProgramNames = myPrograms.map(p => p.name);

    const pendingSubmissions = submissions.filter(s =>
        myProgramNames.includes(s.programName) &&
        !s.confirmed &&
        s.status !== 'Rejected'
    );

    const chartData = myPrograms.map(p => {
        const facilitiesForProgram = users.filter(u => u.assignedPrograms?.includes(p.id) && u.role === 'Facility User');
        
        const submittedFacilities = new Set(
            submissions
                .filter(s => s.programName === p.name && s.confirmed)
                .map(s => s.facilityName)
        );
        const submittedCount = submittedFacilities.size;

        return { name: p.name, Submitted: submittedCount, Pending: facilitiesForProgram.length - submittedCount };
    });
    
    return (
        <div className="space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">PHO Admin Dashboard</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">My Programs Compliance</h2>
                    <div style={{ width: '100%', height: 300 }}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Submitted" stackId="a" fill="#14b8a6" />
                            <Bar dataKey="Pending" stackId="a" fill="#f59e0b" />
                        </BarChart>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Pending Confirmations</h2>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {pendingSubmissions.length > 0 ? pendingSubmissions.map(sub => (
                            <div key={sub.id} className="bg-gray-50 p-3 rounded-md">
                                <p className="font-semibold">{sub.programName}</p>
                                <p className="text-sm text-gray-600">From: {sub.facilityName}</p>
                                <div className="flex justify-between items-center mt-2">
                                    <a href={sub.fileURL} download={sub.fileName} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Download className="w-5 h-5"/></a>
                                    <div className="flex space-x-2">
                                        <button onClick={() => onDeny(sub.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Ban className="w-5 h-5"/></button>
                                        {user.permissions?.canConfirmSubmissions && (
                                            <button onClick={() => onConfirm(sub.id)} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Check className="w-5 h-5"/></button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-gray-500 pt-10">No pending submissions for your programs.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const FacilityAdminDashboard = ({ user, programs, submissions, users, onlineStatuses }) => {
    const facilityName = user.facilityName;
    const facilityUsers = users.filter(u => u.facilityName === facilityName && u.role === 'Facility User');
    const assignedProgramIds = [...new Set(facilityUsers.flatMap(u => u.assignedPrograms || []))];
    const facilityPrograms = programs.filter(p => assignedProgramIds.includes(p.id));

    const complianceData = facilityPrograms.map(p => {
        const status = getStatusForProgram(facilityName, p, submissions).text;
        return { name: p.name, status };
    });

    const statusCounts = complianceData.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, {});

    const pieData = [
        { name: 'Submitted', value: statusCounts['Submitted'] || 0 },
        { name: 'Pending', value: (statusCounts['Pending'] || 0) + (statusCounts['Pending Confirmation'] || 0) },
        { name: 'Overdue', value: statusCounts['Overdue'] || 0 },
    ];

    const COLORS = {
        Submitted: '#10b981',
        Pending: '#f59e0b',
        Overdue: '#ef4444',
    };

    return (
        <div className="space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">{facilityName} Dashboard</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Facility Compliance</h2>
                    <div style={{ width: '100%', height: 250 }}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </div>
                </div>
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">User Status</h2>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {facilityUsers.map(u => (
                            <div key={u.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                <p className="font-medium">{u.name}</p>
                                <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {u.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    <span className={`h-3 w-3 rounded-full ${onlineStatuses[u.id] ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
             <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Recent Submissions</h2>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {submissions.filter(s => s.facilityName === facilityName).slice(0, 5).map(s => {
                                const program = programs.find(p => p.name === s.programName);
                                const status = getStatusForProgram(facilityName, program, submissions);
                                return (
                                <tr key={s.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{s.programName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{s.uploaderName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{s.submissionDate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.style}`}>
                                            {status.icon}
                                            <span className="ml-1.5">{status.text}</span>
                                        </span>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AdminDashboard = ({ facilities, programs, submissions, users, onConfirm, user, announcements, onAddAnnouncement, onDeleteAnnouncement, onApproveDeletion, onDenyDeletion, onNavigate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedFacility, setExpandedFacility] = useState(null);
    const [selectedProgramId, setSelectedProgramId] = useState('');

    useEffect(() => {
        if (programs.length > 0 && !selectedProgramId) {
            setSelectedProgramId(programs[0].id);
        }
    }, [programs, selectedProgramId]);
    
    const selectedProgram = useMemo(() => programs.find(p => p.id === selectedProgramId), [programs, selectedProgramId]);

    const deletionRequests = useMemo(() => submissions.filter(s => s.deletionRequest), [submissions]);

    const filteredFacilities = useMemo(() => {
        if (!selectedProgram) return [];
        
        const applicableFacilityNames = new Set(
            users
                .filter(u => u.role === 'Facility User' && (u.assignedPrograms || []).includes(selectedProgram.id))
                .map(u => u.facilityName)
        );

        return facilities.filter(f => applicableFacilityNames.has(f.name));
    }, [selectedProgram, facilities, users]);

    const complianceData = useMemo(() => {
        if (!selectedProgram) {
            return { totalSubmitted: 0, totalPending: 0, complianceRate: 0, totalFacilities: 0, chartData: [] };
        }

        const submittedFacilities = new Set(
            submissions
                .filter(s => s.programName === selectedProgram.name && s.confirmed)
                .map(s => s.facilityName)
        );
        
        const totalSubmitted = submittedFacilities.size;
        const totalFacilities = filteredFacilities.length;
        const totalPending = totalFacilities - totalSubmitted;
        const complianceRate = totalFacilities > 0 ? ((totalSubmitted / totalFacilities) * 100).toFixed(1) : 0;
        
        const statsByType = filteredFacilities.reduce((acc, facility) => {
            const type = facility.type || 'Uncategorized';
            if (!acc[type]) {
                acc[type] = { total: 0, submitted: 0 };
            }
            acc[type].total += 1;
            if (submittedFacilities.has(facility.name)) {
                acc[type].submitted += 1;
            }
            return acc;
        }, {});
        
        const chartData = Object.keys(statsByType).map(type => ({
            name: type,
            Submitted: statsByType[type].submitted,
            Pending: statsByType[type].total - statsByType[type].submitted
        }));

        return { totalSubmitted, totalPending, complianceRate, totalFacilities, chartData };
    }, [selectedProgram, submissions, filteredFacilities]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Provincial Compliance Dashboard</h1>
                 <select 
                     value={selectedProgramId} 
                     onChange={e => setSelectedProgramId(e.target.value)}
                     className="mt-1 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                 >
                     {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
            </div>
            
            {deletionRequests.length > 0 && (
                 <div className="bg-red-50 border border-red-200 p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-red-800">Deletion Requests ({deletionRequests.length})</h2>
                        <button onClick={() => onNavigate('deletion-requests')} className="text-sm font-medium text-primary hover:underline">Manage Requests</button>
                    </div>
                    <p className="text-red-700">There are submissions marked for deletion that require your approval.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-teal-100"><CheckCircle2 className="w-6 h-6 text-primary" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Compliance Rate</p>
                        <p className="text-2xl font-bold text-gray-800">{complianceData.complianceRate}%</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-green-100"><FileText className="w-6 h-6 text-green-600" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Total Submitted</p>
                        <p className="text-2xl font-bold text-gray-800">{complianceData.totalSubmitted}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-yellow-100"><Clock className="w-6 h-6 text-yellow-600" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Total Pending/Overdue</p>
                        <p className="text-2xl font-bold text-gray-800">{complianceData.totalPending}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-blue-100"><User className="w-6 h-6 text-blue-600" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Reporting Facilities</p>
                        <p className="text-2xl font-bold text-gray-800">{complianceData.totalFacilities}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Compliance by Facility Type</h2>
                <div style={{ width: '100%', height: 300 }}>
                    <BarChart data={complianceData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Submitted" stackId="a" fill="#14b8a6" />
                        <Bar dataKey="Pending" stackId="a" fill="#f59e0b" />
                    </BarChart>
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Facility Submission Status</h2>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" placeholder="Search for a facility..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"/>
                </div>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {filteredFacilities.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).map(facility => {
                        if (!selectedProgram) return null;
                        const status = getStatusForProgram(facility.name, selectedProgram, submissions);
                        return (
                            <div key={facility.id} className="border rounded-lg p-4 flex justify-between items-center">
                                <div className="flex items-center">
                                    <span className="font-medium text-gray-800">{facility.name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {status.isActionable && <a href={status.fileURL} download={status.fileName} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">View Proof</a>}
                                    {status.isActionable && user.permissions?.canConfirmSubmissions && <button onClick={() => onConfirm(status.submissionId)} className="text-sm bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">Confirm</button>}
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.style}`}>{status.icon}<span className="ml-1.5">{status.text}</span></span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

const ReportsPage = ({ programs, submissions, users, user }) => {
    const [reportType, setReportType] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarter, setQuarter] = useState(1);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [week, setWeek] = useState(getMorbidityWeek());
    const [selectedProgramId, setSelectedProgramId] = useState('');
    const [generatedReport, setGeneratedReport] = useState(null);
    
    const selectedProgram = programs.find(p => p.id === selectedProgramId);
    
    useEffect(() => {
        if (programs.length > 0 && !selectedProgramId) {
            setSelectedProgramId(programs[0].id);
        }
    }, [programs, selectedProgramId]);

    useEffect(() => {
        if (selectedProgram && selectedProgram.reportTypes) {
            setReportType(selectedProgram.reportTypes[0]);
        }
    }, [selectedProgram]);

    const handleGenerateReport = () => {
        if (!selectedProgram) {
            alert("Please select a program to generate a report.");
            return;
        }

        const programName = selectedProgram.name;
        const programId = selectedProgram.id;
        
        const facilitiesForReport = [...new Set(users
            .filter(u => u.assignedPrograms.includes(programId) && u.facilityName !== 'Provincial Health Office')
            .map(u => u.facilityName)
        )];

        let startDate, endDate;
        let title = '';

        
        switch(reportType) {
            case 'Morbidity Week':
                const dates = getDatesForMorbidityWeek(week, year);
                startDate = dates.startDate;
                endDate = dates.endDate;
                title = `${programName} Report - Morbidity Week ${week}, ${year}`;
                break;
            case 'Morbidity Month':
                startDate = new Date(year, month - 1, 1);
                endDate = new Date(year, month, 0);
                title = `${programName} Report - ${startDate.toLocaleString('default', { month: 'long' })} ${year}`;
                break;
            case 'Morbidity Year':
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 11, 31);
                title = `${programName} Report - ${year}`;
                break;
            case 'Quarterly':
                const startMonth = (quarter - 1) * 3;
                startDate = new Date(year, startMonth, 1);
                endDate = new Date(year, startMonth + 3, 0);
                title = `Quarterly ${programName} Report - Q${quarter} ${year}`;
                break;
            case 'Annual':
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 11, 31);
                title = `Annual ${programName} Report - ${year}`;
                break;
            default:
                break;
        }
        
        const relevantSubmissions = submissions.filter(s => { const subDate = new Date(s.submissionDate); return s.programName === programName && subDate >= startDate && subDate <= endDate; });
        const reportData = facilitiesForReport.map(facility => {
            const facilitySubmissions = relevantSubmissions.filter(s => s.facilityName === facility);
            const totalCases = facilitySubmissions.reduce((acc, curr) => acc + (curr.data?.cases || 0), 0);
            return { facilityName: facility, totalCases, submissionsCount: facilitySubmissions.length };
        });
        const totalCases = reportData.reduce((acc, curr) => acc + curr.totalCases, 0);
        const reportingFacilities = reportData.filter(r => r.submissionsCount > 0).length;
        setGeneratedReport({ title, period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, totalCases, reportingFacilities, totalFacilities: facilitiesForReport.length, breakdown: reportData.sort((a, b) => b.totalCases - a.totalCases) });
    };

    return (
        <div className="space-y-6"><h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Report Generation</h1><div className="bg-white p-6 rounded-lg shadow-md print:hidden"><h2 className="text-xl font-semibold mb-4 text-gray-700">Consolidated Program Report</h2><div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
                <label className="block text-sm font-medium text-gray-700">Health Program</label>
                <select value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                    <option value="">Select a Program</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            {selectedProgram && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Report Type</label>
                        <select value={reportType} onChange={e => setReportType(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                            {selectedProgram.reportTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    {(reportType.includes('Year') || reportType.includes('Quarterly')) && <div><label className="block text-sm font-medium text-gray-700">Year</label><select value={year} onChange={e => setYear(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"><option>{new Date().getFullYear()}</option><option>{new Date().getFullYear() - 1}</option></select></div>}
                    {reportType === 'Morbidity Month' && <div><label className="block text-sm font-medium text-gray-700">Month</label><select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">{[...Array(12).keys()].map(m => <option key={m} value={m+1}>{new Date(0, m).toLocaleString('default', { month: 'long' })}</option>)}</select></div>}
                    {reportType === 'Morbidity Week' && <div><label className="block text-sm font-medium text-gray-700">Week</label><select value={week} onChange={e => setWeek(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">{generateMorbidityWeeks().map(w => <option key={w} value={w}>{w}</option>)}</select></div>}
                    {reportType === 'Quarterly' && (<div><label className="block text-sm font-medium text-gray-700">Quarter</label><select value={quarter} onChange={e => setQuarter(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"><option value={1}>Q1 (Jan-Mar)</option><option value={2}>Q2 (Apr-Jun)</option><option value={3}>Q3 (Jul-Sep)</option><option value={4}>Q4 (Oct-Dec)</option></select></div>)}
                </>
            )}
            <button onClick={handleGenerateReport} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300 h-10">Generate Report</button></div></div>{generatedReport && (<div id="report-view" className="bg-white p-8 rounded-lg shadow-md"><div className="flex justify-between items-start"><div><h2 className="text-2xl font-bold text-gray-900">{generatedReport.title}</h2><p className="text-sm text-gray-500">Reporting Period: {generatedReport.period}</p><p className="text-sm text-gray-500">Generated on: {new Date().toLocaleDateString()}</p></div><button onClick={() => window.print()} className="print:hidden flex items-center bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded-lg transition duration-300"><Printer className="w-4 h-4 mr-2" />Print / Save as PDF</button></div><hr className="my-6" /><div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"><div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Total Cases</p><p className="text-3xl font-bold text-primary">{generatedReport.totalCases}</p></div><div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Reporting Facilities</p><p className="text-3xl font-bold text-primary">{generatedReport.reportingFacilities}</p></div><div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Compliance Rate</p><p className="text-3xl font-bold text-primary">{generatedReport.totalFacilities > 0 ? ((generatedReport.reportingFacilities / generatedReport.totalFacilities) * 100).toFixed(1) : 0}%</p></div></div><h3 className="text-lg font-semibold mb-4 text-gray-700">Breakdown by Facility</h3><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 border"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submissions Made</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cases Reported</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{generatedReport.breakdown.map(item => (<tr key={item.facilityName}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.facilityName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.submissionsCount}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-bold">{item.totalCases}</td></tr>))}</tbody></table></div></div>)}</div>
    );
};

const SettingsPage = ({ programs, user, db }) => {
    const [showProgramModal, setShowProgramModal] = useState(false);
    const [editingProgram, setEditingProgram] = useState(null);
    const canManagePrograms = user.permissions?.canManagePrograms;

    const handleAddProgram = () => {
        setEditingProgram(null);
        setShowProgramModal(true);
    };
    
    const handleEditProgram = (program) => {
        setEditingProgram(program);
        setShowProgramModal(true);
    };

    const handleSaveProgram = async (programData) => {
        if (editingProgram) {
            const programDocRef = doc(db, 'programs', editingProgram.id);
            await setDoc(programDocRef, programData, { merge: true });
        } else {
            const newProgramId = programData.name.toLowerCase().replace(/\s+/g, '-');
            await setDoc(doc(db, "programs", newProgramId), { ...programData, id: newProgramId });
        }
        setShowProgramModal(false);
    };

    const handleDeleteProgram = async (programId) => {
        if (window.confirm('Are you sure you want to delete this program? This cannot be undone.')) {
            await deleteDoc(doc(db, "programs", programId));
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Settings</h1>
            
            {canManagePrograms && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-700">Manage Health Programs</h2>
                        <button onClick={handleAddProgram} className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                            <PlusCircle className="w-5 h-5 md:mr-2"/>
                            <span className="hidden md:inline">Add Program</span>
                        </button>
                    </div>
                    <div className="space-y-2">
                        {programs.map(program => (
                            <div key={program.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                                <div>
                                    <p className="font-semibold">{program.name}</p>
                                    <p className="text-sm text-gray-500">Frequency: {program.frequency} | Type: {program.type}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => handleEditProgram(program)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full">
                                        <Edit className="w-5 h-5" />
                                    </button>
                                    {!program.core && (
                                        <button onClick={() => handleDeleteProgram(program.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {user.permissions?.canManagePermissions && <PermissionsManagement db={db} />}

            {showProgramModal && <ProgramFormModal program={editingProgram} onClose={() => setShowProgramModal(false)} onSave={handleSaveProgram} />}
        </div>
    );
};

const PermissionsManagement = ({ db }) => {
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);

    const roles = ['PHO Admin', 'Facility Admin', 'Viewer', 'Facility User'];
    const permissionKeys = [
        { key: 'canManageUsers', label: 'Manage Users' },
        { key: 'canManageFacilities', label: 'Manage Facilities' },
        { key: 'canManagePrograms', label: 'Manage Programs' },
        { key: 'canManagePermissions', label: 'Manage Permissions' },
        { key: 'canViewAuditLog', label: 'View Audit Log' },
        { key: 'canExportData', label: 'Export Data' },
        { key: 'canConfirmSubmissions', label: 'Confirm Submissions' },
    ];

    useEffect(() => {
        const fetchPermissions = async () => {
            setLoading(true);
            const perms = {};
            for (const role of roles) {
                const docRef = doc(db, "permissions", role);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    perms[role] = docSnap.data();
                } else {
                    // Default permissions if not set in DB
                    perms[role] = permissionKeys.reduce((acc, p) => ({ ...acc, [p.key]: false }), {});
                }
            }
            setPermissions(perms);
            setLoading(false);
        };
        fetchPermissions();
    }, [db]);

    const handlePermissionChange = (role, permissionKey) => {
        setPermissions(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [permissionKey]: !prev[role][permissionKey]
            }
        }));
    };

    const handleSavePermissions = async () => {
        const batch = writeBatch(db);
        for (const role in permissions) {
            const docRef = doc(db, "permissions", role);
            batch.set(docRef, permissions[role]);
        }
        await batch.commit();
        alert('Permissions updated successfully!');
    };

    if (loading) {
        return <div className="bg-white p-6 rounded-lg shadow-md">Loading permissions...</div>;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Role Permissions</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            {permissionKeys.map(p => (
                                <th key={p.key} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{p.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {roles.map(role => (
                            <tr key={role}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{role}</td>
                                {permissionKeys.map(p => (
                                    <td key={p.key} className="px-6 py-4 whitespace-nowrap text-center">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                            checked={permissions[role]?.[p.key] || false}
                                            onChange={() => handlePermissionChange(role, p.key)}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="text-right mt-4">
                <button onClick={handleSavePermissions} className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-3 md:px-4 rounded-lg">
                    <ShieldCheck className="w-5 h-5 md:mr-2" />
                    <span className="hidden md:inline">Save Permissions</span>
                </button>
            </div>
        </div>
    );
};

const ProgramFormModal = ({ program, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: program?.name || '',
        frequency: program?.frequency || 'Monthly',
        type: program?.type || 'upload',
        reportTypes: program?.reportTypes || ['Quarterly', 'Annual'],
    });

    const allReportTypes = ['Morbidity Week', 'Morbidity Month', 'Morbidity Year', 'Quarterly', 'Annual'];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleReportTypeChange = (e) => {
        const { options } = e.target;
        const selectedTypes = [];
        for (let i = 0, l = options.length; i < l; i++) {
            if (options[i].selected) {
                selectedTypes.push(options[i].value);
            }
        }
        setFormData(prev => ({ ...prev, reportTypes: selectedTypes }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button>
                <h2 className="text-xl font-bold text-gray-800 mb-4">{program ? 'Edit' : 'Add'} Program</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Program Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Frequency</label>
                            <select name="frequency" value={formData.frequency} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                                <option>Weekly</option>
                                <option>Monthly</option>
                                <option>Quarterly</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Submission Type</label>
                            <select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                                <option value="upload">File Upload</option>
                                <option value="external">Mark as Submitted</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Report Types</label>
                        <select multiple value={formData.reportTypes} onChange={handleReportTypeChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                            {allReportTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Save Program</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const FacilityManagementPage = ({ user, facilities, db }) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

    const sortedFacilities = [...facilities].sort((a, b) => {
        if (!sortConfig.key) return 0;

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    }).filter(f => f.name !== 'Provincial Health Office'); // Filter out PHO

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'ascending' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
        }
        return null;
    };

    const handleDeleteFacility = async (facilityId) => {
        if (window.confirm('Are you sure you want to delete this facility? This will not delete their submissions, but it will remove the facility from the system.')) {
            try {
                await deleteDoc(doc(db, "facilities", facilityId));
                alert('Facility deleted successfully!');
            } catch (error) {
                alert(`Error deleting facility: ${error.message}`);
            }
        }
    };

    const handleExport = () => {
        const dataToExport = sortedFacilities.map(({ id, ...rest }) => rest);
        exportToCSV(dataToExport, "facilities");
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Manage Facilities</h1>
                <div className="flex space-x-2">
                    {user.permissions?.canExportData && (
                        <button onClick={handleExport} className="inline-flex items-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                            <Download className="w-5 h-5 md:mr-2" />
                            <span className="hidden md:inline">Export to CSV</span>
                        </button>
                    )}
                    <button onClick={() => setShowAddModal(true)} className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                        <PlusCircle className="w-5 h-5 md:mr-2" />
                        <span className="hidden md:inline">Add Facility</span>
                    </button>
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Existing Facilities</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900" onClick={() => requestSort('name')}>
                                    <div className="flex items-center">Facility Name {getSortIndicator('name')}</div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900" onClick={() => requestSort('type')}>
                                    <div className="flex items-center">Facility Type {getSortIndicator('type')}</div>
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedFacilities.map(facility => (
                                <tr key={facility.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{facility.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{facility.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleDeleteFacility(facility.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full inline-flex items-center">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {showAddModal && <AddFacilityModal onClose={() => setShowAddModal(false)} db={db} />}
        </div>
    );
};

const AddFacilityModal = ({ onClose, db }) => {
    const [facilityName, setFacilityName] = useState('');
    const [facilityType, setFacilityType] = useState('Primary Care Facility');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!facilityName) {
            alert('Facility name cannot be empty.');
            return;
        }

        try {
            const newFacility = {
                name: facilityName,
                type: facilityType,
            };
            await addDoc(collection(db, "facilities"), newFacility);
            alert('Facility added successfully!');
            onClose();
        } catch (error) {
            alert(`Error adding facility: ${error.message}`);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200">
                    <X className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Facility</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Facility Type</label>
                        <select value={facilityType} onChange={e => setFacilityType(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                            <option>Primary Care Facility</option>
                            <option>Government Hospital</option>
                            <option>Private Hospital</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Facility Name</label>
                        <input type="text" value={facilityName} onChange={e => setFacilityName(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" placeholder="e.g., Abra Provincial Hospital" required />
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Add Facility</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const UserManagementPage = ({ users, facilities, programs, currentUser, auth, db }) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showAddFacilityAdminModal, setShowAddFacilityAdminModal] = useState(false);
    const [expandedFacility, setExpandedFacility] = useState(null);

    const isSuperAdmin = currentUser.role === 'Super Admin';
    const isPhoAdmin = currentUser.role === 'PHO Admin';
    const isFacilityAdmin = currentUser.role === 'Facility Admin';

    const phoUsers = users
        .filter(u => u.facilityName === 'Provincial Health Office' && u.role !== 'Super Admin')
        .sort((a,b) => a.name.localeCompare(b.name));

    const facilityUsersByFacility = users
        .filter(u => u.facilityName !== 'Provincial Health Office')
        .sort((a,b) => a.facilityName.localeCompare(b.name) || a.name.localeCompare(b.name))
        .reduce((acc, user) => {
            const { facilityName } = user;
            if (!acc[facilityName]) {
                acc[facilityName] = [];
            }
            acc[facilityName].push(user);
            return acc;
        }, {});
    
    const facilitiesToDisplay = isFacilityAdmin 
        ? Object.keys(facilityUsersByFacility).filter(name => name === currentUser.facilityName)
        : Object.keys(facilityUsersByFacility).sort();


    const handleAddUser = async (newUser) => {
        try {
            const tempAuth = getAuth(initializeApp(firebaseConfig, `secondary-auth-${Date.now()}`));
            const userCredential = await createUserWithEmailAndPassword(tempAuth, newUser.email, newUser.password);
            const user = userCredential.user;
            await setDoc(doc(db, "users", user.uid), {
                id: user.uid,
                name: newUser.name,
                email: newUser.email,
                facilityName: newUser.facilityName,
                role: newUser.role,
                assignedPrograms: newUser.assignedPrograms,
                isActive: true
            });
            await logAudit(db, currentUser, "Create User", { newUserName: newUser.name, newUserRole: newUser.role });
            alert('User added successfully.');
            setShowAddModal(false);
        } catch (error) {
            alert(`Error adding user: ${error.message}`);
        }
    };

    const handleEditUser = async (updatedUser) => {
        const userDocRef = doc(db, "users", updatedUser.id);
        await setDoc(userDocRef, updatedUser, { merge: true });
        await logAudit(db, currentUser, "Edit User", { targetUserName: updatedUser.name });
        setShowEditModal(false);
        setEditingUser(null);
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setShowEditModal(true);
    };

    const handleDeleteUser = async (userId, userEmail) => {
        if (window.confirm(`Are you sure you want to permanently delete this user (${userEmail})? This action cannot be undone.`)) {
            
            const firebaseUser = auth.currentUser;
            if (!firebaseUser) {
                alert("Error: You must be logged in to perform this action.");
                return;
            }

            try {
                const idToken = await firebaseUser.getIdToken(true);

                const functionUrl = 'https://us-central1-apdms-portal.cloudfunctions.net/deleteUser';

                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ data: { uid: userId } })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to delete user.');
                }

                const result = await response.json();

                // After successful deletion from Auth, delete from Firestore
                await deleteDoc(doc(db, "users", userId));
                
                // Use the 'currentUser' prop for logging, which contains the full user profile
                await logAudit(db, currentUser, "Permanently Delete User", { targetUserId: userId });

                alert(result.data.message || 'User successfully deleted.');
    
            } catch (error) {
                console.error("Error deleting user:", error);
                alert(`An error occurred while deleting the user: ${error.message}`);
            }
        }
    };

    const handleToggleUserStatus = async (user, isActive) => {
        const userDocRef = doc(db, "users", user.id);
        await setDoc(userDocRef, { isActive: !isActive }, { merge: true });
        await logAudit(db, currentUser, isActive ? "Deactivate User" : "Activate User", { targetUserName: user.name });
    };

    const handleExport = () => {
        const dataToExport = users.map(({ password, ...rest }) => rest);
        exportToCSV(dataToExport, "users");
    };

    const canEditOrDelete = (targetUser) => {
        if (isSuperAdmin) return targetUser.id !== currentUser.id;
        if (isPhoAdmin) return targetUser.role === 'Facility Admin' || targetUser.role === 'Facility User';
        if (isFacilityAdmin) return targetUser.role === 'Facility User' && targetUser.facilityName === currentUser.facilityName;
        return false;
    }

    const UserRow = ({user}) => (
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3 px-4">
            <div>
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
                <p className="text-sm text-gray-600 md:hidden">{user.facilityName} - {user.role}</p>
            </div>
            <div className="flex items-center space-x-2 mt-2 md:mt-0">
                {user.role !== 'Super Admin' && (
                    <label htmlFor={`toggle-active-${user.id}`} className={`flex items-center ${user.id === currentUser.id ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <div className="relative">
                            <input
                                type="checkbox"
                                id={`toggle-active-${user.id}`}
                                className="sr-only"
                                checked={user.isActive}
                                onChange={() => handleToggleUserStatus(user, user.isActive)}
                                disabled={user.id === currentUser.id}
                            />
                            <div className={`block w-12 h-6 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${user.isActive ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                    </label>
                )}
                {canEditOrDelete(user) && <button onClick={() => openEditModal(user)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit className="w-4 h-4"/></button>}
                {canEditOrDelete(user) && <button onClick={() => handleDeleteUser(user.id, user.email)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 className="w-4 h-4"/></button>}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Manage Users</h1>
                <div className="flex space-x-2">
                    {currentUser.permissions?.canExportData && (
                        <button onClick={handleExport} className="inline-flex items-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                            <Download className="w-5 h-5 md:mr-2" />
                            <span className="hidden md:inline">Export Users</span>
                        </button>
                    )}
                    {(isSuperAdmin || isPhoAdmin) && (
                        <button onClick={() => setShowAddFacilityAdminModal(true)} className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                            <Building className="w-5 h-5 md:mr-2"/>
                            <span className="hidden md:inline">Add Facility Admin</span>
                        </button>
                    )}
                    {(isSuperAdmin || isFacilityAdmin) && (
                        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                            <PlusCircle className="w-5 h-5 md:mr-2"/>
                            <span className="hidden md:inline">Add User</span>
                        </button>
                    )}
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                {isSuperAdmin && (
                    <>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">PHO Accounts</h3>
                        <div className="divide-y divide-gray-200 border rounded-lg">
                            {phoUsers.map(user => <UserRow key={user.id} user={user} />)}
                        </div>
                    </>
                )}

                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Facility Accounts</h3>
                <div className="space-y-2">
                    {facilitiesToDisplay.map(facilityName => (
                        <div key={facilityName} className="border rounded-lg">
                            <button onClick={() => setExpandedFacility(expandedFacility === facilityName ? null : facilityName)} className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-50">
                                <span className="font-medium text-gray-800">{facilityName}</span>
                                {expandedFacility === facilityName ? <ChevronUp /> : <ChevronDown />}
                            </button>
                            {expandedFacility === facilityName && (
                                <div className="p-4 border-t bg-gray-50 divide-y divide-gray-200">
                                    {facilityUsersByFacility[facilityName].map(user => <UserRow key={user.id} user={user} />)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {showAddModal && <UserFormModal title="Add New User" onClose={() => setShowAddModal(false)} onSave={handleAddUser} facilities={facilities} programs={programs} currentUser={currentUser} auth={auth} db={db} />}
            {showEditModal && <UserFormModal title="Edit User" user={editingUser} onClose={() => setShowEditModal(false)} onSave={handleEditUser} facilities={facilities} programs={programs} currentUser={currentUser} auth={auth} db={db} />}
            {showAddFacilityAdminModal && <AddFacilityAdminModal onClose={() => setShowAddFacilityAdminModal(false)} auth={auth} db={db} facilities={facilities} />}
        </div>
    );
};

const SubmissionsHistory = ({ user, submissions, setSubmissions, db }) => {
    const userSubmissions = submissions.filter(s => s.facilityName === user.facilityName)
        .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));

    const handleDeleteSubmission = async (submissionId) => {
        if (window.confirm('Are you sure you want to delete this submission?')) {
            await deleteDoc(doc(db, "submissions", submissionId));
        }
    };
    
    return (
        <div className="space-y-6"><h1 className="text-2xl md:text-3xl font-bold text-gray-800">Your Submission History</h1><div className="bg-white p-6 rounded-lg shadow-md"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Morbidity Week</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{userSubmissions.length > 0 ? userSubmissions.map(sub => (<tr key={sub.id}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.programName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.submissionDate}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.morbidityWeek}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.uploaderName}</td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">{sub.fileURL && <a href={sub.fileURL} download={sub.fileName} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-100 rounded-full inline-flex items-center"><Download className="w-4 h-4"/></a>}{!sub.confirmed && (<button onClick={() => handleDeleteSubmission(sub.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full inline-flex items-center"><Trash2 className="w-4 h-4"/></button>)}</td></tr>)) : (<tr><td colSpan="5" className="text-center py-10 text-gray-500">No submissions found.</td></tr>)}</tbody></table></div></div></div>
    );
};

const UserFormModal = ({ title, user, onClose, onSave, facilities, programs, currentUser, auth, db }) => {
    const isSuperAdmin = currentUser.role === 'Super Admin';
    const isPhoAdmin = currentUser.role === 'PHO Admin';
    const isFacilityAdmin = currentUser.role === 'Facility Admin';

    const getInitialFormData = () => {
        if (user) { // Editing existing user
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                password: '',
                confirmPassword: '',
                facilityName: user.facilityName,
                role: user.role,
                assignedPrograms: user.assignedPrograms || []
            };
        } else { // Adding new user
            let initialRole = 'Facility User';
            let initialFacility = '';
            if (isSuperAdmin) {
                initialRole = 'PHO Admin';
                initialFacility = 'Provincial Health Office';
            } else if (isFacilityAdmin) {
                initialFacility = currentUser.facilityName;
            }
            return {
                id: null,
                name: '',
                email: '',
                password: '',
                confirmPassword: '',
                facilityName: initialFacility,
                role: initialRole,
                assignedPrograms: []
            };
        }
    };

    const [formData, setFormData] = useState(getInitialFormData());

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'role') {
            const isPhoRole = value === 'PHO Admin' || value === 'Viewer';
            setFormData(prev => ({
                ...prev,
                [name]: value,
                facilityName: isPhoRole ? 'Provincial Health Office' : ''
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleToggleProgram = (programId) => {
        setFormData(prev => {
            const assigned = prev.assignedPrograms;
            if (assigned.includes(programId)) {
                return { ...prev, assignedPrograms: assigned.filter(id => id !== programId) };
            } else {
                return { ...prev, assignedPrograms: [...assigned, programId] };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
        if (!user && !formData.password) {
            alert('Password field cannot be empty for new users.');
            return;
        }
        onSave(formData);
    };

    const renderRoleOptions = () => {
        if (isSuperAdmin) {
            return (
                <>
                    <option>PHO Admin</option>
                    <option>Viewer</option>
                    <option>Facility Admin</option>
                    <option>Facility User</option>
                </>
            );
        }
        if (isPhoAdmin) {
             return (
                <>
                    <option>Facility Admin</option>
                    <option>Facility User</option>
                </>
            );
        }
        if (isFacilityAdmin) {
            return <option>Facility User</option>;
        }
        return null;
    };
    
    const isFacilityRole = formData.role === 'Facility Admin' || formData.role === 'Facility User';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button>
                <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required disabled={!!user} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" placeholder={user ? "Leave blank to keep current" : "Set initial password"} required={!user} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                        <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" placeholder="Confirm password" required={!user || formData.password} />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Role</label>
                        <select name="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" disabled={!!user && !isSuperAdmin}>
                            {renderRoleOptions()}
                        </select>
                    </div>

                    {isFacilityRole && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Facility</label>
                            <select 
                                name="facilityName" 
                                value={formData.facilityName} 
                                onChange={handleChange} 
                                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" 
                                disabled={isFacilityAdmin || (!!user && !isSuperAdmin)}
                            >
                                <option value="">Select a Facility</option>
                                {facilities.filter(f => f.name !== 'Provincial Health Office').map(f => (
                                    <option key={f.id} value={f.name}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {(isSuperAdmin || (isFacilityAdmin && user?.role === 'Facility User')) && (
                         <div className="border-t pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Health Programs</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {programs.map(program => (
                                    <div key={program.id} className="flex items-center justify-between">
                                        <span>{program.name}</span>
                                        <label htmlFor={`user-toggle-${program.id}`} className="flex items-center cursor-pointer">
                                            <div className="relative">
                                                <input type="checkbox" id={`user-toggle-${program.id}`} className="sr-only" checked={formData.assignedPrograms.includes(program.id)} onChange={() => handleToggleProgram(program.id)} />
                                                <div className={`block w-12 h-6 rounded-full ${formData.assignedPrograms.includes(program.id) ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${formData.assignedPrograms.includes(program.id) ? 'transform translate-x-6' : ''}`}></div>
                                            </div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Save User</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AddFacilityAdminModal = ({ onClose, auth, db, facilities }) => {
    const [formData, setFormData] = useState({
        facilityName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
        if (!formData.facilityName) {
            alert('Please select a facility.');
            return;
        }

        try {
            const tempAuth = getAuth(initializeApp(firebaseConfig, `secondary-auth-${Date.now()}`));
            const userCredential = await createUserWithEmailAndPassword(tempAuth, formData.email, formData.password);
            const newUser = userCredential.user;

            await setDoc(doc(db, "users", newUser.uid), {
                id: newUser.uid,
                name: `${formData.facilityName} Admin`,
                email: formData.email,
                facilityName: formData.facilityName,
                role: 'Facility Admin',
                assignedPrograms: [],
                isActive: true
            });
            alert('Facility Admin created successfully!');
            onClose();
        } catch (error) {
            alert(`Error creating facility admin: ${error.message}`);
        }
    };
    
    const facilitiesByType = facilities.reduce((acc, facility) => {
        if (facility.name === 'Provincial Health Office') return acc;
        const type = facility.type || 'Uncategorized';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(facility);
        return acc;
    }, {});


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Facility Admin</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Facility</label>
                        <select name="facilityName" value={formData.facilityName} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required>
                            <option value="">Select a Facility</option>
                            {Object.keys(facilitiesByType).map(type => (
                                <optgroup label={type} key={type}>
                                    {facilitiesByType[type].map(facility => (
                                        <option key={facility.id} value={facility.name}>{facility.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Admin Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                        <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Create Facility Admin</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const ProfilePage = ({ user, auth, db, setUser }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user.name);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        const userDocRef = doc(db, "users", user.uid);
        try {
            await setDoc(userDocRef, { name: name }, { merge: true });
            setUser(prevUser => ({ ...prevUser, name }));
            alert("Profile updated successfully!");
            setIsEditing(false);
        } catch (error) {
            alert(`Failed to update profile: ${error.message}`);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            alert("New passwords do not match.");
            return;
        }
        if (!currentPassword || !newPassword) {
            alert("All password fields are required.");
            return;
        }

        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            alert("No user is currently signed in.");
            return;
        }

        const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);

        try {
            await reauthenticateWithCredential(firebaseUser, credential);
            await updatePassword(firebaseUser, newPassword);
            alert("Password updated successfully!");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (error) {
            alert(`Failed to update password: ${error.message}`);
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">User Profile</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-700">Your Information</h2>
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full">
                                <Edit className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Full Name</label>
                            {isEditing ? (
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" />
                            ) : (
                                <p className="text-lg text-gray-800">{user.name}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Email Address</label>
                            <p className="text-lg text-gray-800">{user.email}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Assigned Facility</label>
                            <p className="text-lg text-gray-800">{user.facilityName}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Role</label>
                            <p className="text-lg text-gray-800">{user.role}</p>
                        </div>
                        {isEditing && (
                            <div className="flex justify-end space-x-2 pt-2">
                                <button type="button" onClick={() => { setIsEditing(false); setName(user.name); }} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Save</button>
                            </div>
                        )}
                    </form>
                </div>
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Change Password</h2>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Current Password</label>
                            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">New Password</label>
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                            <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                        <div className="text-right">
                            <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Update Password</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const UploadModal = ({ program, onClose, onFileUpload }) => {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [morbidityWeek, setMorbidityWeek] = useState(getMorbidityWeek());

    const handleFileChange = (e) => { if (e.target.files && e.target.files[0]) { setFile(e.target.files[0]); } };
    const handleDragEvents = (e, isDragging) => { e.preventDefault(); e.stopPropagation(); setDragging(isDragging); };
    const handleDrop = (e) => { handleDragEvents(e, false); if (e.dataTransfer.files && e.dataTransfer.files[0]) { setFile(e.dataTransfer.files[0]); } };
    const handleSubmit = () => { if (file) { onFileUpload(file, morbidityWeek); } };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative"><button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button><h2 className="text-xl font-bold text-gray-800 mb-2">Upload Report</h2><p className="text-gray-600 mb-4">Submitting for: <span className="font-semibold">{program.name}</span></p>
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Morbidity Week</label>
            <select value={morbidityWeek} onChange={e => setMorbidityWeek(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                {generateMorbidityWeeks().map(week => (
                    <option key={week} value={week}>{`Week ${week}`}</option>
                ))}
            </select>
        </div>
        <div onDragEnter={(e) => handleDragEvents(e, true)} onDragLeave={(e) => handleDragEvents(e, false)} onDragOver={(e) => handleDragEvents(e, true)} onDrop={handleDrop} className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragging ? 'border-primary bg-accent' : 'border-gray-300'}`}><Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" /><input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.mdb" /><label htmlFor="file-upload" className="font-medium text-primary hover:text-secondary cursor-pointer">Choose a file</label><p className="text-sm text-gray-500 mt-1">or drag and drop</p><p className="text-xs text-gray-400 mt-2">XLSX, CSV, PDF, PNG, JPG, MDB</p></div>{file && (<div className="mt-4 p-3 bg-gray-100 rounded-lg flex items-center justify-between"><div className="flex items-center"><FileText className="w-5 h-5 text-gray-500 mr-2" /><span className="text-sm text-gray-700">{file.name}</span></div><button onClick={() => setFile(null)} className="p-1 rounded-full hover:bg-gray-200"><X className="w-4 h-4 text-gray-500" /></button></div>)}<div className="mt-6 flex justify-end space-x-3"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={handleSubmit} disabled={!file} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400 disabled:cursor-not-allowed">Upload and Submit</button></div></div></div>
    );
};

const AnnouncementModal = ({ onClose, onSave, announcements, userRole, onDelete }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            alert("Title and message cannot be empty.");
            return;
        }
        onSave(title, message);
        setTitle('');
        setMessage('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Notifications</h2>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {announcements.map(ann => (
                        <div key={ann.id} className="bg-gray-50 p-4 rounded-lg relative">
                             <p className="font-bold">{ann.title}</p>
                             <p className="text-gray-700">{ann.message}</p>
                             <p className="text-xs mt-1 text-gray-500">Posted by {ann.author} on: {new Date(ann.timestamp?.toDate()).toLocaleString()}</p>
                             {userRole === 'Super Admin' && (
                                <button onClick={() => onDelete(ann.id)} className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                             )}
                        </div>
                    ))}
                    {announcements.length === 0 && <p className="text-center text-gray-500">No new announcements.</p>}
                </div>
                 {userRole === 'Super Admin' && (
                    <form onSubmit={handleSubmit} className="space-y-4 mt-6 border-t pt-4">
                        <h3 className="text-lg font-semibold">Create New Announcement</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Title</label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Message</label>
                            <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" rows="3" required></textarea>
                        </div>
                        <div className="text-right">
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Post Announcement</button>
                        </div>
                    </form>
                 )}
            </div>
        </div>
    );
};

const AuditLogPage = ({ db }) => {
    const [logs, setLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [db]);
    
    const filteredLogs = logs.filter(log =>
        Object.values(log).some(value =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <div className="space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Audit Log</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
                 <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredLogs.map(log => (
                                <tr key={log.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.timestamp?.toDate()).toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.userName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.userRole}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.action}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.details ? JSON.stringify(log.details) : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const DatabankPage = ({ user, submissions, programs, facilities, db }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProgram, setSelectedProgram] = useState('');
    const [selectedFacility, setSelectedFacility] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState('');

    const handleRequestDeletion = async (subId) => {
        if (window.confirm("Are you sure you want to request deletion for this submission? A Super Admin will need to approve it.")) {
            try {
                const subDocRef = doc(db, "submissions", subId);
                await updateDoc(subDocRef, {
                    deletionRequest: {
                        requestedBy: user.uid,
                        requestedByName: user.name,
                        timestamp: serverTimestamp()
                    }
                });
                alert("Deletion requested. Awaiting Super Admin approval.");
            } catch (error) {
                alert(`Error requesting deletion: ${error.message}`);
            }
        }
    };

    const filteredSubmissions = useMemo(() => {
        let subs = submissions.filter(s => s.confirmed && !s.deletionRequest); // Only show confirmed and not pending deletion

        // Role-based filtering
        if (user.role === 'PHO Admin') {
            const assignedProgramNames = programs
                .filter(p => user.assignedPrograms.includes(p.id))
                .map(p => p.name);
            subs = subs.filter(s => assignedProgramNames.includes(s.programName));
        } else if (user.role === 'Facility Admin' || user.role === 'Facility User') {
            subs = subs.filter(s => s.facilityName === user.facilityName);
        }

        // UI filters
        if (searchTerm) {
            subs = subs.filter(s => 
                s.programName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.uploaderName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (selectedProgram) {
            subs = subs.filter(s => s.programName === selectedProgram);
        }
        if (selectedFacility) {
            subs = subs.filter(s => s.facilityName === selectedFacility);
        }
        if (selectedYear) {
            subs = subs.filter(s => new Date(s.submissionDate).getFullYear() === selectedYear);
        }
        if (selectedMonth) {
            subs = subs.filter(s => (new Date(s.submissionDate).getMonth() + 1) === parseInt(selectedMonth));
        }
        
        return subs.sort((a,b) => new Date(b.submissionDate) - new Date(a.submissionDate));

    }, [user, submissions, programs, searchTerm, selectedProgram, selectedFacility, selectedYear, selectedMonth]);

    const programOptions = [...new Set(programs.map(p => p.name))].sort();
    const facilityOptions = [...new Set(facilities.map(f => f.name))].sort();
    const monthOptions = [
        { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' }, 
        { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' }, 
        { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' }, 
        { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Databank</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                    <input 
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg md:col-span-1"
                    />
                    <select value={selectedProgram} onChange={e => setSelectedProgram(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-white">
                        <option value="">All Programs</option>
                        {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {user.role !== 'Facility Admin' && user.role !== 'Facility User' && (
                        <select value={selectedFacility} onChange={e => setSelectedFacility(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-white">
                            <option value="">All Facilities</option>
                            {facilityOptions.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    )}
                     <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="w-full px-4 py-2 border rounded-lg bg-white">
                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                        <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                    </select>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-white">
                        <option value="">All Months</option>
                        {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredSubmissions.map(sub => (
                                <tr key={sub.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.programName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.facilityName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.uploaderName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center">
                                        {getFileIcon(sub.fileName)}
                                        <span className="ml-2">{sub.fileName}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(sub.submissionDate).toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                                        <a href={sub.fileURL} download={sub.fileName} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-secondary inline-block">
                                            <Download className="w-5 h-5"/>
                                        </a>
                                        {(user.role === 'Super Admin' || user.role === 'PHO Admin') && (
                                            <button onClick={() => handleRequestDeletion(sub.id)} className="text-red-600 hover:text-red-800 inline-block">
                                                <Trash2 className="w-5 h-5"/>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


const DeletionRequestsPage = ({ submissions, onApprove, onDeny }) => {
    const requests = submissions.filter(s => s.deletionRequest);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Deletion Requests</h1>
             <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Requested</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {requests.map(sub => (
                                <tr key={sub.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.programName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.facilityName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.deletionRequest.requestedByName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(sub.deletionRequest.timestamp?.toDate()).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                                        <button onClick={() => onDeny(sub.id)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"><Ban className="w-5 h-5"/></button>
                                        <button onClick={() => onApprove(sub.id)} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Check className="w-5 h-5"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}


// --- MAIN APP COMPONENT ---
export default function App() {
    const [user, setUser] = useState(null);
    const [page, setPage] = useState('dashboard');
    const [loading, setLoading] = useState(true);

    const [facilities, setFacilities] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [users, setUsers] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
    const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
    const [onlineStatuses, setOnlineStatuses] = useState({});
    
    const [showDeletionConfirmation, setShowDeletionConfirmation] = useState(false);
    const [deletionInfo, setDeletionInfo] = useState({ subId: null, action: null });

    const auth = getAuth(app);
    const db = getFirestore(app);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                     const userData = userDocSnap.data();
                     if (userData.isActive === false) {
                         alert("Your account has been deactivated. Please contact an administrator.");
                         signOut(auth);
                         return;
                     }

                     const permsDocRef = doc(db, "permissions", userData.role);
                     const permsDocSnap = await getDoc(permsDocRef);
                     
                     let permissions = {};
                     if (permsDocSnap.exists()) {
                         permissions = permsDocSnap.data();
                     }
                     // Super Admins always have all permissions
                     if (userData.role === 'Super Admin') {
                        permissions = { canManageUsers: true, canManageFacilities: true, canManagePrograms: true, canManagePermissions: true, canViewAuditLog: true, canExportData: true, canConfirmSubmissions: true };
                     }

                     setUser({ uid: firebaseUser.uid, ...userData, permissions });

                } else {
                    console.error("No user document found in Firestore for this authenticated user. Signing out.");
                    signOut(auth);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [auth, db]);

    useEffect(() => {
        if (!user) return;

        // Set up Realtime Database presence
        const myConnectionsRef = ref(rtdb, `status/${user.uid}`);
        const connectedRef = ref(rtdb, '.info/connected');
        
        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                set(myConnectionsRef, true);
                onDisconnect(myConnectionsRef).remove();
            }
        });

        // Listen for status changes
        const statusRef = ref(rtdb, 'status');
        onValue(statusRef, (snapshot) => {
            setOnlineStatuses(snapshot.val() || {});
        });


        const deleteOldAnnouncements = async () => {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const announcementsQuery = query(collection(db, "announcements"), where("timestamp", "<", sevenDaysAgo));
            const snapshot = await getDocs(announcementsQuery);

            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        };

        deleteOldAnnouncements();
    
        const unsubscribes = [
            onSnapshot(collection(db, "programs"), (snapshot) => {
                setPrograms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }),
            onSnapshot(collection(db, "users"), (snapshot) => {
                const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUsers(userList);
            }),
            onSnapshot(collection(db, "facilities"), (snapshot) => {
                setFacilities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }),
            onSnapshot(collection(db, "submissions"), (snapshot) => {
                setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }),
            onSnapshot(query(collection(db, "announcements"), orderBy("timestamp", "desc")), (snapshot) => {
                const announcementsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAnnouncements(announcementsData);
                
                const seenAnnouncements = JSON.parse(localStorage.getItem('seenAnnouncements') || '[]');
                const newUnreadCount = announcementsData.filter(ann => !seenAnnouncements.includes(ann.id)).length;
                setUnreadAnnouncements(newUnreadCount);
            }),
        ];
    
        return () => {
            unsubscribes.forEach(unsub => unsub());
            off(statusRef);
        }
    }, [user, db]);


    const handleLogin = (email, password) => {
        setLoading(true);
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                alert(error.message);
                setLoading(false);
            });
    };

    const handleLogout = () => {
        const userStatusRef = ref(rtdb, `status/${user.uid}`);
        set(userStatusRef, false);
        signOut(auth);
        setPage('dashboard');
    };

    const handleConfirmSubmission = async (submissionId) => {
        const subDocRef = doc(db, 'submissions', submissionId);
        await setDoc(subDocRef, { confirmed: true, status: 'Submitted' }, { merge: true });
        alert('Submission confirmed!');
    };
    
    const handleDenySubmission = async (submissionId) => {
        const subDocRef = doc(db, 'submissions', submissionId);
        await setDoc(subDocRef, { confirmed: false, status: 'Rejected' }, { merge: true });
        alert('Submission rejected.');
    };

    const handleAddAnnouncement = async (title, message) => {
        await addDoc(collection(db, "announcements"), {
            title,
            message,
            timestamp: serverTimestamp(),
            author: user.name,
        });
        await logAudit(db, user, "Create Announcement", { title });
    };
    
    const handleDeleteAnnouncement = async (announcementId) => {
        if (window.confirm("Are you sure you want to delete this announcement?")) {
            await deleteDoc(doc(db, "announcements", announcementId));
            await logAudit(db, user, "Delete Announcement", { announcementId });
        }
    };

    const handleDeletionConfirm = (subId, action) => {
        setDeletionInfo({ subId, action });
        setShowDeletionConfirmation(true);
    };
    
    const executeDeletion = async () => {
        if (deletionInfo.action === 'approve') {
            await handleApproveDeletion(deletionInfo.subId);
        } else if (deletionInfo.action === 'deny') {
            await handleDenyDeletion(deletionInfo.subId);
        }
        setShowDeletionConfirmation(false);
        setDeletionInfo({ subId: null, action: null });
    };

    const handleApproveDeletion = async (subId) => {
        const subDocRef = doc(db, "submissions", subId);
        const subDoc = await getDoc(subDocRef);
        if (subDoc.exists()) {
            const subData = subDoc.data();
            if (subData.fileURL) {
                const fileRef = storageRef(storage, subData.fileURL);
                try {
                    await deleteObject(fileRef);
                } catch (error) {
                    console.error("Error deleting file from storage:", error);
                    alert("Could not delete the file from storage, but the submission record will be removed.");
                }
            }
        }
        await deleteDoc(subDocRef);
        alert('Deletion approved and file removed.');
    };

    const handleDenyDeletion = async (subId) => {
        const subDocRef = doc(db, "submissions", subId);
        await updateDoc(subDocRef, {
            deletionRequest: null
        });
        alert('Deletion denied.');
    };

    const handleBellClick = () => {
        setShowAnnouncementsModal(true);
        const announcementIds = announcements.map(ann => ann.id);
        localStorage.setItem('seenAnnouncements', JSON.stringify(announcementIds));
        setUnreadAnnouncements(0);
    }

    if (loading) return <LoadingScreen />;
    if (!user) return <LoginScreen onLogin={handleLogin} />;

    const loggedInUserDetails = users.find(u => u.id === user.uid);
    const activePrograms = programs.filter(p => p.active !== false);
    
    const programsForUser = (user.role === 'PHO Admin' && loggedInUserDetails)
        ? activePrograms.filter(p => loggedInUserDetails.assignedPrograms.includes(p.id))
        : activePrograms;

    const renderPage = () => {
        switch(page) {
            case 'dashboard':
                if (user.role === 'Facility User') return <FacilityDashboard user={loggedInUserDetails} allPrograms={activePrograms} submissions={submissions} setSubmissions={setSubmissions} db={db} />;
                if (user.role === 'PHO Admin') return <PhoAdminDashboard user={user} programs={programs} submissions={submissions} users={users} onConfirm={handleConfirmSubmission} onDeny={handleDenySubmission} />;
                if (user.role === 'Facility Admin') return <FacilityAdminDashboard user={user} programs={programs} submissions={submissions} users={users} onlineStatuses={onlineStatuses}/>;
                return <AdminDashboard facilities={facilities} programs={programsForUser} submissions={submissions} users={users} onConfirm={handleConfirmSubmission} user={user} announcements={announcements} onAddAnnouncement={() => setShowAnnouncementsModal(true)} onDeleteAnnouncement={handleDeleteAnnouncement} onApproveDeletion={handleApproveDeletion} onDenyDeletion={handleDenyDeletion} onNavigate={setPage} />;
            case 'reports':
                if (user.permissions?.canExportData) return <ReportsPage programs={programsForUser} submissions={submissions} users={users} user={user} />;
                break;
            case 'databank':
                return <DatabankPage user={user} submissions={submissions} programs={programs} facilities={facilities} db={db} />;
                break;
            case 'facilities':
                if (user.permissions?.canManageFacilities) return <FacilityManagementPage user={user} facilities={facilities} db={db} />;
                break;
            case 'settings':
                if (user.permissions?.canManagePrograms || user.permissions?.canManagePermissions) return <SettingsPage programs={programs} user={user} db={db} />;
                break;
            case 'users':
                if (user.permissions?.canManageUsers) return <UserManagementPage users={users} setUsers={setUsers} facilities={facilities} programs={programs} currentUser={user} auth={auth} db={db} />;
                break;
            case 'submissions':
                 return <SubmissionsHistory user={user} submissions={submissions} setSubmissions={setSubmissions} db={db} />;
            case 'profile':
                return <ProfilePage user={user} auth={auth} db={db} setUser={setUser} />;
            case 'audit':
                if (user.permissions?.canViewAuditLog) return <AuditLogPage db={db} />;
                break;
            case 'deletion-requests':
                 if (user.role === 'Super Admin') return <DeletionRequestsPage submissions={submissions} onApprove={(subId) => handleDeletionConfirm(subId, 'approve')} onDeny={(subId) => handleDeletionConfirm(subId, 'deny')} />;
                 break;
            default:
                return <FacilityDashboard user={loggedInUserDetails} allPrograms={activePrograms} submissions={submissions} setSubmissions={setSubmissions} db={db} />;
        }
        return <div className="p-6"><h1 className="text-2xl font-bold text-red-600">Access Denied</h1><p>You do not have permission to view this page.</p></div>;
    };


    return (
        <div className="flex h-screen bg-background font-sans">
            <Sidebar user={user} onNavigate={setPage} onLogout={handleLogout} currentPage={page} />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header user={user} onLogout={handleLogout} unreadCount={unreadAnnouncements} onBellClick={handleBellClick} />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    {renderPage()}
                    <div className="h-20 md:hidden" />
                </div>
            </main>
            {showAnnouncementsModal && <AnnouncementModal onClose={() => setShowAnnouncementsModal(false)} onSave={handleAddAnnouncement} announcements={announcements} userRole={user.role} onDelete={handleDeleteAnnouncement} />}
            <ConfirmationModal 
                isOpen={showDeletionConfirmation}
                onClose={() => setShowDeletionConfirmation(false)}
                onConfirm={executeDeletion}
                title="Confirm Action"
                message="Are you sure you want to proceed with this action? This cannot be undone."
            />
        </div>
    );
};