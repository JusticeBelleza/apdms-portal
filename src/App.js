import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, Upload, FileText, User, LogOut, LayoutDashboard, ChevronDown, ChevronUp, Search, X, FileSpreadsheet, Printer, Settings, PlusCircle, Trash2, Edit, Users, Calendar, HelpCircle } from 'lucide-react';

// --- MOCK DATA & INITIAL STATE ---
// This data would come from an API in a real application.

const INITIAL_FACILITIES = [
    "Bangued RHU", "Boliney RHU", "Bucay RHU", "Bucloc RHU", "Daguioman RHU", 
    "Danglas RHU", "Dolores RHU", "La Paz RHU", "Lacub RHU", "Lagangilang RHU", 
    "Lagayan RHU", "Langiden RHU", "Licuan-Baay RHU", "Luba RHU", "Malibcong RHU", 
    "Manabo RHU", "Peñarrubia RHU", "Pilar RHU", "Sallapadan RHU", "San Isidro RHU", 
    "San Juan RHU", "San Quintin RHU", "Tayum RHU", "Tineg RHU", "Tubo RHU", 
    "Villaviciosa RHU", "Abra Provincial Hospital", "ASSC Hospital", "La Paz District Hospital",
    "St. Theresa Wellness Center", "Valera Medical Hospital", "Dr. Petronilo V. Seares Sr. Memorial Hospital",
    "Bangued Christian Hospital", "Saint Jude Medical Clinic", "Family Care Clinic", "United Doctors Clinic", "Bangued General Hospital"
];

const INITIAL_USERS = [
    { id: 1, name: 'Admin', email: 'admin@pho.gov.ph', facilityName: 'Provincial Health Office', role: 'PHO Admin', password: 'password', assignedPrograms: ['pidsr', 'rabies'] },
    { id: 2, name: 'Juan Dela Cruz', email: 'juan.delacruz@banguedrhu.gov.ph', facilityName: 'Bangued RHU', role: 'Facility User', password: 'password', assignedPrograms: ['pidsr', 'rabies'] },
    { id: 3, name: 'Maria Clara', email: 'maria.clara@tayumrhu.gov.ph', facilityName: 'Tayum RHU', role: 'Facility User', password: 'password', assignedPrograms: ['pidsr', 'rabies'] }
];

const INITIAL_PROGRAMS = [
    { id: 'pidsr', name: 'PIDSR Program', frequency: 'Weekly', type: 'external', active: true, core: true },
    { id: 'rabies', name: 'Rabies Program', frequency: 'Monthly', type: 'upload', active: true, core: true },
];

const generateMockSubmissions = (facilities, programs) => {
    let submissions = [];
    const today = new Date();
    facilities.forEach(facility => {
        programs.forEach(program => {
            for (let i = 0; i < 12; i++) {
                 if (Math.random() > 0.2) {
                    const submissionDate = new Date(today.getFullYear(), today.getMonth() - i, Math.floor(Math.random() * 28) + 1);
                    submissions.push({
                        id: `${facility}-${program.id}-${submissionDate.getTime()}`,
                        facilityName: facility,
                        programName: program.name,
                        submissionDate: submissionDate.toISOString().split('T')[0],
                        status: 'Submitted',
                        confirmed: true, // All mock submissions are confirmed
                        fileURL: program.type === 'upload' ? `/uploads/mock-report-${Math.floor(Math.random() * 100)}.xlsx` : null,
                        data: { cases: Math.floor(Math.random() * 10) }
                    });
                }
            }
        });
    });
    return submissions;
};

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

// --- MAIN APP COMPONENT ---

export default function App() {
    const [user, setUser] = useState(null);
    const [page, setPage] = useState('dashboard');
    const [loading, setLoading] = useState(true);

    const [facilities, setFacilities] = useState(INITIAL_FACILITIES);
    const [programs, setPrograms] = useState(INITIAL_PROGRAMS);
    const [users, setUsers] = useState(INITIAL_USERS);
    const [submissions, setSubmissions] = useState(() => generateMockSubmissions(INITIAL_FACILITIES, INITIAL_PROGRAMS));

    useEffect(() => {
        setTimeout(() => setLoading(false), 1500);
    }, []);

    const handleLogin = (email, password) => {
        setLoading(true);
        setTimeout(() => {
            const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
            if (foundUser) {
                setUser(foundUser);
            } else {
                alert("Invalid credentials.");
            }
            setLoading(false);
        }, 1000);
    };

    const handleLogout = () => {
        setUser(null);
        setPage('dashboard');
    };

    const handleConfirmSubmission = (submissionId) => {
        setSubmissions(prev =>
            prev.map(sub =>
                sub.id === submissionId ? { ...sub, confirmed: true, status: 'Submitted' } : sub
            )
        );
        alert('Submission confirmed!');
    };

    const activePrograms = programs.filter(p => p.active);
    const loggedInUserDetails = users.find(u => u.id === user?.id);

    if (loading) return <LoadingScreen />;
    if (!user) return <LoginScreen onLogin={handleLogin} />;

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <Sidebar user={user} onNavigate={setPage} onLogout={handleLogout} currentPage={page} />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header user={user} onLogout={handleLogout} />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    {page === 'dashboard' && user.role === 'Facility User' && <FacilityDashboard user={loggedInUserDetails} allPrograms={programs} submissions={submissions} setSubmissions={setSubmissions} />}
                    {page === 'dashboard' && user.role === 'PHO Admin' && <AdminDashboard facilities={facilities} programs={activePrograms} submissions={submissions} users={users} onConfirm={handleConfirmSubmission} />}
                    {page === 'dashboard' && user.role === 'Viewer' && <AdminDashboard facilities={facilities} programs={activePrograms} submissions={submissions} users={users} isViewer={true} />}
                    {page === 'reports' && (user.role === 'PHO Admin' || user.role === 'Viewer') && <ReportsPage programs={activePrograms} submissions={submissions} users={users} />}
                    {page === 'settings' && user.role === 'PHO Admin' && <SettingsPage programs={programs} setPrograms={setPrograms} />}
                    {page === 'users' && user.role === 'PHO Admin' && <UserManagementPage users={users} setUsers={setUsers} facilities={facilities} programs={programs} />}
                    {page === 'submissions' && <SubmissionsHistory user={user} submissions={submissions} />}
                    {page === 'profile' && <Profile user={user} />}
                </div>
            </main>
        </div>
    );
}

// --- SCREEN & LAYOUT COMPONENTS ---

const LoadingScreen = () => (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><div className="text-center"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-teal-400 mx-auto"></div><h1 className="text-3xl font-bold mt-4">APDMS</h1><p className="text-lg text-gray-300">Abra PHO Disease Data Management System</p><p className="mt-2 text-teal-400">Loading Application...</p></div></div>
);

const LoginScreen = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); onLogin(email, password); };
    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4"><div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8"><div className="text-center mb-8"><img src="https://placehold.co/100x100/1a202c/76e2d9?text=APDMS" alt="APDMS Logo" className="w-24 h-24 mx-auto rounded-full mb-4 border-4 border-teal-400" /><h1 className="text-3xl font-bold text-white">APDMS Portal</h1><p className="text-gray-400">Abra PHO Disease Data Management System</p></div><form onSubmit={handleSubmit} className="space-y-6"><div><label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="e.g., admin@pho.gov.ph" required /></div><div><label className="block text-sm font-medium text-gray-300 mb-1">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="************" required /></div><button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105">Secure Login</button></form><div className="text-center mt-4 text-xs text-gray-500"><p>Use a valid email and 'password' to log in.</p></div></div><p className="text-center text-gray-500 text-xs mt-8">&copy;2025 Abra Provincial Health Office. All rights reserved.</p></div>
    );
};

const Sidebar = ({ user, onNavigate, onLogout, currentPage }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, role: ['Facility User', 'PHO Admin', 'Viewer'] },
        { id: 'reports', label: 'Reports', icon: <FileSpreadsheet className="w-5 h-5" />, role: ['PHO Admin', 'Viewer'] },
        { id: 'submissions', label: 'My Submissions', icon: <FileText className="w-5 h-5" />, role: ['Facility User'] },
        { id: 'users', label: 'Manage Users', icon: <Users className="w-5 h-5" />, role: ['PHO Admin'] },
        { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" />, role: ['PHO Admin'] },
        { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" />, role: ['Facility User', 'PHO Admin', 'Viewer'] },
    ];
    const filteredNavItems = navItems.filter(item => item.role.includes(user.role));
    return (
        <aside className="hidden md:flex flex-col w-64 bg-gray-800 text-white"><div className="flex items-center justify-center h-20 border-b border-gray-700"><img src="https://placehold.co/40x40/1a202c/76e2d9?text=A" alt="Logo" className="w-10 h-10 rounded-full" /><h1 className="text-xl font-bold ml-2">APDMS</h1></div><nav className="flex-1 px-4 py-4 space-y-2">{filteredNavItems.map(item => (<a key={item.id} href="#" onClick={(e) => { e.preventDefault(); onNavigate(item.id); }} className={`flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${currentPage === item.id ? 'bg-teal-600 text-white' : 'hover:bg-gray-700'}`}>{item.icon}<span className="ml-3">{item.label}</span></a>))}</nav><div className="px-4 py-4 border-t border-gray-700"><a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }} className="flex items-center px-4 py-2 rounded-lg hover:bg-red-600 transition-colors duration-200"><LogOut className="w-5 h-5" /><span className="ml-3">Logout</span></a></div></aside>
    );
};

const Header = ({ user, onLogout }) => (
    <header className="flex items-center justify-between h-20 px-6 bg-white border-b">
        <div>
            <h2 className="text-lg font-semibold text-gray-800">Welcome, {user.name}!</h2>
            <p className="text-sm text-gray-500">{user.facilityName} - {user.role}</p>
            <div className="flex items-center text-xs text-gray-500 mt-1">
                <Calendar className="w-4 h-4 mr-1.5" />
                <span>Morbidity Week: {getMorbidityWeek()}</span>
            </div>
        </div>
        <div className="flex items-center">
             <button onClick={onLogout} className="md:hidden p-2 rounded-full hover:bg-gray-200"><LogOut className="w-5 h-5 text-gray-600" /></button>
        </div>
    </header>
);

// --- PAGE COMPONENTS ---

const FacilityDashboard = ({ user, allPrograms, submissions, setSubmissions }) => {
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);

    const handleUploadClick = (program) => { setSelectedProgram(program); setShowUploadModal(true); };
    
    const handleFileUpload = (file) => {
        const newSubmission = { 
            id: `${user.facilityName}-${selectedProgram.id}-${new Date().getTime()}`, 
            facilityName: user.facilityName, 
            programName: selectedProgram.name, 
            submissionDate: new Date().toISOString().split('T')[0], 
            status: 'Pending Confirmation', 
            fileURL: `/uploads/${file.name}`,
            confirmed: false
        };
        setSubmissions(prev => [...prev, newSubmission]);
        setShowUploadModal(false);
        setSelectedProgram(null);
        alert(`Proof for "${selectedProgram.name}" uploaded successfully. Pending PHO confirmation.`);
    };

    const userPrograms = allPrograms.filter(p => p.active && user.assignedPrograms.includes(p.id));

    return (
        <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800">Your Reporting Dashboard</h1><div className="bg-white p-6 rounded-lg shadow-md"><h2 className="text-xl font-semibold mb-4 text-gray-700">Reporting Obligations Checklist</h2><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{userPrograms.map(program => { const status = getStatusForProgram(user.facilityName, program, submissions); return (<tr key={program.id} className={status.text === 'Overdue' ? 'bg-red-50' : ''}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{program.name}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{program.frequency}</td><td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.style}`}>{status.icon}<span className="ml-1.5">{status.text}</span></span></td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{program.type === 'upload' ? (<button onClick={() => handleUploadClick(program)} className="text-teal-600 hover:text-teal-900 flex items-center"><Upload className="w-4 h-4 mr-1"/> Upload Report</button>) : (<button onClick={() => handleUploadClick(program)} className="text-indigo-600 hover:text-indigo-900 flex items-center"><Upload className="w-4 h-4 mr-1"/> Upload Proof</button>)}</td></tr>);})}</tbody></table></div></div>{showUploadModal && <UploadModal program={selectedProgram} onClose={() => setShowUploadModal(false)} onFileUpload={handleFileUpload} />}</div>
    );
};

const AdminDashboard = ({ facilities, programs, submissions, users, isViewer = false, onConfirm }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedFacility, setExpandedFacility] = useState(null);
    const chartContainerRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(0);

    const filteredFacilities = facilities.filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()));

    useEffect(() => {
        const handleResize = () => { if (chartContainerRef.current) { setChartWidth(chartContainerRef.current.offsetWidth); } };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const complianceData = facilities.map(facility => {
        const facilityUser = users.find(u => u.facilityName === facility);
        const applicablePrograms = facilityUser ? programs.filter(p => facilityUser.assignedPrograms.includes(p.id)) : [];
        let submittedCount = applicablePrograms.filter(p => getStatusForProgram(facility, p, submissions).text === 'Submitted').length;
        return { name: facility, submitted: submittedCount, pending: applicablePrograms.length - submittedCount };
    });
    const overallStats = complianceData.reduce((acc, curr) => ({ totalSubmitted: acc.totalSubmitted + curr.submitted, totalPending: acc.totalPending + curr.pending }), { totalSubmitted: 0, totalPending: 0 });
    const totalExpectedReports = complianceData.reduce((acc, curr) => acc + curr.submitted + curr.pending, 0);
    const complianceRate = totalExpectedReports > 0 ? (overallStats.totalSubmitted / totalExpectedReports * 100).toFixed(1) : 0;
    const chartData = programs.map(p => {
        const totalApplicable = users.filter(u => u.assignedPrograms.includes(p.id)).length;
        const submittedCount = submissions.filter(s => s.programName === p.name && getStatusForProgram(s.facilityName, p, submissions).text === 'Submitted').length;
        return { name: p.name, Submitted: submittedCount, Pending: totalApplicable - submittedCount };
    });

    return (
        <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800">Provincial Compliance Dashboard</h1><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-teal-100"><CheckCircle2 className="w-6 h-6 text-teal-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Compliance Rate</p><p className="text-2xl font-bold text-gray-800">{complianceRate}%</p></div></div><div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-green-100"><FileText className="w-6 h-6 text-green-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Total Submitted</p><p className="text-2xl font-bold text-gray-800">{overallStats.totalSubmitted}</p></div></div><div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-yellow-100"><Clock className="w-6 h-6 text-yellow-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Total Pending/Overdue</p><p className="text-2xl font-bold text-gray-800">{overallStats.totalPending}</p></div></div><div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-blue-100"><User className="w-6 h-6 text-blue-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Reporting Facilities</p><p className="text-2xl font-bold text-gray-800">{facilities.length}</p></div></div></div><div className="bg-white p-6 rounded-lg shadow-md"><h2 className="text-xl font-semibold mb-4 text-gray-700">Compliance by Program</h2><div ref={chartContainerRef} style={{ width: '100%', height: 300 }}><BarChart width={chartWidth} height={300} data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="Submitted" stackId="a" fill="#14b8a6" /><Bar dataKey="Pending" stackId="a" fill="#f59e0b" /></BarChart></div></div><div className="bg-white p-6 rounded-lg shadow-md"><h2 className="text-xl font-semibold mb-4 text-gray-700">Facility Submission Status</h2><div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /><input type="text" placeholder="Search for a facility..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"/></div><div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">{filteredFacilities.map(facility => (<div key={facility} className="border rounded-lg"><button onClick={() => setExpandedFacility(expandedFacility === facility ? null : facility)} className="w-full flex justify-between items-center p-4 text-left"><span className="font-medium text-gray-800">{facility}</span>{expandedFacility === facility ? <ChevronUp /> : <ChevronDown />}</button>{expandedFacility === facility && (<div className="p-4 border-t bg-gray-50"><ul className="space-y-2">{programs.filter(p => (users.find(u => u.facilityName === facility)?.assignedPrograms || []).includes(p.id)).map(program => { const status = getStatusForProgram(facility, program, submissions); return (<li key={program.id} className={`flex justify-between items-center text-sm p-2 rounded-md ${status.text === 'Overdue' ? 'bg-red-50' : ''}`}><span>{program.name}</span><div className="flex items-center space-x-2">{status.isActionable && <a href={status.fileURL} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">View Proof</a>}{status.isActionable && !isViewer && <button onClick={() => onConfirm(status.submissionId)} className="text-sm bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">Confirm</button>}<span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.style}`}>{status.icon}<span className="ml-1.5">{status.text}</span></span></div></li>);})}</ul></div>)}</div>))}</div></div></div>
    );
};

const ReportsPage = ({ programs, submissions, users }) => {
    const [reportType, setReportType] = useState('Quarterly');
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarter, setQuarter] = useState(1);
    const [generatedReport, setGeneratedReport] = useState(null);

    const handleGenerateReport = () => {
        const programName = 'Rabies Program';
        const programId = 'rabies';
        
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
            title = `Quarterly Rabies Report - Q${quarter} ${year}`;
        } else {
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
            title = `Annual Rabies Report - ${year}`;
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
        <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800">Report Generation</h1><div className="bg-white p-6 rounded-lg shadow-md print:hidden"><h2 className="text-xl font-semibold mb-4 text-gray-700">Consolidated Rabies Program Report</h2><div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"><div><label className="block text-sm font-medium text-gray-700">Report Type</label><select value={reportType} onChange={e => setReportType(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"><option>Quarterly</option><option>Annual</option></select></div><div><label className="block text-sm font-medium text-gray-700">Year</label><select value={year} onChange={e => setYear(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"><option>{new Date().getFullYear()}</option><option>{new Date().getFullYear() - 1}</option></select></div>{reportType === 'Quarterly' && (<div><label className="block text-sm font-medium text-gray-700">Quarter</label><select value={quarter} onChange={e => setQuarter(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"><option value={1}>Q1 (Jan-Mar)</option><option value={2}>Q2 (Apr-Jun)</option><option value={3}>Q3 (Jul-Sep)</option><option value={4}>Q4 (Oct-Dec)</option></select></div>)}<button onClick={handleGenerateReport} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 h-10">Generate Report</button></div></div>{generatedReport && (<div id="report-view" className="bg-white p-8 rounded-lg shadow-md"><div className="flex justify-between items-start"><div><h2 className="text-2xl font-bold text-gray-900">{generatedReport.title}</h2><p className="text-sm text-gray-500">Reporting Period: {generatedReport.period}</p><p className="text-sm text-gray-500">Generated on: {new Date().toLocaleDateString()}</p></div><button onClick={() => window.print()} className="print:hidden flex items-center bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded-lg transition duration-300"><Printer className="w-4 h-4 mr-2" />Print / Save as PDF</button></div><hr className="my-6" /><div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"><div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Total Rabies Cases</p><p className="text-3xl font-bold text-teal-600">{generatedReport.totalCases}</p></div><div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Reporting Facilities</p><p className="text-3xl font-bold text-teal-600">{generatedReport.reportingFacilities}</p></div><div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Compliance Rate</p><p className="text-3xl font-bold text-teal-600">{generatedReport.totalFacilities > 0 ? ((generatedReport.reportingFacilities / generatedReport.totalFacilities) * 100).toFixed(1) : 0}%</p></div></div><h3 className="text-lg font-semibold mb-4 text-gray-700">Breakdown by Facility</h3><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 border"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Submissions Made</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cases Reported</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{generatedReport.breakdown.map(item => (<tr key={item.facilityName}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.facilityName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.submissionsCount}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-bold">{item.totalCases}</td></tr>))}</tbody></table></div></div>)}</div>
    );
};

const SettingsPage = ({ programs, setPrograms }) => {
    const [newProgramName, setNewProgramName] = useState('');
    const [newProgramFreq, setNewProgramFreq] = useState('Monthly');
    const [newProgramType, setNewProgramType] = useState('upload');

    const handleAddProgram = (e) => {
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
        if (programs.some(p => p.id === newProgram.id)) {
            alert('A program with this name already exists.');
            return;
        }
        setPrograms(prev => [...prev, newProgram]);
        setNewProgramName('');
    };
    
    const handleToggleProgram = (programId) => {
        setPrograms(prev =>
            prev.map(p =>
                p.id === programId ? { ...p, active: !p.active } : p
            )
        );
    };

    const handleDeleteProgram = (programId) => {
        if (confirm('Are you sure you want to delete this program? This cannot be undone.')) {
            setPrograms(prev => prev.filter(p => p.id !== programId));
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
                                    {!program.core && (
                                        <button onClick={() => handleDeleteProgram(program.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-full">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <label htmlFor={`toggle-${program.id}`} className="flex items-center cursor-pointer">
                                        <div className="relative">
                                            <input type="checkbox" id={`toggle-${program.id}`} className="sr-only" checked={program.active} onChange={() => handleToggleProgram(program.id)} />
                                            <div className={`block w-12 h-6 rounded-full ${program.active ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${program.active ? 'transform translate-x-6' : ''}`}></div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                 <div className="mt-8 border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Add New Program</h3>
                    <form onSubmit={handleAddProgram} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Program Name</label>
                            <input type="text" value={newProgramName} onChange={e => setNewProgramName(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" placeholder="e.g., Dengue Surveillance" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Frequency</label>
                                <select value={newProgramFreq} onChange={e => setNewProgramFreq(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
                                    <option>Weekly</option>
                                    <option>Monthly</option>
                                    <option>Quarterly</option>
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Submission Type</label>
                                <select value={newProgramType} onChange={e => setNewProgramType(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
                                    <option value="upload">File Upload</option>
                                    <option value="external">Mark as Submitted</option>
                                </select>
                            </div>
                        </div>
                        <div className="text-right">
                             <button type="submit" className="inline-flex items-center bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"><PlusCircle className="w-5 h-5 mr-2"/>Add Program</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const UserManagementPage = ({ users, setUsers, facilities, programs }) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const handleAddUser = (newUser) => {
        setUsers(prev => [...prev, { ...newUser, id: Date.now() }]);
        setShowAddModal(false);
    };

    const handleEditUser = (updatedUser) => {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setShowEditModal(false);
        setEditingUser(null);
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setShowEditModal(true);
    };

    const handleDeleteUser = (userId) => {
        if (confirm('Are you sure you want to delete this user?')) {
            setUsers(prev => prev.filter(u => u.id !== userId));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Manage Users</h1>
                <button onClick={() => setShowAddModal(true)} className="inline-flex items-center bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                    <PlusCircle className="w-5 h-5 mr-2"/>
                    Add User
                </button>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.facilityName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <button onClick={() => openEditModal(user)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit className="w-4 h-4"/></button>
                                        {user.email !== 'admin@pho.gov.ph' && (
                                            <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 className="w-4 h-4"/></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {showAddModal && <UserFormModal title="Add New User" onClose={() => setShowAddModal(false)} onSave={handleAddUser} facilities={facilities} programs={programs} />}
            {showEditModal && <UserFormModal title="Edit User" user={editingUser} onClose={() => setShowEditModal(false)} onSave={handleEditUser} facilities={facilities} programs={programs} />}
        </div>
    );
};

const UserFormModal = ({ title, user, onClose, onSave, facilities, programs }) => {
    const [formData, setFormData] = useState({
        id: user?.id || null,
        name: user?.name || '',
        email: user?.email || '',
        password: user?.password || '',
        confirmPassword: user?.password || '',
        facilityName: user?.facilityName || facilities[0],
        role: user?.role || 'Facility User',
        assignedPrograms: user?.assignedPrograms || programs.map(p => p.id)
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

    const handleSubmit = (e) => {
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
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Facility</label>
                        <select name="facilityName" value={formData.facilityName} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                            {facilities.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Role</label>
                        <select name="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                            <option>Facility User</option>
                            <option>Viewer</option>
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
                        <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Save User</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const SubmissionsHistory = ({ user, submissions }) => {
    const userSubmissions = submissions.filter(s => s.facilityName === user.facilityName)
        .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));
    return (
        <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800">Your Submission History</h1><div className="bg-white p-6 rounded-lg shadow-md"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{userSubmissions.length > 0 ? userSubmissions.map(sub => (<tr key={sub.id}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.programName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.submissionDate}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.fileURL ? (<a href={sub.fileURL} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">View File</a>) : ('Marked as submitted')}</td></tr>)) : (<tr><td colSpan="3" className="text-center py-10 text-gray-500">No submissions found.</td></tr>)}</tbody></table></div></div></div>
    );
};

const Profile = ({ user }) => (
    <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800">User Profile</h1><div className="bg-white p-8 rounded-lg shadow-md max-w-lg"><div className="space-y-4"><div><label className="block text-sm font-medium text-gray-500">Full Name</label><p className="text-lg text-gray-800">{user.name}</p></div><div><label className="block text-sm font-medium text-gray-500">Email Address</label><p className="text-lg text-gray-800">{user.email}</p></div><div><label className="block text-sm font-medium text-gray-500">Assigned Facility</label><p className="text-lg text-gray-800">{user.facilityName}</p></div><div><label className="block text-sm font-medium text-gray-500">Role</label><p className="text-lg text-gray-800">{user.role}</p></div></div><button className="mt-6 w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Edit Profile (Not Implemented)</button></div></div>
);

const UploadModal = ({ program, onClose, onFileUpload }) => {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const handleFileChange = (e) => { if (e.target.files && e.target.files[0]) { setFile(e.target.files[0]); } };
    const handleDragEvents = (e, isDragging) => { e.preventDefault(); e.stopPropagation(); setDragging(isDragging); };
    const handleDrop = (e) => { handleDragEvents(e, false); if (e.dataTransfer.files && e.dataTransfer.files[0]) { setFile(e.dataTransfer.files[0]); } };
    const handleSubmit = () => { if (file) { onFileUpload(file); } };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative"><button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button><h2 className="text-xl font-bold text-gray-800 mb-2">Upload Report</h2><p className="text-gray-600 mb-4">Submitting for: <span className="font-semibold">{program.name}</span></p><div onDragEnter={(e) => handleDragEvents(e, true)} onDragLeave={(e) => handleDragEvents(e, false)} onDragOver={(e) => handleDragEvents(e, true)} onDrop={handleDrop} className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300'}`}><Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" /><input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.mdb" /><label htmlFor="file-upload" className="font-medium text-teal-600 hover:text-teal-500 cursor-pointer">Choose a file</label><p className="text-sm text-gray-500 mt-1">or drag and drop</p><p className="text-xs text-gray-400 mt-2">XLSX, CSV, PDF, PNG, JPG, MDB</p></div>{file && (<div className="mt-4 p-3 bg-gray-100 rounded-lg flex items-center justify-between"><div className="flex items-center"><FileText className="w-5 h-5 text-gray-500 mr-2" /><span className="text-sm text-gray-700">{file.name}</span></div><button onClick={() => setFile(null)} className="p-1 rounded-full hover:bg-gray-200"><X className="w-4 h-4 text-gray-500" /></button></div>)}<div className="mt-6 flex justify-end space-x-3"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={handleSubmit} disabled={!file} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed">Upload and Submit</button></div></div></div>
    );
};
