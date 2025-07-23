import React, { useState, useMemo, useEffect } from "react";
import { Check, X, CheckCircle, Clock, AlertTriangle, MinusCircle, File as FileIcon, ChevronDown, ChevronRight } from "lucide-react";
import { getFunctions, httpsCallable } from 'firebase/functions';
import ConfirmationModal from '../modals/ConfirmationModal';
import RejectionModal from '../modals/RejectionModal';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

const PhoAdminDashboard = ({ user, programs = [], submissions = [], users = [] }) => {
    const [activeProgramId, setActiveProgramId] = useState(null);
    const [modalState, setModalState] = useState({ type: null, data: null });
    const [expandedBatch, setExpandedBatch] = useState(null);
    const [selectedDocuments, setSelectedDocuments] = useState([]);

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


    const facilityCompliance = useMemo(() => {
        if (!activeProgramId || !users.length || !activeProgram) return [];

        let startDate, endDate;
        const isPidsr = activeProgram.name.toUpperCase().includes("PIDSR");
        if (isPidsr) {
            const range = getMorbidityWeekRange();
            startDate = range.start;
            endDate = range.end;
        } else if (activeProgram.name.toUpperCase().includes("RABIES")) {
            const range = getMonthRange();
            startDate = range.start;
            endDate = range.end;
        } else {
            const range = getMonthRange();
            startDate = range.start;
            endDate = range.end;
        }

        const relevantFacilities = [...new Set(
            users
                .filter(u => u.assignedPrograms?.includes(activeProgramId) && u.facilityName !== 'Provincial Health Office')
                .map(u => u.facilityName)
        )];

        return relevantFacilities.map(facilityName => {
            const facilitySubmissions = submissions.filter(s => 
                s.facilityName === facilityName && 
                (s.programId === activeProgramId || (isPidsr && s.programId === 'PIDSR')) &&
                s.timestamp?.toDate() >= startDate &&
                s.timestamp?.toDate() <= endDate
            );

            if (facilitySubmissions.length > 0) {
                const latestSubmission = facilitySubmissions.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate())[0];
                return { name: facilityName, status: latestSubmission.status };
            } else {
                return { name: facilityName, status: 'Not Yet Submitted' };
            }
        });

    }, [activeProgramId, users, submissions, activeProgram]);

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

    const ComplianceStatusBadge = ({ status }) => {
        const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full inline-flex items-center";
        switch (status) {
            case 'approved':
                return <span className={`${baseClasses} bg-green-100 text-green-800`}><CheckCircle className="w-3 h-3 mr-1"/>Approved</span>;
            case 'pending':
                return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}><Clock className="w-3 h-3 mr-1"/>Pending Approval</span>;
            case 'rejected':
                return <span className={`${baseClasses} bg-red-100 text-red-800`}><AlertTriangle className="w-3 h-3 mr-1"/>Rejected</span>;
            case 'Not Yet Submitted':
            default:
                return <span className={`${baseClasses} bg-gray-100 text-gray-800`}><MinusCircle className="w-3 h-3 mr-1"/>Not Yet Submitted</span>;
        }
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

                    <div className="pt-6 mt-6 border-t">
                        <h2 className="text-xl font-semibold mb-4">Facility Compliance</h2>
                        {facilityCompliance.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facility Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status for Period</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {facilityCompliance.map((facility) => (
                                            <tr key={facility.name}>
                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{facility.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <ComplianceStatusBadge status={facility.status} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500">No facilities are assigned to this program.</p>
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
