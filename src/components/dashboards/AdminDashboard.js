import React, { useMemo, useState, useEffect } from 'react';
import { Users, Building, FileText, Clock, UserPlus, AlertTriangle, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { getMorbidityWeek } from '../../utils/helpers';
import { getFunctions, httpsCallable } from 'firebase/functions';

const AdminDashboard = ({ facilities = [], programs = [], users = [], submissions = [], onNavigate }) => {

    // --- 1. System-Wide Statistics ---
    const systemStats = useMemo(() => {
        const activeUsers = users.filter(u => u.isActive);
        const activePrograms = programs.filter(p => p.active !== false);
        
        const pendingGroups = submissions.filter(s => s.status === 'pending').reduce((acc, sub) => {
            const key = sub.batchId || sub.id;
            if (!acc[key]) acc[key] = 0;
            acc[key]++;
            return acc;
        }, {});

        const deletionRequests = submissions.filter(s => s.deletionRequest);

        return {
            totalUsers: activeUsers.length,
            totalFacilities: facilities.length,
            totalPrograms: activePrograms.length,
            totalPending: Object.keys(pendingGroups).length,
            deletionRequestsCount: deletionRequests.length,
        };
    }, [users, facilities, programs, submissions]);

    // --- 2. Recent Activity Feed (with Pagination and Filtering) ---
    const [activityProgram, setActivityProgram] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const activityFeedData = useMemo(() => {
        const sortedSubmissions = submissions.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
        
        const grouped = sortedSubmissions.reduce((acc, sub) => {
            const key = sub.batchId || sub.id;
            if (!acc[key]) {
                acc[key] = {
                    id: key,
                    isBatch: !!sub.batchId,
                    programName: sub.programName,
                    programId: sub.programId,
                    userName: sub.userName,
                    facilityName: sub.facilityName,
                    timestamp: sub.timestamp,
                    count: 0
                };
            }
            acc[key].count++;
            return acc;
        }, {});

        const selectedProgramInfo = programs.find(p => p.id === activityProgram);
        const isPidsrFilter = selectedProgramInfo?.name.toUpperCase().includes('PIDSR');

        const filtered = Object.values(grouped).filter(item => {
            if (activityProgram === 'all') return true;
            if (isPidsrFilter) return item.programId === 'PIDSR' || item.programId === activityProgram;
            return item.programId === activityProgram;
        });

        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const paginatedItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        return { items: paginatedItems, totalPages, totalItems: filtered.length };

    }, [submissions, activityProgram, currentPage, programs]);

    useEffect(() => {
        setCurrentPage(1);
    }, [activityProgram]);


    // --- 3. Facility Compliance Leaderboard (with corrected logic) ---
    const complianceLeaderboard = useMemo(() => {
        const now = new Date();
        const currentMorbidityWeek = getMorbidityWeek(now);
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const facilityScores = facilities.map(facility => {
            const facilityUsers = users.filter(u => u.facilityId === facility.id);
            if (facilityUsers.length === 0) {
                return { name: facility.name, rate: -1 };
            }

            const assignedProgramIds = [...new Set(facilityUsers.flatMap(u => u.assignedPrograms || []))];
            if (assignedProgramIds.length === 0) {
                return { name: facility.name, rate: -1 };
            }

            let requiredSubmissions = 0;
            let madeSubmissions = 0;

            assignedProgramIds.forEach(programId => {
                const program = programs.find(p => p.id === programId);
                if (!program) return;

                requiredSubmissions++;
                
                const isPidsr = program.name?.toUpperCase().includes("PIDSR");
                const periodType = program.name?.toLowerCase().includes("rabies") ? "monthly" : "weekly";
                
                const hasSubmitted = submissions.some(sub => {
                    const isCorrectFacility = sub.facilityId === facility.id;
                    const isCorrectProgram = sub.programId === programId || (isPidsr && sub.programId === 'PIDSR');
                    if (!isCorrectFacility || !isCorrectProgram) return false;

                    if (periodType === 'monthly') {
                        return sub.submissionMonth === currentMonth && sub.submissionYear === currentYear;
                    } else { // weekly
                        return sub.morbidityWeek === currentMorbidityWeek && sub.submissionYear === currentYear;
                    }
                });

                if (hasSubmitted) {
                    madeSubmissions++;
                }
            });
            
            if (requiredSubmissions === 0) {
                 return { name: facility.name, rate: -1 };
            }

            const rate = (madeSubmissions / requiredSubmissions) * 100;
            return { name: facility.name, rate };
        }).filter(f => f.rate !== -1);

        facilityScores.sort((a, b) => b.rate - a.rate);

        return {
            top5: facilityScores.slice(0, 5),
            bottom5: facilityScores.slice(-5).reverse()
        };
    }, [facilities, users, programs, submissions]);

    // --- 4. System Health State & Fetch ---
    const [systemHealth, setSystemHealth] = useState({ errorCount: 0, loading: true });

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const functions = getFunctions();
                const getSystemHealth = httpsCallable(functions, 'getSystemHealth');
                const result = await getSystemHealth();
                setSystemHealth({ errorCount: result.data.errorCount, loading: false });
            } catch (error) {
                console.error("Could not fetch system health:", error);
                setSystemHealth({ errorCount: 'N/A', loading: false });
            }
        };
        fetchHealth();
    }, []);


    return (
        <div className="space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Super Admin Dashboard</h1>

            {/* System-Wide Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-blue-100"><Users className="w-6 h-6 text-blue-600" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Total Active Users</p>
                        <p className="text-2xl font-bold text-gray-800">{systemStats.totalUsers}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-indigo-100"><Building className="w-6 h-6 text-indigo-600" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Total Facilities</p>
                        <p className="text-2xl font-bold text-gray-800">{systemStats.totalFacilities}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-teal-100"><FileText className="w-6 h-6 text-teal-600" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Active Programs</p>
                        <p className="text-2xl font-bold text-gray-800">{systemStats.totalPrograms}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-yellow-100"><Clock className="w-6 h-6 text-yellow-600" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Pending Submissions</p>
                        <p className="text-2xl font-bold text-gray-800">{systemStats.totalPending}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Management Actions & System Health */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">Quick Actions</h2>
                        <div className="space-y-3">
                            <button onClick={() => onNavigate('users')} className="w-full text-left flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                                <UserPlus className="w-5 h-5 text-gray-600 mr-3" />
                                <span className="font-medium">Manage Users</span>
                            </button>
                            <button onClick={() => onNavigate('facilities')} className="w-full text-left flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                                <Building className="w-5 h-5 text-gray-600 mr-3" />
                                <span className="font-medium">Manage Facilities</span>
                            </button>
                            <button onClick={() => onNavigate('settings')} className="w-full text-left flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                                <FileText className="w-5 h-5 text-gray-600 mr-3" />
                                <span className="font-medium">Manage Programs</span>
                            </button>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">System Health</h2>
                        <div className="flex items-center">
                            {systemHealth.loading ? (
                                <p className="text-sm text-gray-500">Checking status...</p>
                            ) : systemHealth.errorCount > 0 ? (
                                <>
                                    <div className="p-3 rounded-full bg-red-100"><ShieldAlert className="w-6 h-6 text-red-600" /></div>
                                    <div className="ml-4">
                                        <p className="text-sm text-gray-500">Errors (Last 24h)</p>
                                        <p className="text-2xl font-bold text-red-600">{systemHealth.errorCount}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-3 rounded-full bg-green-100"><ShieldCheck className="w-6 h-6 text-green-600" /></div>
                                    <div className="ml-4">
                                        <p className="text-sm text-gray-500">System Status</p>
                                        <p className="text-2xl font-bold text-green-600">Nominal</p>
                                    </div>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-4">
                            Monitors critical backend function errors in the last 24 hours.
                        </p>
                    </div>
                </div>

                {/* --- UPDATED: Recent System Activity with Tabs and Pagination --- */}
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                    <div className="border-b border-gray-200 mb-4">
                        <nav className="-mb-px flex space-x-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
                            <button onClick={() => setActivityProgram('all')} className={`py-2 px-1 text-sm font-medium whitespace-nowrap ${activityProgram === 'all' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}>All Programs</button>
                            {programs.map(p => (
                                <button key={p.id} onClick={() => setActivityProgram(p.id)} className={`py-2 px-1 text-sm font-medium whitespace-nowrap ${activityProgram === p.id ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}>{p.name}</button>
                            ))}
                        </nav>
                    </div>
                    <div className="space-y-4 min-h-[280px]">
                        {activityFeedData.items.length > 0 ? activityFeedData.items.map(sub => (
                             <div key={sub.id} className="flex items-center text-sm">
                                 <div className="p-2 bg-gray-100 rounded-full mr-3">
                                     <FileText className="w-4 h-4 text-gray-500" />
                                 </div>
                                 <div>
                                     <p className="text-gray-800">
                                         <span className="font-semibold">{sub.userName}</span> from <span className="font-semibold">{sub.facilityName}</span> submitted a report for <span className="font-semibold">{sub.programName}</span>.
                                     </p>
                                     <p className="text-xs text-gray-400">{sub.timestamp.toDate().toLocaleString()}</p>
                                 </div>
                             </div>
                        )) : (
                            <p className="text-gray-500 pt-10 text-center">No recent activity for this program.</p>
                        )}
                    </div>
                    {activityFeedData.totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4 text-sm">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">
                                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                            </button>
                            <span>Page {currentPage} of {activityFeedData.totalPages}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(activityFeedData.totalPages, p + 1))} disabled={currentPage === activityFeedData.totalPages} className="flex items-center px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">
                                Next <ChevronRight className="w-4 h-4 ml-1" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top 5 Compliant */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700 flex items-center">
                        <TrendingUp className="w-6 h-6 text-green-500 mr-2" />
                        Top Compliant Facilities
                    </h2>
                    <div className="space-y-3">
                        {complianceLeaderboard.top5.map((facility, index) => (
                            <div key={facility.name} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                <div className="flex items-center">
                                    <span className="text-sm font-bold text-gray-600 w-6">{index + 1}.</span>
                                    <span className="font-medium text-gray-800">{facility.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Bottom 5 Compliant */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                     <h2 className="text-xl font-semibold mb-4 text-gray-700 flex items-center">
                         <TrendingDown className="w-6 h-6 text-red-500 mr-2" />
                         Least Compliant Facilities
                     </h2>
                    <div className="space-y-3">
                        {complianceLeaderboard.bottom5.map((facility, index) => (
                            <div key={facility.name} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                               <div className="flex items-center">
                                    <span className="text-sm font-bold text-gray-600 w-6">{index + 1}.</span>
                                    <span className="font-medium text-gray-800">{facility.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {systemStats.deletionRequestsCount > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-md">
                    <div className="flex items-center">
                        <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                        <div>
                            <p className="font-bold text-red-800">Pending Deletion Requests</p>
                            <p className="text-sm text-red-700">
                                There are {systemStats.deletionRequestsCount} submissions marked for deletion.
                                <button onClick={() => onNavigate('deletion-requests')} className="ml-2 font-semibold text-red-800 hover:underline">Review Now</button>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
