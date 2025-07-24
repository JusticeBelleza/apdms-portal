import React, { useState, useMemo, useEffect } from "react";
import { Check, X, CheckCircle, Clock, FileText, ChevronDown, ChevronRight, ChevronLeft, File as FileIcon, ClipboardList, MinusCircle } from "lucide-react";
import { getFunctions, httpsCallable } from 'firebase/functions';
import ConfirmationModal from '../modals/ConfirmationModal';
import RejectionModal from '../modals/RejectionModal';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getMorbidityWeek } from '../../utils/helpers';

// --- Helper Functions for Date Calculation (no changes) ---
const getMorbidityWeekRange = () => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { start: startOfWeek, end: endOfWeek };
};

const getMonthRange = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    return { start: startOfMonth, end: endOfMonth };
};

const PhoAdminDashboard = ({ user, programs = [], submissions = [], users = [], facilities = [] }) => {
    const [activeProgramId, setActiveProgramId] = useState(null);
    const [modalState, setModalState] = useState({ type: null, data: null });
    const [expandedBatch, setExpandedBatch] = useState(null);
    const [selectedDocuments, setSelectedDocuments] = useState([]);
    
    // State for Recent Activity Feed
    const [activityProgram, setActivityProgram] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // State for new Facility Status widget
    const [complianceFilter, setComplianceFilter] = useState('all');


    const functions = getFunctions();
    const processSubmission = httpsCallable(functions, 'processSubmission');

    const assignedPrograms = useMemo(() => user.assignedPrograms || [], [user.assignedPrograms]);

    const programsToDisplayTabs = useMemo(() => {
        if (assignedPrograms.length === 0) {
            return programs;
        }
        return programs.filter(p => assignedPrograms.includes(p.id));
    }, [programs, assignedPrograms]);

    useEffect(() => {
        if (!activeProgramId && programsToDisplayTabs.length > 0) {
            setActiveProgramId(programsToDisplayTabs[0].id);
        }
    }, [programsToDisplayTabs, activeProgramId]);
    
    const activeProgram = useMemo(() => programs.find(p => p.id === activeProgramId), [programs, activeProgramId]);

    const pendingSubmissionsForTable = useMemo(() => {
        if (!activeProgramId) return [];
        
        const pendingSubs = submissions.filter(sub =>
            sub.status === "pending" &&
            (sub.programId === activeProgramId || (activeProgram?.name.toUpperCase().includes('PIDSR') && sub.programId === 'PIDSR'))
        );

        const grouped = pendingSubs.reduce((acc, sub) => {
            const key = sub.batchId || sub.id;
            if (!acc[key]) {
                acc[key] = {
                    id: key,
                    isBatch: !!sub.batchId,
                    facilityName: sub.facilityName,
                    userName: sub.userName,
                    timestamp: sub.timestamp,
                    documents: [],
                };
            }
            acc[key].documents.push(sub);
            return acc;
        }, {});

        return Object.values(grouped);
    }, [submissions, activeProgramId, activeProgram]);
    
    const { stats, chartData } = useMemo(() => {
        if (!activeProgramId || !activeProgram) {
            return { 
                stats: { total: 0, approved: 0, rejected: 0, pending: 0 },
                chartData: []
            };
        }

        let filteredSubs = [];

        if (activeProgram.name.toUpperCase().includes("PIDSR")) {
            const { start, end } = getMorbidityWeekRange();
            filteredSubs = submissions.filter(sub => {
                const subDate = sub.timestamp?.toDate();
                return (sub.programId === activeProgramId || sub.programId === 'PIDSR') && subDate >= start && subDate <= end;
            });
        } else if (activeProgram.name.toUpperCase().includes("RABIES")) {
            const { start, end } = getMonthRange();
            filteredSubs = submissions.filter(sub => {
                const subDate = sub.timestamp?.toDate();
                return sub.programId === activeProgramId && subDate >= start && subDate <= end;
            });
        } else {
            filteredSubs = submissions.filter(sub => sub.programId === activeProgramId);
        }
        
        const submissionGroups = filteredSubs.reduce((acc, sub) => {
            const key = sub.batchId || sub.id;
            if (!acc[key]) {
                acc[key] = sub.status;
            }
            return acc;
        }, {});
        const statuses = Object.values(submissionGroups);


        const calculatedStats = {
            total: statuses.length,
            approved: statuses.filter(s => s === "approved").length,
            rejected: statuses.filter(s => s === "rejected").length,
            pending: statuses.filter(s => s === "pending").length,
        };

        const calculatedChartData = [
            { name: 'Approved', value: calculatedStats.approved },
            { name: 'Pending', value: calculatedStats.pending },
            { name: 'Rejected', value: calculatedStats.rejected },
        ].filter(item => item.value > 0);

        return { stats: calculatedStats, chartData: calculatedChartData };
    }, [submissions, activeProgram, activeProgramId]);

    // Recent Activity Feed Logic
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

    // --- REWRITTEN & SIMPLIFIED: Logic for the Facility Submission Status widget ---
    const { facilityComplianceData, compliancePeriod } = useMemo(() => {
        // First, build a definitive list of all facilities from the available data.
        const allFacilitiesMap = new Map();
        if (facilities && facilities.length > 0) {
            facilities.forEach(f => allFacilitiesMap.set(f.id, { id: f.id, name: f.name }));
        } else {
            // Fallback if facilities prop is empty
            users.forEach(u => {
                if (u.facilityId && u.facilityName && !allFacilitiesMap.has(u.facilityId)) {
                    allFacilitiesMap.set(u.facilityId, { id: u.facilityId, name: u.facilityName });
                }
            });
        }
        const allFacilities = Array.from(allFacilitiesMap.values());

        // Now, check for exit conditions.
        if (!activeProgram || allFacilities.length === 0) {
            return { facilityComplianceData: [], compliancePeriod: '' };
        }
    
        const now = new Date();
        const currentYear = now.getFullYear();
        let periodType, currentPeriod, periodString;
    
        const isPidsrProgram = activeProgram.name?.toUpperCase().includes("PIDSR");
        const isRabiesProgram = activeProgram.name?.toLowerCase().includes("rabies");
    
        if (isPidsrProgram || !isRabiesProgram) { // Default to weekly
            periodType = 'weekly';
            currentPeriod = getMorbidityWeek(now);
            periodString = `for Morbidity Week ${currentPeriod}`;
        } else { // Monthly for Rabies
            periodType = 'monthly';
            currentPeriod = now.getMonth() + 1;
            periodString = `for ${now.toLocaleString('default', { month: 'long' })}`;
        }
    
        const data = allFacilities.map(facility => {
            const isRequired = users.some(u => {
                if (u.facilityId !== facility.id || !u.assignedPrograms) return false;
                
                if (isPidsrProgram) {
                    const pidsrProgramIds = programs.filter(p => p.name?.toUpperCase().includes("PIDSR")).map(p => p.id);
                    return u.assignedPrograms.some(ap => pidsrProgramIds.includes(ap));
                }
                
                return u.assignedPrograms.includes(activeProgram.id);
            });
    
            if (!isRequired) {
                return { id: facility.id, name: facility.name, status: 'not-required' };
            }
    
            const relevantSubmissions = submissions.filter(sub => {
                const isCorrectFacility = sub.facilityId === facility.id;
                const isCorrectProgram = isPidsrProgram
                    ? (sub.programId === activeProgram.id || sub.programId === 'PIDSR')
                    : sub.programId === activeProgram.id;
    
                if (!isCorrectFacility || !isCorrectProgram) return false;
    
                if (periodType === 'monthly') {
                    return sub.submissionMonth === currentPeriod && sub.submissionYear === currentYear;
                } else { // weekly
                    return sub.morbidityWeek === currentPeriod && sub.submissionYear === currentYear;
                }
            });
    
            if (relevantSubmissions.length > 0) {
                if (relevantSubmissions.some(s => s.status === 'pending')) {
                     return { id: facility.id, name: facility.name, status: 'pending' };
                }
                if (relevantSubmissions.some(s => s.status === 'approved')) {
                     return { id: facility.id, name: facility.name, status: 'submitted' };
                }
                return { id: facility.id, name: facility.name, status: 'not-submitted' };
            }
    
            return { id: facility.id, name: facility.name, status: 'not-submitted' };
        });
    
        data.sort((a, b) => {
            const statusOrder = { 'not-submitted': 0, 'pending': 1, 'submitted': 2, 'not-required': 3 };
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            return a.name.localeCompare(b.name);
        });
    
        return { facilityComplianceData: data, compliancePeriod: periodString };
    
    }, [activeProgram, facilities, users, programs, submissions]);

    const filteredComplianceData = useMemo(() => {
        if (complianceFilter === 'all') {
            return facilityComplianceData;
        }
        return facilityComplianceData.filter(f => f.status === complianceFilter);
    }, [facilityComplianceData, complianceFilter]);


    const handleProcessSelected = (action, rejectionReason = '') => {
        const promise = processSubmission({
            submissionIds: selectedDocuments,
            newStatus: action,
            rejectionReason: action === 'rejected' ? rejectionReason : '',
        });

        toast.promise(promise, {
            loading: `${action === 'approved' ? 'Approving' : 'Rejecting'} ${selectedDocuments.length} reports...`,
            success: `Selected reports ${action} successfully!`,
            error: (err) => `Action failed: ${err.message}`,
        });

        setSelectedDocuments([]);
        setModalState({ type: null, data: null });
    };

    const handleToggleSelect = (docId) => {
        setSelectedDocuments(prev => 
            prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
        );
    };
    
    const STATUS_COLORS = {
        'Approved': '#10B981',
        'Pending': '#F59E0B',
        'Rejected': '#EF4444',
    };

    return (
        <div className="p-4 sm:p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">PHO Dashboard</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="bg-white p-5 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-gray-600 mb-4 text-center">Submissions Overview</h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-2 rounded-lg bg-green-50">
                                <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
                                <p className="text-xs font-medium text-green-700">Approved</p>
                            </div>
                            <div className="p-2 rounded-lg bg-yellow-50">
                                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
                                <p className="text-xs font-medium text-yellow-700">Pending</p>
                            </div>
                            <div className="p-2 rounded-lg bg-red-50">
                                <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
                                <p className="text-xs font-medium text-red-700">Rejected</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-5 rounded-lg shadow-md">
                        <ResponsiveContainer width="100%" height={250} key={activeProgramId}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name]} stroke={STATUS_COLORS[entry.name]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [value, name]}/>
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                    <div className="border-b border-gray-200">
                        <div className="overflow-x-auto scrollbar-hide">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                {programsToDisplayTabs.map((program) => (
                                    <button
                                        key={program.id}
                                        onClick={() => { setActiveProgramId(program.id); setSelectedDocuments([]); setExpandedBatch(null); }}
                                        className={`py-2 px-4 text-sm font-medium focus:outline-none whitespace-nowrap ${activeProgramId === program.id ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                    >
                                        {program.name}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    <div className="pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Pending Submissions</h2>
                            {selectedDocuments.length > 0 && (
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => setModalState({ type: 'batch_approve' })} className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600">Approve Selected ({selectedDocuments.length})</button>
                                    <button onClick={() => setModalState({ type: 'batch_reject' })} className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">Reject Selected ({selectedDocuments.length})</button>
                                </div>
                            )}
                        </div>
                        {pendingSubmissionsForTable.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facility</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {pendingSubmissionsForTable.map((sub) => (
                                            <React.Fragment key={sub.id}>
                                                <tr className="cursor-pointer hover:bg-gray-50" onClick={() => sub.isBatch && setExpandedBatch(expandedBatch === sub.id ? null : sub.id)}>
                                                    <td className="px-6 py-4 whitespace-nowrap">{sub.facilityName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{sub.userName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {sub.timestamp ? new Date(sub.timestamp.toDate()).toLocaleDateString() : "N/A"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {sub.isBatch ? (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                {expandedBatch === sub.id ? <ChevronDown className="w-4 h-4 mr-1.5" /> : <ChevronRight className="w-4 h-4 mr-1.5" />}
                                                                Batch of {sub.documents.length}
                                                            </span>
                                                        ) : (
                                                            <a href={sub.documents[0].fileURL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:underline">
                                                                <FileIcon className="w-4 h-4 mr-1.5" />
                                                                View File
                                                            </a>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedDocuments(sub.isBatch ? sub.documents.map(d => d.id) : [sub.id]); setModalState({ type: 'batch_approve' }); }} className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200 mr-2">
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedDocuments(sub.isBatch ? sub.documents.map(d => d.id) : [sub.id]); setModalState({ type: 'batch_reject' }); }} className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                                {sub.isBatch && expandedBatch === sub.id && (
                                                    <tr className="bg-gray-50">
                                                        <td colSpan="5" className="px-6 py-4">
                                                            <div className="pl-8">
                                                                <table className="min-w-full">
                                                                    <thead className="sr-only">
                                                                        <tr><th>Select</th><th>Disease</th><th>File</th><th>Actions</th></tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {sub.documents.map(doc => {
                                                                            const isSelected = selectedDocuments.includes(doc.id);
                                                                            return (
                                                                                <tr key={doc.id} className="border-b border-gray-200 last:border-b-0">
                                                                                    <td className="py-2 pr-4 w-12">
                                                                                        <input type="checkbox" className="rounded" checked={isSelected} onChange={() => handleToggleSelect(doc.id)} />
                                                                                    </td>
                                                                                    <td className="py-2 text-sm text-gray-800">{doc.diseaseName}</td>
                                                                                    <td className="py-2 text-sm">
                                                                                        {doc.isZeroCase ? (
                                                                                            <span className="italic text-gray-500">Zero Case Report</span>
                                                                                        ) : (
                                                                                            <a href={doc.fileURL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View File</a>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="py-2 text-right">
                                                                                        <button onClick={() => { setSelectedDocuments([doc.id]); setModalState({ type: 'batch_approve' }); }} className="p-1 rounded-full bg-green-100 text-green-600 hover:bg-green-200 mr-2"><Check className="w-4 h-4" /></button>
                                                                                        <button onClick={() => { setSelectedDocuments([doc.id]); setModalState({ type: 'batch_reject' }); }} className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200"><X className="w-4 h-4" /></button>
                                                                                    </td>
                                                                                </tr>
                                                                            )
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500">No pending submissions for the selected program.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* --- Recent Activity Feed --- */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Recent Activity</h2>
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

                {/* --- UPDATED: Facility Submission Status Widget --- */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-1 text-gray-700 flex items-center">
                        <ClipboardList className="w-6 h-6 text-gray-500 mr-2" />
                        Facility Submission Status
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Status for {activeProgram?.name} {compliancePeriod}
                    </p>

                    <div className="flex space-x-2 mb-4">
                        <button onClick={() => setComplianceFilter('all')} className={`px-3 py-1 text-sm rounded-full ${complianceFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'}`}>All ({facilityComplianceData.length})</button>
                        <button onClick={() => setComplianceFilter('submitted')} className={`px-3 py-1 text-sm rounded-full ${complianceFilter === 'submitted' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Submitted ({facilityComplianceData.filter(f=>f.status === 'submitted').length})</button>
                        <button onClick={() => setComplianceFilter('pending')} className={`px-3 py-1 text-sm rounded-full ${complianceFilter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Pending ({facilityComplianceData.filter(f=>f.status === 'pending').length})</button>
                        <button onClick={() => setComplianceFilter('not-submitted')} className={`px-3 py-1 text-sm rounded-full ${complianceFilter === 'not-submitted' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Not Submitted ({facilityComplianceData.filter(f=>f.status === 'not-submitted').length})</button>
                    </div>

                    <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin">
                        {filteredComplianceData.length > 0 ? filteredComplianceData.map((facility) => (
                            <div key={facility.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                <span className="font-medium text-gray-800">{facility.name}</span>
                                {facility.status === 'submitted' ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <CheckCircle className="w-4 h-4 mr-1.5" />
                                        Submitted
                                    </span>
                                ) : facility.status === 'pending' ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        <Clock className="w-4 h-4 mr-1.5" />
                                        Pending Approval
                                    </span>
                                ) : facility.status === 'not-submitted' ? (
                                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        <X className="w-4 h-4 mr-1.5" />
                                        Not Yet Submitted
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                        <MinusCircle className="w-4 h-4 mr-1.5" />
                                        Not Required
                                    </span>
                                )}
                            </div>
                        )) : (
                            <div className="text-center py-10">
                                <p className="text-gray-500">No facilities to display.</p>
                                <p className="text-xs text-gray-400 mt-2">This may be because no facilities are assigned to the '{activeProgram?.name}' program.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {(modalState.type === 'batch_approve') && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setModalState({ type: null, data: null })}
                    onConfirm={() => handleProcessSelected('approved')}
                    title={`Approve ${selectedDocuments.length} Reports?`}
                    message={`Are you sure you want to approve all ${selectedDocuments.length} selected reports? This action cannot be undone.`}
                />
            )}
            {(modalState.type === 'batch_reject') && (
                <RejectionModal
                    isOpen={true}
                    onClose={() => setModalState({ type: null, data: null })}
                    onConfirm={(reason) => handleProcessSelected('rejected', reason)}
                    title={`Reject ${selectedDocuments.length} Reports?`}
                />
            )}
        </div>
    );
};

export default PhoAdminDashboard;
