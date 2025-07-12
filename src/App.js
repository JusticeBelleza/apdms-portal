import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Bell, AlertTriangle, CheckCircle2, Clock, Upload, FileText, User, LogOut, LayoutDashboard, ChevronDown, ChevronUp, Search, X, FileSpreadsheet, Printer, Settings, PlusCircle, Trash2, Edit, Users, Calendar, HelpCircle, Download, Building, FileClock } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs, getDoc, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp, orderBy, writeBatch } from "firebase/firestore";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID
};

if (!firebaseConfig.apiKey) {
    alert("Firebase API Key is missing. Please check your .env file and ensure REACT_APP_API_KEY is set.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);


// --- HELPER FUNCTIONS ---
const getStatusForProgram = (facilityName, program, submissions) => {
    const lastSubmission = submissions
        .filter(s => s.facilityName === facilityName && s.programName === program.name)
        .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate))[0];

    if (!lastSubmission) return { text: 'Pending', style: 'bg-yellow-100 text-yellow-800 border border-yellow-300', icon: <Clock className="w-4 h-4" />, isActionable: false };

    if (!lastSubmission.confirmed) {
        return { text: 'Pending Confirmation', style: 'bg-orange-100 text-orange-800 border border-orange-300', icon: <HelpCircle className="w-4 h-4" />, isActionable: true, submissionId: lastSubmission.id, fileURL: lastSubmission.fileURL };
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

const getMorbidityWeek = (d = new Date()) => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
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
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, role: ['Facility User', 'PHO Admin', 'Viewer', 'Super Admin', 'Facility Admin'] },
        { id: 'reports', label: 'Reports', icon: <FileSpreadsheet className="w-5 h-5" />, role: ['PHO Admin', 'Viewer', 'Super Admin', 'Facility Admin'] },
        { id: 'submissions', label: 'My Submissions', icon: <FileText className="w-5 h-5" />, role: ['Facility User'] },
        { id: 'users', label: 'Manage Users', icon: <Users className="w-5 h-5" />, role: ['Super Admin', 'Facility Admin'] },
        { id: 'facilities', label: 'Manage Facilities', icon: <Building className="w-5 h-5" />, role: ['Super Admin'] },
        { id: 'audit', label: 'Audit Log', icon: <FileClock className="w-5 h-5" />, role: ['Super Admin'] },
        { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" />, role: ['Super Admin'] },
        { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" />, role: ['Facility User', 'PHO Admin', 'Viewer', 'Super Admin', 'Facility Admin'] },
    ];
    const filteredNavItems = navItems.filter(item => item.role.includes(user.role));
    return (
        <aside className="hidden md:flex flex-col w-64 bg-gray-800 text-white"><div className="flex items-center justify-center h-20 border-b border-gray-700"><img src="https://placehold.co/40x40/1a202c/76e2d9?text=A" alt="Logo" className="w-10 h-10 rounded-full" /><h1 className="text-xl font-bold ml-2">APDMS</h1></div><nav className="flex-1 px-4 py-4 space-y-2">{filteredNavItems.map(item => (<button key={item.id} onClick={() => onNavigate(item.id)} className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${currentPage === item.id ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>{item.icon}<span className="ml-3">{item.label}</span></button>))}</nav><div className="px-4 py-4 border-t border-gray-700"><button onClick={onLogout} className="w-full flex items-center px-4 py-2 rounded-lg hover:bg-red-600 transition-colors duration-200"><LogOut className="w-5 h-5" /><span className="ml-3">Logout</span></button></div></aside>
    );
};

const Header = ({ user, onLogout, unreadCount, onBellClick }) => (
    <header className="flex items-center justify-between h-20 px-6 bg-white border-b">
        <div>
            <h2 className="text-lg font-semibold text-gray-800">Welcome, {user.name}!</h2>
            <p className="text-sm text-gray-500">{user.facilityName} - {user.role}</p>
            <div className="flex items-center text-xs text-gray-500 mt-1">
                <Calendar className="w-4 h-4 mr-1.5" />
                <span>Morbidity Week: {getMorbidityWeek()}</span>
            </div>
        </div>
        <div className="flex items-center space-x-4">
            <button onClick={onBellClick} className="relative p-2 rounded-full hover:bg-gray-200">
                <Bell className="w-6 h-6 text-gray-600" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                )}
            </button>
            <button onClick={onLogout} className="md:hidden p-2 rounded-full hover:bg-gray-200"><LogOut className="w-5 h-5 text-gray-600" /></button>
        </div>
    </header>
);

const FacilityDashboard = ({ user, allPrograms, submissions, setSubmissions, db }) => {
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);

    const handleUploadClick = (program) => { setSelectedProgram(program); setShowUploadModal(true); };

    const handleFileUpload = async (file, morbidityWeek) => {
        // This would involve uploading to Firebase Storage and then creating a doc in Firestore
        // For now, we'll just add to the local state to demonstrate the flow
        const newSubmission = {
            facilityName: user.facilityName,
            programName: selectedProgram.name,
            submissionDate: new Date().toISOString().split('T')[0],
            status: 'Pending Confirmation',
            fileURL: `/uploads/${file.name}`, // This would be the Firebase Storage URL
            confirmed: false,
            uploaderName: user.name,
            morbidityWeek: morbidityWeek,
        };

        await addDoc(collection(db, "submissions"), newSubmission);
        
        setShowUploadModal(false);
        setSelectedProgram(null);
        alert(`Proof for "${selectedProgram.name}" uploaded successfully for Morbidity Week ${morbidityWeek}. Pending PHO confirmation.`);
    };

    const userPrograms = allPrograms.filter(p => p.active && user.assignedPrograms.includes(p.id));

    return (
        <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800">Your Reporting Dashboard</h1><div className="bg-white p-6 rounded-lg shadow-md"><h2 className="text-xl font-semibold mb-4 text-gray-700">Reporting Obligations Checklist</h2><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{userPrograms.map(program => { const status = getStatusForProgram(user.facilityName, program, submissions); return (<tr key={program.id} className={status.text === 'Overdue' ? 'bg-red-50' : ''}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{program.name}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{program.frequency}</td><td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.style}`}>{status.icon}<span className="ml-1.5">{status.text}</span></span></td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{program.type === 'upload' ? (<button onClick={() => handleUploadClick(program)} className="text-primary hover:text-secondary flex items-center"><Upload className="w-4 h-4 mr-1"/> Upload Report</button>) : (<button onClick={() => handleUploadClick(program)} className="text-indigo-600 hover:text-indigo-900 flex items-center"><Upload className="w-4 h-4 mr-1"/> Upload Proof</button>)}</td></tr>);})}</tbody></table></div></div>{showUploadModal && <UploadModal program={selectedProgram} onClose={() => setShowUploadModal(false)} onFileUpload={handleFileUpload} />}</div>
    );
};

const AdminDashboard = ({ facilities, programs, submissions, users, isViewer = false, onConfirm, userRole, announcements, onAddAnnouncement, onDeleteAnnouncement }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedFacility, setExpandedFacility] = useState(null);
    const chartContainerRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(0);

    useEffect(() => {
        const handleResize = () => { if (chartContainerRef.current) { setChartWidth(chartContainerRef.current.offsetWidth); } };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const facilitiesByType = facilities.reduce((acc, facility) => {
        if (facility.name === 'Provincial Health Office') return acc;
        const type = facility.type || 'Uncategorized';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(facility);
        return acc;
    }, {});


    const complianceData = facilities.map(facility => {
        const facilityUser = users.find(u => u.facilityName === facility.name);
        const applicablePrograms = facilityUser ? programs.filter(p => facilityUser.assignedPrograms.includes(p.id)) : [];
        let submittedCount = applicablePrograms.filter(p => getStatusForProgram(facility.name, p, submissions).text === 'Submitted').length;
        return { name: facility.name, submitted: submittedCount, pending: applicablePrograms.length - submittedCount };
    });
    const overallStats = complianceData.reduce((acc, curr) => ({ totalSubmitted: acc.totalSubmitted + curr.submitted, totalPending: acc.totalPending + curr.pending }), { totalSubmitted: 0, totalPending: 0 });
    const totalExpectedReports = complianceData.reduce((acc, curr) => acc + curr.submitted + curr.pending, 0);
    const complianceRate = totalExpectedReports > 0 ? (overallStats.totalSubmitted / totalExpectedReports * 100).toFixed(1) : 0;
    const chartData = programs.map(p => {
        const totalApplicable = users.filter(u => u.role === 'Facility User' && u.assignedPrograms.includes(p.id)).length;
        const submittedCount = submissions.filter(s => s.programName === p.name && getStatusForProgram(s.facilityName, p, submissions).text === 'Submitted').length;
        return { name: p.name, Submitted: submittedCount, Pending: totalApplicable - submittedCount };
    });

    return (
        <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800">Provincial Compliance Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-teal-100"><CheckCircle2 className="w-6 h-6 text-primary" /></div><div className="ml-4"><p className="text-sm text-gray-500">Compliance Rate</p><p className="text-2xl font-bold text-gray-800">{complianceRate}%</p></div></div><div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-green-100"><FileText className="w-6 h-6 text-green-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Total Submitted</p><p className="text-2xl font-bold text-gray-800">{overallStats.totalSubmitted}</p></div></div><div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-yellow-100"><Clock className="w-6 h-6 text-yellow-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Total Pending/Overdue</p><p className="text-2xl font-bold text-gray-800">{overallStats.totalPending}</p></div></div><div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-blue-100"><User className="w-6 h-6 text-blue-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Reporting Facilities</p><p className="text-2xl font-bold text-gray-800">{facilities.length}</p></div></div></div><div className="bg-white p-6 rounded-lg shadow-md"><h2 className="text-xl font-semibold mb-4 text-gray-700">Compliance by Program</h2><div ref={chartContainerRef} style={{ width: '100%', height: 300 }}><BarChart width={chartWidth} height={300} data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="Submitted" stackId="a" fill="#14b8a6" /><Bar dataKey="Pending" stackId="a" fill="#f59e0b" /></BarChart></div></div><div className="bg-white p-6 rounded-lg shadow-md"><h2 className="text-xl font-semibold mb-4 text-gray-700">Facility Submission Status</h2><div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /><input type="text" placeholder="Search for a facility..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"/></div>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {Object.keys(facilitiesByType).sort().map(type => (
                <div key={type}>
                    <h3 className="text-sm font-semibold italic text-gray-500 mb-2">{type}</h3>
                    <div className="space-y-2">
                        {facilitiesByType[type].filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).map(facility => (
                            <div key={facility.id} className="border rounded-lg">
                                <button onClick={() => setExpandedFacility(expandedFacility === facility.name ? null : facility.name)} className="w-full flex justify-between items-center p-4 text-left">
                                    <span className="font-medium text-gray-800">{facility.name}</span>
                                    {expandedFacility === facility.name ? <ChevronUp /> : <ChevronDown />}
                                </button>
                                {expandedFacility === facility.name && (
                                    <div className="p-4 border-t bg-gray-50">
                                        <ul className="space-y-2">
                                            {programs.filter(p => (users.find(u => u.facilityName === facility.name)?.assignedPrograms || []).includes(p.id)).map(program => {
                                                const status = getStatusForProgram(facility.name, program, submissions);
                                                return (
                                                    <li key={program.id} className={`flex justify-between items-center text-sm p-2 rounded-md ${status.text === 'Overdue' ? 'bg-red-50' : ''}`}>
                                                        <span>{program.name}</span>
                                                        <div className="flex items-center space-x-2">
                                                            {status.isActionable && <a href={status.fileURL} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">View Proof</a>}
                                                            {status.isActionable && !isViewer && <button onClick={() => onConfirm(status.submissionId)} className="text-sm bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">Confirm</button>}
                                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.style}`}>{status.icon}<span className="ml-1.5">{status.text}</span></span>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div></div>
    );
};

const ReportsPage = ({ programs, submissions, users }) => {
    const [reportType, setReportType] = useState('Quarterly');
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarter, setQuarter] = useState(1);
    const [selectedProgramId, setSelectedProgramId] = useState('');
    const [generatedReport, setGeneratedReport] = useState(null);

    useEffect(() => {
        if (programs.length > 0 && !selectedProgramId) {
            setSelectedProgramId(programs[0].id);
        }
    }, [programs, selectedProgramId]);

    const handleGenerateReport = () => {
        const selectedProgram = programs.find(p => p.id === selectedProgramId);
        if (!selectedProgram) {
            alert("Please select a program to generate a report.");
            return;
        }

        const programName = selectedProgram.name;
        const programId = selectedProgram.id;
        
        const facilitiesForReport = [...new Set(users
            .filter(u => u.assignedPrograms.includes(programId))
            .map(u => u.facilityName)
        )];

        let startDate, endDate;
        let title = '';
        if (reportType === 'Quarterly') {
            const startMonth = (quarter - 1) * 3;
            startDate = new Date(year, startMonth, 1);
            endDate = new Date(year, startMonth + 3, 0);
            title = `Quarterly ${programName} Report - Q${quarter} ${year}`;
        } else {
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
            title = `Annual ${programName} Report - ${year}`;
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
        <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800">Report Generation</h1><div className="bg-white p-6 rounded-lg shadow-md print:hidden"><h2 className="text-xl font-semibold mb-4 text-gray-700">Consolidated Program Report</h2><div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
                <label className="block text-sm font-medium text-gray-700">Health Program</label>
                <select value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                    <option value="">Select a Program</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
        <div><label className="block text-sm font-medium text-gray-700">Report Type</label><select value={reportType} onChange={e => setReportType(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"><option>Quarterly</option><option>Annual</option></select></div><div><label className="block text-sm font-medium text-gray-700">Year</label><select value={year} onChange={e => setYear(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"><option>{new Date().getFullYear()}</option><option>{new Date().getFullYear() - 1}</option></select></div>{reportType === 'Quarterly' && (<div><label className="block text-sm font-medium text-gray-700">Quarter</label><select value={quarter} onChange={e => setQuarter(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"><option value={1}>Q1 (Jan-Mar)</option><option value={2}>Q2 (Apr-Jun)</option><option value={3}>Q3 (Jul-Sep)</option><option value={4}>Q4 (Oct-Dec)</option></select></div>)}<button onClick={handleGenerateReport} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300 h-10">Generate Report</button></div></div>{generatedReport && (<div id="report-view" className="bg-white p-8 rounded-lg shadow-md"><div className="flex justify-between items-start"><div><h2 className="text-2xl font-bold text-gray-900">{generatedReport.title}</h2><p className="text-sm text-gray-500">Reporting Period: {generatedReport.period}</p><p className="text-sm text-gray-500">Generated on: {new Date().toLocaleDateString()}</p></div><button onClick={() => window.print()} className="print:hidden flex items-center bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded-lg transition duration-300"><Printer className="w-4 h-4 mr-2" />Print / Save as PDF</button></div><hr className="my-6" /><div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"><div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Total Cases</p><p className="text-3xl font-bold text-primary">{generatedReport.totalCases}</p></div><div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Reporting Facilities</p><p className="text-3xl font-bold text-primary">{generatedReport.reportingFacilities}</p></div><div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Compliance Rate</p><p className="text-3xl font-bold text-primary">{generatedReport.totalFacilities > 0 ? ((generatedReport.reportingFacilities / generatedReport.totalFacilities) * 100).toFixed(1) : 0}%</p></div></div><h3 className="text-lg font-semibold mb-4 text-gray-700">Breakdown by Facility</h3><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 border"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submissions Made</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cases Reported</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{generatedReport.breakdown.map(item => (<tr key={item.facilityName}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.facilityName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.submissionsCount}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-bold">{item.totalCases}</td></tr>))}</tbody></table></div></div>)}</div>
    );
};

const SettingsPage = ({ programs, userRole, db }) => {
    const [newProgramName, setNewProgramName] = useState('');
    const [newProgramFreq, setNewProgramFreq] = useState('Monthly');
    const [newProgramType, setNewProgramType] = useState('upload');
    const isSuperAdmin = userRole === 'Super Admin';

    const handleAddProgram = async (e) => {
        e.preventDefault();
        if (!newProgramName) {
            alert('Program name cannot be empty.');
            return;
        }
        const newProgram = {
            id: newProgramName.toLowerCase().replace(/\s+/g, '-'),
            name: newProgramName,
            frequency: newProgramFreq,
            type: newProgramType,
            active: true,
            core: false
        };
        
        await setDoc(doc(db, "programs", newProgram.id), newProgram);
        setNewProgramName('');
    };
    
    const handleToggleProgram = async (programId, active) => {
        if (!isSuperAdmin) return;
        const programDocRef = doc(db, 'programs', programId);
        await setDoc(programDocRef, { active: !active }, { merge: true });
    };

    const handleDeleteProgram = async (programId) => {
        if (isSuperAdmin && window.confirm('Are you sure you want to delete this program? This cannot be undone.')) {
            await deleteDoc(doc(db, "programs", programId));
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-3">Manage Health Programs</h2>
                <div className="mt-4">
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Activate or Deactivate Programs</h3>
                    <div className="space-y-2">
                        {programs.map(program => (
                            <div key={program.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                                <div>
                                    <p className="font-semibold">{program.name}</p>
                                    <p className="text-sm text-gray-500">Frequency: {program.frequency} | Type: {program.type}</p>
                                </div>
                                <div className="flex items-center space-x-4">
                                    {isSuperAdmin && !program.core && (
                                        <button onClick={() => handleDeleteProgram(program.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-full">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <label htmlFor={`toggle-${program.id}`} className={`flex items-center ${isSuperAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                                        <div className="relative">
                                            <input type="checkbox" id={`toggle-${program.id}`} className="sr-only" checked={program.active} onChange={() => handleToggleProgram(program.id, program.active)} disabled={!isSuperAdmin}/>
                                            <div className={`block w-12 h-6 rounded-full ${program.active ? 'bg-blue-500' : 'bg-red-500'} ${!isSuperAdmin ? 'opacity-50' : ''}`}></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${program.active ? 'transform translate-x-6' : ''}`}></div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                 {isSuperAdmin && (
                    <div className="mt-8 border-t pt-6">
                        <h3 className="text-lg font-medium text-gray-800 mb-2">Add New Program</h3>
                        <form onSubmit={handleAddProgram} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Program Name</label>
                                <input type="text" value={newProgramName} onChange={e => setNewProgramName(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" placeholder="e.g., Dengue Surveillance" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-sm font-medium text-gray-700">Frequency</label>
                                    <select value={newProgramFreq} onChange={e => setNewProgramFreq(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                                        <option>Weekly</option>
                                        <option>Monthly</option>
                                        <option>Quarterly</option>
                                    </select>
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium text-gray-700">Submission Type</label>
                                    <select value={newProgramType} onChange={e => setNewProgramType(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                                        <option value="upload">File Upload</option>
                                        <option value="external">Mark as Submitted</option>
                                    </select>
                                </div>
                            </div>
                            <div className="text-right">
                                 <button type="submit" className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300"><PlusCircle className="w-5 h-5 mr-2"/>Add Program</button>
                            </div>
                        </form>
                    </div>
                 )}
            </div>
        </div>
    );
};

const FacilityManagementPage = ({ facilities, db, userRole }) => {
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
        if (userRole === 'Super Admin' && window.confirm('Are you sure you want to delete this facility? All associated users and submissions will be affected.')) {
            try {
                // In a real application, you would also need to delete/update associated users and submissions
                // For simplicity, this example only deletes the facility document.
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
                <h1 className="text-3xl font-bold text-gray-800">Manage Facilities</h1>
                {userRole === 'Super Admin' && (
                    <div className="flex space-x-2">
                        <button onClick={handleExport} className="inline-flex items-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                            <Download className="w-5 h-5 mr-2" />
                            Export to CSV
                        </button>
                        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                            <PlusCircle className="w-5 h-5 mr-2" />
                            Add Facility
                        </button>
                    </div>
                )}
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
                                {userRole === 'Super Admin' && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedFacilities.map(facility => (
                                <tr key={facility.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{facility.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{facility.type}</td>
                                    {userRole === 'Super Admin' && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleDeleteFacility(facility.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full inline-flex items-center">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
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
    const isFacilityAdmin = currentUser.role === 'Facility Admin';
    
    const phoUsers = [...users]
        .filter(u => u.facilityName === 'Provincial Health Office' && u.role !== 'Super Admin')
        .sort((a,b) => a.name.localeCompare(b.name));

    const facilityUsers = [...users]
        .filter(u => u.facilityName !== 'Provincial Health Office')
        .sort((a,b) => a.facilityName.localeCompare(b.facilityName) || a.name.localeCompare(b.name)) // Sort by facility name, then user name
        .reduce((acc, user) => {
            const { facilityName } = user;
            if (!acc[facilityName]) {
                acc[facilityName] = [];
            }
            acc[facilityName].push(user);
            return acc;
        }, {});


    const handleAddUser = async (newUser) => {
        try {
            const tempAuth = getAuth(initializeApp(firebaseConfig, 'secondary'));
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

    const handleDeleteUser = async (userId) => {
        if (window.confirm('Are you sure you want to delete this user? This is a permanent action.')) {
            await deleteDoc(doc(db, "users", userId));
            await logAudit(db, currentUser, "Delete User", { targetUserId: userId });
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

    const UserRow = ({user}) => (
        <div className="grid grid-cols-5 gap-4 py-3 px-4 items-center">
            <div className="col-span-1">
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <p className="col-span-1 text-sm text-gray-600">{user.facilityName}</p>
            <p className="col-span-1 text-sm text-gray-600">{user.role}</p>
            <div className="col-span-2 text-right flex items-center justify-end space-x-2">
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
                <button onClick={() => openEditModal(user)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit className="w-4 h-4"/></button>
                {user.id !== currentUser.id && (isSuperAdmin || isFacilityAdmin) && (
                    <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 className="w-4 h-4"/></button>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Manage Users</h1>
                <div className="flex space-x-2">
                    {isSuperAdmin && (
                        <button onClick={handleExport} className="inline-flex items-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                            <Download className="w-5 h-5 mr-2" />
                            Export Users
                        </button>
                    )}
                    {isSuperAdmin && (
                        <button onClick={() => setShowAddFacilityAdminModal(true)} className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                            <Building className="w-5 h-5 mr-2"/>
                            Add Facility Admin
                        </button>
                    )}
                    <button onClick={() => setShowAddModal(true)} className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                        <PlusCircle className="w-5 h-5 mr-2"/>
                        Add User
                    </button>
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">PHO Accounts</h3>
                <div className="divide-y divide-gray-200 border rounded-lg">
                    {phoUsers.map(user => <UserRow key={user.id} user={user} />)}
                </div>

                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Facility Accounts</h3>
                <div className="space-y-2">
                    {Object.keys(facilityUsers).sort().map(facilityName => (
                        <div key={facilityName} className="border rounded-lg">
                            <button onClick={() => setExpandedFacility(expandedFacility === facilityName ? null : facilityName)} className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-50">
                                <span className="font-medium text-gray-800">{facilityName}</span>
                                {expandedFacility === facilityName ? <ChevronUp /> : <ChevronDown />}
                            </button>
                            {expandedFacility === facilityName && (
                                <div className="p-4 border-t bg-gray-50 divide-y divide-gray-200">
                                    {facilityUsers[facilityName].map(user => <UserRow key={user.id} user={user} />)}
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
        <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800">Your Submission History</h1><div className="bg-white p-6 rounded-lg shadow-md"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Morbidity Week</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{userSubmissions.length > 0 ? userSubmissions.map(sub => (<tr key={sub.id}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.programName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.submissionDate}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.morbidityWeek}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.uploaderName}</td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">{sub.fileURL && <a href={sub.fileURL} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-100 rounded-full inline-flex items-center"><Download className="w-4 h-4"/></a>}{!sub.confirmed && (<button onClick={() => handleDeleteSubmission(sub.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full inline-flex items-center"><Trash2 className="w-4 h-4"/></button>)}</td></tr>)) : (<tr><td colSpan="5" className="text-center py-10 text-gray-500">No submissions found.</td></tr>)}</tbody></table></div></div></div>
    );
};

const UserFormModal = ({ title, user, onClose, onSave, facilities, programs, currentUser, auth, db }) => {
    const isSuperAdmin = currentUser.role === 'Super Admin';

    const [formData, setFormData] = useState({
        id: user?.id || null,
        name: user?.name || '',
        email: user?.email || '',
        password: '',
        confirmPassword: '',
        facilityName: isSuperAdmin ? "Provincial Health Office" : currentUser.facilityName,
        role: user?.role || (isSuperAdmin ? 'PHO Admin' : 'Facility User'),
        assignedPrograms: user?.assignedPrograms || []
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
        onSave(formData)
    };

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
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" placeholder={user ? "Leave blank to keep current" : "Set initial password"} required={!user} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                        <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" placeholder="Confirm password" required={!user || formData.password} />
                    </div>
                    {currentUser.role === 'Facility Admin' && (
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Facility</label>
                            <input type="text" name="facilityName" value={formData.facilityName} disabled className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm bg-gray-100" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Role</label>
                        <select name="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                            {isSuperAdmin ? <>
                                <option>PHO Admin</option>
                                <option>Viewer</option>
                            </> : <option>Facility User</option>}
                        </select>
                    </div>
                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Health Programs</label>
                        <div className="space-y-2">
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


const Profile = ({ user }) => (
    <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800">User Profile</h1><div className="bg-white p-8 rounded-lg shadow-md max-w-lg"><div className="space-y-4"><div><label className="block text-sm font-medium text-gray-500">Full Name</label><p className="text-lg text-gray-800">{user.name}</p></div><div><label className="block text-sm font-medium text-gray-500">Email Address</label><p className="text-lg text-gray-800">{user.email}</p></div><div><label className="block text-sm font-medium text-gray-500">Assigned Facility</label><p className="text-lg text-gray-800">{user.facilityName}</p></div><div><label className="block text-sm font-medium text-gray-500">Role</label><p className="text-lg text-gray-800">{user.role}</p></div></div><button className="mt-6 w-full bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300">Edit Profile (Not Implemented)</button></div></div>
);

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

    useEffect(() => {
        const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [db]);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Audit Log</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
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
                            {logs.map(log => (
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
    
    const auth = getAuth(app);
    const db = getFirestore(app);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const docSnap = await getDoc(userDocRef);

                if (docSnap.exists()) {
                     const userData = docSnap.data();
                     if (userData.isActive === false) {
                         alert("Your account has been deactivated. Please contact an administrator.");
                         signOut(auth);
                     } else {
                         setUser({ uid: firebaseUser.uid, ...userData });
                     }
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
    
        return () => unsubscribes.forEach(unsub => unsub());
    }, [user, db]);


    const handleLogin = (email, password) => {
        setLoading(true);
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                alert(error.message);
            })
            .finally(() => setLoading(false));
    };

    const handleLogout = () => {
        signOut(auth);
        setPage('dashboard');
    };

    const handleConfirmSubmission = async (submissionId) => {
        const subDocRef = doc(db, 'submissions', submissionId);
        await setDoc(subDocRef, { confirmed: true, status: 'Submitted' }, { merge: true });
        alert('Submission confirmed!');
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

    const handleBellClick = () => {
        setShowAnnouncementsModal(true);
        const announcementIds = announcements.map(ann => ann.id);
        localStorage.setItem('seenAnnouncements', JSON.stringify(announcementIds));
        setUnreadAnnouncements(0);
    }

    if (loading) return <LoadingScreen />;
    if (!user) return <LoginScreen onLogin={handleLogin} />;

    const loggedInUserDetails = users.find(u => u.id === user.uid);
    const activePrograms = programs.filter(p => p.active);
    
    const programsForUser = (user.role === 'PHO Admin' && loggedInUserDetails)
        ? activePrograms.filter(p => loggedInUserDetails.assignedPrograms.includes(p.id))
        : activePrograms;

    return (
        <div className="flex h-screen bg-background font-sans">
            <Sidebar user={user} onNavigate={setPage} onLogout={handleLogout} currentPage={page} />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header user={user} onLogout={handleLogout} unreadCount={unreadAnnouncements} onBellClick={handleBellClick} />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    {page === 'dashboard' && user.role === 'Facility User' && <FacilityDashboard user={loggedInUserDetails} allPrograms={programs} submissions={submissions} setSubmissions={setSubmissions} db={db} />}
                    {page === 'dashboard' && (user.role === 'PHO Admin' || user.role === 'Super Admin' || user.role === 'Facility Admin') && <AdminDashboard facilities={facilities} programs={programsForUser} submissions={submissions} users={users} onConfirm={handleConfirmSubmission} userRole={user.role} announcements={announcements} onAddAnnouncement={() => setShowAnnouncementsModal(true)} onDeleteAnnouncement={handleDeleteAnnouncement} />}
                    {page === 'dashboard' && user.role === 'Viewer' && <AdminDashboard facilities={facilities} programs={programsForUser} submissions={submissions} users={users} isViewer={true} announcements={announcements} />}
                    {page === 'reports' && (user.role === 'PHO Admin' || user.role === 'Viewer' || user.role === 'Super Admin' || user.role === 'Facility Admin') && <ReportsPage programs={programsForUser} submissions={submissions} users={users} />}
                    {page === 'facilities' && user.role === 'Super Admin' && <FacilityManagementPage facilities={facilities} db={db} userRole={user.role} />}
                    {page === 'settings' && user.role === 'Super Admin' && <SettingsPage programs={programs} setPrograms={setPrograms} userRole={user.role} db={db} />}
                    {page === 'users' && (user.role === 'Super Admin' || user.role === 'Facility Admin') && <UserManagementPage users={users} setUsers={setUsers} facilities={facilities} programs={programs} currentUser={loggedInUserDetails} auth={auth} db={db} />}
                    {page === 'submissions' && <SubmissionsHistory user={user} submissions={submissions} setSubmissions={setSubmissions} db={db} />}
                    {page === 'profile' && <Profile user={user} />}
                    {page === 'audit' && user.role === 'Super Admin' && <AuditLogPage db={db} />}
                </div>
            </main>
            {showAnnouncementsModal && <AnnouncementModal onClose={() => setShowAnnouncementsModal(false)} onSave={handleAddAnnouncement} announcements={announcements} userRole={user.role} onDelete={handleDeleteAnnouncement} />}
        </div>
    );
};