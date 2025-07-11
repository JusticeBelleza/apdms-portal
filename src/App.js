import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, Upload, FileText, User, LogOut, LayoutDashboard, ChevronDown, ChevronUp, Search, X, FileSpreadsheet, Printer } from 'lucide-react';

// Mock Data - Replace with API/Firebase calls
const MOCK_FACILITIES = [
    "Bangued RHU", "Boliney RHU", "Bucay RHU", "Bucloc RHU", "Daguioman RHU", 
    "Danglas RHU", "Dolores RHU", "La Paz RHU", "Lacub RHU", "Lagangilang RHU", 
    "Lagayan RHU", "Langiden RHU", "Licuan-Baay RHU", "Luba RHU", "Malibcong RHU", 
    "Manabo RHU", "Peñarrubia RHU", "Pilar RHU", "Sallapadan RHU", "San Isidro RHU", 
    "San Juan RHU", "San Quintin RHU", "Tayum RHU", "Tineg RHU", "Tubo RHU", 
    "Villaviciosa RHU", "Abra Provincial Hospital", "ASSC Hospital", "La Paz District Hospital",
    "St. Theresa Wellness Center", "Valera Medical Hospital", "Dr. Petronilo V. Seares Sr. Memorial Hospital",
    "Bangued Christian Hospital", "Saint Jude Medical Clinic", "Family Care Clinic", "United Doctors Clinic", "Bangued General Hospital"
];

const MOCK_PROGRAMS = [
    { id: 'pidsr', name: 'PIDSR Program', frequency: 'Weekly', type: 'external' },
    { id: 'rabies', name: 'Rabies Program', frequency: 'Monthly', type: 'upload' },
];

const generateMockSubmissions = () => {
    let submissions = [];
    const today = new Date();
    MOCK_FACILITIES.forEach(facility => {
        MOCK_PROGRAMS.forEach(program => {
            // Generate more submissions for better reporting
            for (let i = 0; i < 12; i++) { // submissions for the past year
                 const shouldBeSubmitted = Math.random() > 0.2;
                 if (shouldBeSubmitted) {
                    const submissionDate = new Date(today.getFullYear(), today.getMonth() - i, Math.floor(Math.random() * 28) + 1);
                    submissions.push({
                        id: `${facility}-${program.id}-${submissionDate.getTime()}`,
                        facilityName: facility,
                        programName: program.name,
                        submissionDate: submissionDate.toISOString().split('T')[0],
                        status: 'Submitted',
                        fileURL: program.type === 'upload' ? `/uploads/mock-report-${Math.floor(Math.random() * 100)}.xlsx` : null,
                        // Add mock data for consolidation
                        data: { cases: Math.floor(Math.random() * 10) }
                    });
                }
            }
        });
    });
    return submissions;
};

const MOCK_SUBMISSIONS = generateMockSubmissions();

// Helper function to determine report status
const getStatusForProgram = (facilityName, program, submissions) => {
    const lastSubmission = submissions
        .filter(s => s.facilityName === facilityName && s.programName === program.name)
        .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate))[0];

    if (!lastSubmission) return { text: 'Pending', color: 'yellow', icon: <Clock className="w-4 h-4" /> };

    const today = new Date();
    const submissionDate = new Date(lastSubmission.submissionDate);
    let daysDiff = (today - submissionDate) / (1000 * 60 * 60 * 24);

    let deadlineDays;
    switch (program.frequency) {
        case 'Weekly': deadlineDays = 7; break;
        case 'Monthly': deadlineDays = 30; break;
        default: deadlineDays = 30;
    }

    if (daysDiff <= deadlineDays) {
        return { text: 'Submitted', color: 'green', icon: <CheckCircle2 className="w-4 h-4" /> };
    } else {
        return { text: 'Overdue', color: 'red', icon: <AlertTriangle className="w-4 h-4" /> };
    }
};


// Main App Component
export default function App() {
    const [user, setUser] = useState(null);
    const [page, setPage] = useState('dashboard');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTimeout(() => {
            setLoading(false);
        }, 1500);
    }, []);

    const handleLogin = (email, password) => {
        setLoading(true);
        setTimeout(() => {
            if (email === 'admin@pho.gov.ph' && password === 'password') {
                setUser({
                    name: 'Admin',
                    email: 'admin@pho.gov.ph',
                    facilityName: 'Provincial Health Office',
                    role: 'PHO Admin'
                });
            } else if (password === 'password') {
                 const facilityName = MOCK_FACILITIES.find(f => f.toLowerCase().includes(email.split('@')[0].split('.')[0])) || "Bangued RHU";
                 setUser({
                    name: 'Jane Doe',
                    email: email,
                    facilityName: facilityName,
                    role: 'Facility User'
                });
            } else {
                alert("Invalid credentials. Use 'admin@pho.gov.ph' or any other email with password 'password'.");
            }
            setLoading(false);
        }, 1000);
    };

    const handleLogout = () => {
        setUser(null);
        setPage('dashboard');
    };

    if (loading) {
        return <LoadingScreen />;
    }

    if (!user) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <Sidebar user={user} onNavigate={setPage} onLogout={handleLogout} currentPage={page} />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header user={user} onLogout={handleLogout} />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    {page === 'dashboard' && user.role === 'Facility User' && <FacilityDashboard user={user} />}
                    {page === 'dashboard' && user.role === 'PHO Admin' && <AdminDashboard />}
                    {page === 'reports' && user.role === 'PHO Admin' && <ReportsPage />}
                    {page === 'submissions' && <SubmissionsHistory user={user} />}
                    {page === 'profile' && <Profile user={user} />}
                </div>
            </main>
        </div>
    );
}

// Screen Components
const LoadingScreen = () => (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-teal-400 mx-auto"></div>
            <h1 className="text-3xl font-bold mt-4">APDMS</h1>
            <p className="text-lg text-gray-300">Abra PHO Disease Data Management System</p>
            <p className="mt-2 text-teal-400">Loading Application...</p>
        </div>
    </div>
);

const LoginScreen = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(email, password);
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8">
                <div className="text-center mb-8">
                     <img src="https://placehold.co/100x100/1a202c/76e2d9?text=APDMS" alt="APDMS Logo" className="w-24 h-24 mx-auto rounded-full mb-4 border-4 border-teal-400" />
                    <h1 className="text-3xl font-bold text-white">APDMS Portal</h1>
                    <p className="text-gray-400">Abra PHO Disease Data Management System</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="e.g., jane.doe@banguedrhu.gov.ph" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="************" required />
                    </div>
                    <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105">Secure Login</button>
                </form>
                 <div className="text-center mt-4 text-xs text-gray-500"><p>Use `admin@pho.gov.ph` or any other email with password `password`.</p></div>
            </div>
            <p className="text-center text-gray-500 text-xs mt-8">&copy;2025 Abra Provincial Health Office. All rights reserved.</p>
        </div>
    );
};


// Layout Components
const Sidebar = ({ user, onNavigate, onLogout, currentPage }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, role: ['Facility User', 'PHO Admin'] },
        { id: 'reports', label: 'Reports', icon: <FileSpreadsheet className="w-5 h-5" />, role: ['PHO Admin'] },
        { id: 'submissions', label: 'My Submissions', icon: <FileText className="w-5 h-5" />, role: ['Facility User'] },
        { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" />, role: ['Facility User', 'PHO Admin'] },
    ];

    const filteredNavItems = navItems.filter(item => item.role.includes(user.role));

    return (
        <aside className="hidden md:flex flex-col w-64 bg-gray-800 text-white">
            <div className="flex items-center justify-center h-20 border-b border-gray-700">
                 <img src="https://placehold.co/40x40/1a202c/76e2d9?text=A" alt="Logo" className="w-10 h-10 rounded-full" />
                <h1 className="text-xl font-bold ml-2">APDMS</h1>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-2">
                {filteredNavItems.map(item => (
                     <a key={item.id} href="#" onClick={(e) => { e.preventDefault(); onNavigate(item.id); }} className={`flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${currentPage === item.id ? 'bg-teal-600 text-white' : 'hover:bg-gray-700'}`}>
                        {item.icon}
                        <span className="ml-3">{item.label}</span>
                    </a>
                ))}
            </nav>
            <div className="px-4 py-4 border-t border-gray-700">
                <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }} className="flex items-center px-4 py-2 rounded-lg hover:bg-red-600 transition-colors duration-200">
                    <LogOut className="w-5 h-5" />
                    <span className="ml-3">Logout</span>
                </a>
            </div>
        </aside>
    );
};

const Header = ({ user, onLogout }) => (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b">
        <div>
            <h2 className="text-lg font-semibold text-gray-800">Welcome, {user.name}!</h2>
            <p className="text-sm text-gray-500">{user.facilityName} - {user.role}</p>
        </div>
        <div className="flex items-center">
             <button onClick={onLogout} className="md:hidden p-2 rounded-full hover:bg-gray-200"><LogOut className="w-5 h-5 text-gray-600" /></button>
        </div>
    </header>
);

// Page Components
const FacilityDashboard = ({ user }) => {
    const [submissions, setSubmissions] = useState(MOCK_SUBMISSIONS);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);

    const handleUploadClick = (program) => {
        setSelectedProgram(program);
        setShowUploadModal(true);
    };
    
    const handleMarkAsSubmitted = (program) => {
        if(confirm(`Are you sure you want to mark "${program.name}" as submitted to the national system?`)){
            const newSubmission = { id: `${user.facilityName}-${program.id}-${new Date().getTime()}`, facilityName: user.facilityName, programName: program.name, submissionDate: new Date().toISOString().split('T')[0], status: 'Submitted', fileURL: null };
            setSubmissions(prev => [...prev, newSubmission]);
            alert(`"${program.name}" has been successfully marked as submitted.`);
        }
    };

    const handleFileUpload = (file) => {
        const newSubmission = { id: `${user.facilityName}-${selectedProgram.id}-${new Date().getTime()}`, facilityName: user.facilityName, programName: selectedProgram.name, submissionDate: new Date().toISOString().split('T')[0], status: 'Submitted', fileURL: `/uploads/${file.name}` };
        setSubmissions(prev => [...prev, newSubmission]);
        setShowUploadModal(false);
        setSelectedProgram(null);
        alert(`File "${file.name}" for "${selectedProgram.name}" uploaded successfully.`);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Your Reporting Dashboard</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Reporting Obligations Checklist</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {MOCK_PROGRAMS.map(program => {
                                const status = getStatusForProgram(user.facilityName, program, submissions);
                                return (
                                    <tr key={program.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{program.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{program.frequency}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}>{status.icon}<span className="ml-1.5">{status.text}</span></span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {program.type === 'upload' ? (
                                                <button onClick={() => handleUploadClick(program)} className="text-teal-600 hover:text-teal-900 flex items-center"><Upload className="w-4 h-4 mr-1"/> Upload Report</button>
                                            ) : (
                                                <button onClick={() => handleMarkAsSubmitted(program)} className="text-indigo-600 hover:text-indigo-900 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> Mark as Submitted</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {showUploadModal && <UploadModal program={selectedProgram} onClose={() => setShowUploadModal(false)} onFileUpload={handleFileUpload} />}
        </div>
    );
};

const AdminDashboard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredFacilities, setFilteredFacilities] = useState(MOCK_FACILITIES);
    const [expandedFacility, setExpandedFacility] = useState(null);
    const chartContainerRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(0);

    useEffect(() => {
        setFilteredFacilities(MOCK_FACILITIES.filter(f => f.toLowerCase().includes(searchTerm.toLowerCase())));
    }, [searchTerm]);

    useEffect(() => {
        const handleResize = () => {
            if (chartContainerRef.current) {
                setChartWidth(chartContainerRef.current.offsetWidth);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const complianceData = MOCK_FACILITIES.map(facility => {
        let submitted = MOCK_PROGRAMS.filter(p => getStatusForProgram(facility, p, MOCK_SUBMISSIONS).text === 'Submitted').length;
        return { name: facility, submitted, pending: MOCK_PROGRAMS.length - submitted };
    });
    
    const overallStats = complianceData.reduce((acc, curr) => {
        acc.totalSubmitted += curr.submitted;
        acc.totalPending += curr.pending;
        return acc;
    }, { totalSubmitted: 0, totalPending: 0 });

    const totalReports = MOCK_FACILITIES.length * MOCK_PROGRAMS.length;
    const complianceRate = totalReports > 0 ? (overallStats.totalSubmitted / totalReports * 100).toFixed(1) : 0;

    const toggleFacility = (facilityName) => setExpandedFacility(expandedFacility === facilityName ? null : facilityName);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Provincial Compliance Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-teal-100"><CheckCircle2 className="w-6 h-6 text-teal-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Compliance Rate</p><p className="text-2xl font-bold text-gray-800">{complianceRate}%</p></div></div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-green-100"><FileText className="w-6 h-6 text-green-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Total Submitted</p><p className="text-2xl font-bold text-gray-800">{overallStats.totalSubmitted}</p></div></div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-yellow-100"><Clock className="w-6 h-6 text-yellow-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Total Pending/Overdue</p><p className="text-2xl font-bold text-gray-800">{overallStats.totalPending}</p></div></div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className="p-3 rounded-full bg-blue-100"><User className="w-6 h-6 text-blue-600" /></div><div className="ml-4"><p className="text-sm text-gray-500">Reporting Facilities</p><p className="text-2xl font-bold text-gray-800">{MOCK_FACILITIES.length}</p></div></div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Compliance by Program</h2>
                <div ref={chartContainerRef} style={{ width: '100%', height: 300 }}>
                    <BarChart 
                        width={chartWidth} 
                        height={300} 
                        data={MOCK_PROGRAMS.map(p => ({ name: p.name, Submitted: MOCK_SUBMISSIONS.filter(s => s.programName === p.name && getStatusForProgram(s.facilityName, p, MOCK_SUBMISSIONS).text === 'Submitted').length, Pending: MOCK_FACILITIES.length - MOCK_SUBMISSIONS.filter(s => s.programName === p.name && getStatusForProgram(s.facilityName, p, MOCK_SUBMISSIONS).text === 'Submitted').length }))}
                    >
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="Submitted" stackId="a" fill="#14b8a6" /><Bar dataKey="Pending" stackId="a" fill="#f59e0b" />
                    </BarChart>
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Facility Submission Status</h2>
                <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /><input type="text" placeholder="Search for a facility..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"/></div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {filteredFacilities.map(facility => (
                        <div key={facility} className="border rounded-lg">
                            <button onClick={() => toggleFacility(facility)} className="w-full flex justify-between items-center p-4 text-left"><span className="font-medium text-gray-800">{facility}</span>{expandedFacility === facility ? <ChevronUp /> : <ChevronDown />}</button>
                            {expandedFacility === facility && (
                                <div className="p-4 border-t bg-gray-50">
                                    <ul className="space-y-2">
                                        {MOCK_PROGRAMS.map(program => {
                                            const status = getStatusForProgram(facility, program, MOCK_SUBMISSIONS);
                                            return (<li key={program.id} className="flex justify-between items-center text-sm"><span>{program.name}</span><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}>{status.icon}<span className="ml-1.5">{status.text}</span></span></li>);
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ReportsPage = () => {
    const [reportType, setReportType] = useState('Quarterly');
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarter, setQuarter] = useState(1);
    const [generatedReport, setGeneratedReport] = useState(null);

    const handleGenerateReport = () => {
        const programName = 'Rabies Program';
        let startDate, endDate;
        let title = '';

        if (reportType === 'Quarterly') {
            const startMonth = (quarter - 1) * 3;
            startDate = new Date(year, startMonth, 1);
            endDate = new Date(year, startMonth + 3, 0);
            title = `Quarterly Rabies Report - Q${quarter} ${year}`;
        } else { // Annual
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
            title = `Annual Rabies Report - ${year}`;
        }
        
        // Simulate data consolidation by filtering submissions
        const relevantSubmissions = MOCK_SUBMISSIONS.filter(s => {
            const subDate = new Date(s.submissionDate);
            return s.programName === programName && subDate >= startDate && subDate <= endDate;
        });

        // Consolidate data
        const reportData = MOCK_FACILITIES.map(facility => {
            const facilitySubmissions = relevantSubmissions.filter(s => s.facilityName === facility);
            const totalCases = facilitySubmissions.reduce((acc, curr) => acc + (curr.data?.cases || 0), 0);
            return {
                facilityName: facility,
                totalCases: totalCases,
                submissionsCount: facilitySubmissions.length
            };
        });

        const totalCases = reportData.reduce((acc, curr) => acc + curr.totalCases, 0);
        const reportingFacilities = reportData.filter(r => r.submissionsCount > 0).length;

        setGeneratedReport({
            title,
            period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
            totalCases,
            reportingFacilities,
            totalFacilities: MOCK_FACILITIES.length,
            breakdown: reportData.sort((a, b) => b.totalCases - a.totalCases)
        });
    };
    
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Report Generation</h1>
            
            <div className="bg-white p-6 rounded-lg shadow-md print:hidden">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Consolidated Rabies Program Report</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Report Type</label>
                        <select value={reportType} onChange={e => setReportType(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
                            <option>Quarterly</option>
                            <option>Annual</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Year</label>
                        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
                            <option>{new Date().getFullYear()}</option>
                            <option>{new Date().getFullYear() - 1}</option>
                        </select>
                    </div>
                    {reportType === 'Quarterly' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Quarter</label>
                            <select value={quarter} onChange={e => setQuarter(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
                                <option value={1}>Q1 (Jan-Mar)</option>
                                <option value={2}>Q2 (Apr-Jun)</option>
                                <option value={3}>Q3 (Jul-Sep)</option>
                                <option value={4}>Q4 (Oct-Dec)</option>
                            </select>
                        </div>
                    )}
                    <button onClick={handleGenerateReport} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 h-10">Generate Report</button>
                </div>
            </div>

            {generatedReport && (
                <div id="report-view" className="bg-white p-8 rounded-lg shadow-md">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{generatedReport.title}</h2>
                            <p className="text-sm text-gray-500">Reporting Period: {generatedReport.period}</p>
                            <p className="text-sm text-gray-500">Generated on: {new Date().toLocaleDateString()}</p>
                        </div>
                         <button onClick={handlePrint} className="print:hidden flex items-center bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                            <Printer className="w-4 h-4 mr-2" />
                            Print / Save as PDF
                         </button>
                    </div>
                    <hr className="my-6" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Total Rabies Cases</p>
                            <p className="text-3xl font-bold text-teal-600">{generatedReport.totalCases}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Reporting Facilities</p>
                            <p className="text-3xl font-bold text-teal-600">{generatedReport.reportingFacilities}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Compliance Rate</p>
                            <p className="text-3xl font-bold text-teal-600">{((generatedReport.reportingFacilities / generatedReport.totalFacilities) * 100).toFixed(1)}%</p>
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">Breakdown by Facility</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 border">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Submissions Made</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cases Reported</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {generatedReport.breakdown.map(item => (
                                    <tr key={item.facilityName}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.facilityName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.submissionsCount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-bold">{item.totalCases}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};


const SubmissionsHistory = ({ user }) => {
    const userSubmissions = MOCK_SUBMISSIONS.filter(s => s.facilityName === user.facilityName)
        .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Your Submission History</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th></tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {userSubmissions.length > 0 ? userSubmissions.map(sub => (
                                <tr key={sub.id}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.programName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.submissionDate}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.fileURL ? (<a href={sub.fileURL} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">View File</a>) : ('Marked as submitted')}</td></tr>
                            )) : (
                                <tr><td colSpan="3" className="text-center py-10 text-gray-500">No submissions found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const Profile = ({ user }) => (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">User Profile</h1>
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg">
            <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-500">Full Name</label><p className="text-lg text-gray-800">{user.name}</p></div>
                <div><label className="block text-sm font-medium text-gray-500">Email Address</label><p className="text-lg text-gray-800">{user.email}</p></div>
                <div><label className="block text-sm font-medium text-gray-500">Assigned Facility</label><p className="text-lg text-gray-800">{user.facilityName}</p></div>
                <div><label className="block text-sm font-medium text-gray-500">Role</label><p className="text-lg text-gray-800">{user.role}</p></div>
            </div>
             <button className="mt-6 w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Edit Profile (Not Implemented)</button>
        </div>
    </div>
);


// Modal Component
const UploadModal = ({ program, onClose, onFileUpload }) => {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);

    const handleFileChange = (e) => { if (e.target.files && e.target.files[0]) { setFile(e.target.files[0]); } };
    const handleDragEvents = (e, isDragging) => { e.preventDefault(); e.stopPropagation(); setDragging(isDragging); };
    const handleDrop = (e) => { handleDragEvents(e, false); if (e.dataTransfer.files && e.dataTransfer.files[0]) { setFile(e.dataTransfer.files[0]); } };
    const handleSubmit = () => { if (file) { onFileUpload(file); } };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Upload Report</h2>
                <p className="text-gray-600 mb-4">Submitting for: <span className="font-semibold">{program.name}</span></p>
                <div onDragEnter={(e) => handleDragEvents(e, true)} onDragLeave={(e) => handleDragEvents(e, false)} onDragOver={(e) => handleDragEvents(e, true)} onDrop={handleDrop} className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300'}`}>
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.pdf" />
                    <label htmlFor="file-upload" className="font-medium text-teal-600 hover:text-teal-500 cursor-pointer">Choose a file</label>
                    <p className="text-sm text-gray-500 mt-1">or drag and drop</p>
                    <p className="text-xs text-gray-400 mt-2">XLSX, XLS, CSV, or PDF</p>
                </div>
                {file && (
                    <div className="mt-4 p-3 bg-gray-100 rounded-lg flex items-center justify-between">
                        <div className="flex items-center"><FileText className="w-5 h-5 text-gray-500 mr-2" /><span className="text-sm text-gray-700">{file.name}</span></div>
                        <button onClick={() => setFile(null)} className="p-1 rounded-full hover:bg-gray-200"><X className="w-4 h-4 text-gray-500" /></button>
                    </div>
                )}
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button onClick={handleSubmit} disabled={!file} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed">Upload and Submit</button>
                </div>
            </div>
        </div>
    );
};
