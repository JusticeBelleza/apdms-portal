import React, { useState, useMemo, useEffect } from "react";
import { Check, X, CheckCircle, Clock, AlertTriangle, MinusCircle } from "lucide-react";
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
    const [modalState, setModalState] = useState({ type: null, submissionId: null });

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

    // --- Data processing for both stats and the new pie chart ---
    const { stats, chartData } = useMemo(() => {
        if (!activeProgramId) {
            return { 
                stats: { total: 0, approved: 0, rejected: 0, pending: 0 },
                chartData: []
            };
        }

        const activeProgram = programs.find(p => p.id === activeProgramId);
        let filteredSubs = [];

        if (activeProgram) {
            if (activeProgram.name === "PIDSR Program") {
                const { start, end } = getMorbidityWeekRange();
                filteredSubs = submissions.filter(sub => {
                    const subDate = sub.timestamp?.toDate();
                    return sub.programId === activeProgramId && subDate >= start && subDate <= end;
                });
            } else if (activeProgram.name === "Rabies Program") {
                const { start, end } = getMonthRange();
                filteredSubs = submissions.filter(sub => {
                    const subDate = sub.timestamp?.toDate();
                    return sub.programId === activeProgramId && subDate >= start && subDate <= end;
                });
            } else {
                filteredSubs = submissions.filter(sub => sub.programId === activeProgramId);
            }
        }

        const calculatedStats = {
            total: filteredSubs.length,
            approved: filteredSubs.filter((sub) => sub.status === "approved").length,
            rejected: filteredSubs.filter((sub) => sub.status === "rejected").length,
            pending: filteredSubs.filter((sub) => sub.status === "pending").length,
        };

        const calculatedChartData = [
            { name: 'Approved', value: calculatedStats.approved },
            { name: 'Pending', value: calculatedStats.pending },
            { name: 'Rejected', value: calculatedStats.rejected },
        ].filter(item => item.value > 0);

        return { stats: calculatedStats, chartData: calculatedChartData };
    }, [submissions, programs, activeProgramId]);

    const pendingSubmissionsForTable = useMemo(() => {
        if (!activeProgramId) return [];
        return submissions.filter(sub =>
            sub.status === "pending" &&
            sub.programId === activeProgramId
        );
    }, [submissions, activeProgramId]);

    // --- NEW: Calculate facility compliance status ---
    const facilityCompliance = useMemo(() => {
        if (!activeProgramId || !users.length) return [];

        const activeProgram = programs.find(p => p.id === activeProgramId);
        if (!activeProgram) return [];

        // Determine the date range for the current period
        let startDate, endDate;
        if (activeProgram.name === "PIDSR Program") {
            const range = getMorbidityWeekRange();
            startDate = range.start;
            endDate = range.end;
        } else if (activeProgram.name === "Rabies Program") {
            const range = getMonthRange();
            startDate = range.start;
            endDate = range.end;
        } else {
            // For other programs, maybe we don't track compliance, or use a default like monthly
            const range = getMonthRange();
            startDate = range.start;
            endDate = range.end;
        }

        // Find all unique facilities that are assigned this program
        const relevantFacilities = [...new Set(
            users
                .filter(u => u.assignedPrograms?.includes(activeProgramId) && u.facilityName !== 'Provincial Health Office')
                .map(u => u.facilityName)
        )];

        return relevantFacilities.map(facilityName => {
            const facilitySubmissions = submissions.filter(s => 
                s.facilityName === facilityName && 
                s.programId === activeProgramId &&
                s.timestamp?.toDate() >= startDate &&
                s.timestamp?.toDate() <= endDate
            );

            if (facilitySubmissions.length > 0) {
                // Find the most recent submission for the period
                const latestSubmission = facilitySubmissions.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate())[0];
                return { name: facilityName, status: latestSubmission.status };
            } else {
                return { name: facilityName, status: 'Not Yet Submitted' };
            }
        });

    }, [activeProgramId, users, submissions, programs]);

    const handleConfirm = async () => {
        if (modalState.type !== 'approve' || !modalState.submissionId) return;
        const submissionId = modalState.submissionId;
        setModalState({ type: null, submissionId: null });

        const promise = processSubmission({ submissionId, newStatus: 'approved' });
        toast.promise(promise, {
            loading: 'Approving submission...',
            success: 'Submission approved successfully!',
            error: (err) => `Approval failed: ${err.message}`,
        });
    };

    const handleDeny = async (rejectionReason) => {
        if (modalState.type !== 'reject' || !modalState.submissionId) return;
        const submissionId = modalState.submissionId;
        setModalState({ type: null, submissionId: null });

        const promise = processSubmission({
            submissionId,
            newStatus: 'rejected',
            rejectionReason,
        });
        toast.promise(promise, {
            loading: 'Rejecting submission...',
            success: 'Submission rejected successfully!',
            error: (err) => `Rejection failed: ${err.message}`,
        });
    };
    
    const STATUS_COLORS = {
        'Approved': '#10B981', // Green
        'Pending': '#F59E0B',  // Yellow
        'Rejected': '#EF4444', // Red
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

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Left side: Stats and Pie Chart */}
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
                    
                    {/* Pie Chart */}
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
                                    isAnimationActive={true}
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

                {/* Right side: Tabs and Table */}
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                    <div className="border-b border-gray-200">
                        <div className="overflow-x-auto scrollbar-hide">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                {programsToDisplayTabs.map((program) => (
                                    <button
                                        key={program.id}
                                        onClick={() => setActiveProgramId(program.id)}
                                        className={`py-2 px-4 text-sm font-medium focus:outline-none whitespace-nowrap ${activeProgramId === program.id ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                    >
                                        {program.name}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    <div className="pt-6">
                        <h2 className="text-xl font-semibold mb-4">Pending Submissions</h2>
                        {pendingSubmissionsForTable.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facility</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {pendingSubmissionsForTable.map((sub) => (
                                            <tr key={sub.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">{sub.facilityName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">{sub.userName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {sub.timestamp ? new Date(sub.timestamp.toDate()).toLocaleDateString() : "N/A"}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <a href={sub.fileURL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mr-4">
                                                        View File
                                                    </a>
                                                    <button onClick={() => setModalState({ type: 'approve', submissionId: sub.id })} className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200 mr-2">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setModalState({ type: 'reject', submissionId: sub.id })} className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500">No pending submissions for the selected program.</p>
                        )}
                    </div>

                    {/* --- NEW: Facility Compliance Section --- */}
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

            {/* Modals */}
            {modalState.type === 'approve' && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setModalState({ type: null, submissionId: null })}
                    onConfirm={handleConfirm}
                    title="Confirm Approval"
                    message="Are you sure you want to approve this submission?"
                />
            )}
            {modalState.type === 'reject' && (
                <RejectionModal
                    isOpen={true}
                    onClose={() => setModalState({ type: null, submissionId: null })}
                    onConfirm={handleDeny}
                />
            )}
        </div>
    );
};

export default PhoAdminDashboard;
