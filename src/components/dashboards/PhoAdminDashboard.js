// src/components/dashboards/PhoAdminDashboard.js
import React, { useState, useMemo, useEffect } from "react";
import { Check, X } from "lucide-react";

// --- Helper Functions for Date Calculation ---
const getMorbidityWeekRange = () => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0); // Start of Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999); // End of Saturday
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

const PhoAdminDashboard = ({ user, programs, submissions, onConfirm, onDeny }) => {
    const assignedPrograms = useMemo(() => user.assignedPrograms || [], [user.assignedPrograms]);

    const programsToDisplayTabs = useMemo(() => {
        if (assignedPrograms.length === 0) {
            return programs;
        }
        return programs.filter(p => assignedPrograms.includes(p.id));
    }, [programs, assignedPrograms]);

    const [activeProgramId, setActiveProgramId] = useState(null);

    useEffect(() => {
        if (!activeProgramId && programsToDisplayTabs.length > 0) {
            setActiveProgramId(programsToDisplayTabs[0].id);
        }
    }, [programsToDisplayTabs, activeProgramId]);


    const stats = useMemo(() => {
        if (!activeProgramId) {
            return { total: 0, approved: 0, rejected: 0, pending: 0 };
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

        return {
            total: filteredSubs.length,
            approved: filteredSubs.filter((sub) => sub.status === "approved").length,
            rejected: filteredSubs.filter((sub) => sub.status === "rejected").length,
            pending: filteredSubs.filter((sub) => sub.status === "pending").length,
        };
    }, [submissions, programs, activeProgramId]);

    const pendingSubmissionsForTable = useMemo(() => {
        if (!activeProgramId) return [];
        return submissions.filter(sub =>
            sub.status === "pending" &&
            sub.programId === activeProgramId
        );
    }, [submissions, activeProgramId]);

    return (
        <div className="p-4 sm:p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">PHO Dashboard</h1>

            {/* Dynamic Stats Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-5 rounded-lg shadow-md text-center">
                    <h3 className="text-lg font-semibold text-gray-600">Total Submissions</h3>
                    <p className="text-4xl font-bold text-blue-600 mt-2">{stats.total}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-md text-center">
                    <h3 className="text-lg font-semibold text-gray-600">Pending</h3>
                    <p className="text-4xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-md text-center">
                    <h3 className="text-lg font-semibold text-gray-600">Approved</h3>
                    <p className="text-4xl font-bold text-green-600 mt-2">{stats.approved}</p>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-md text-center">
                    <h3 className="text-lg font-semibold text-gray-600">Rejected</h3>
                    <p className="text-4xl font-bold text-red-600 mt-2">{stats.rejected}</p>
                </div>
            </div>

            {/* Container for Tabs and Table */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                {/* Tab Navigation */}
                <div className="border-b border-gray-200">
                    <div className="overflow-x-auto hide-scrollbar"> {/* This hides scrollbar for tabs */}
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

                {/* Pending Submissions Table */}
                <div className="pt-6">
                    <h2 className="text-xl font-semibold mb-4">Pending Submissions</h2>
                    {pendingSubmissionsForTable.length > 0 ? (
                        <div className="overflow-x-auto hide-scrollbar"> {/* ADDED 'hide-scrollbar' here for the table */}
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
                                                <button onClick={() => onConfirm(sub.id)} className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200 mr-2">
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => onDeny(sub.id)} className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200">
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
            </div>
        </div>
    );
};

export default PhoAdminDashboard;