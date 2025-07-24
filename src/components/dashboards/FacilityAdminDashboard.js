import React, { useMemo } from 'react';
import { CheckCircle, XCircle, Clock, CheckSquare } from 'lucide-react';
import { getMorbidityWeek } from '../../utils/helpers';

const FacilityAdminDashboard = ({ user, users, submissions, onlineStatuses, onNavigate, programs }) => {

    // Memoized calculation to find users belonging to the admin's facility.
    const facilityUsers = useMemo(() => {
        if (!user || !user.facilityId || !users) {
            return [];
        }
        return users.filter(u => u.facilityId === user.facilityId && u.id !== user.id);
    }, [user, users]);

    // --- NEW: Memoized calculation to get all programs assigned to anyone in the facility ---
    const facilityPrograms = useMemo(() => {
        if (!facilityUsers.length || !programs) return [];
        const assignedProgramIds = new Set(facilityUsers.flatMap(u => u.assignedPrograms || []));
        return programs.filter(p => assignedProgramIds.has(p.id));
    }, [facilityUsers, programs]);

    // --- UPDATED: Groups weekly submissions by program/batch ---
    const weeklySubmissions = useMemo(() => {
        if (!user || !user.facilityId || !submissions) {
            return [];
        }
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const submissionsThisWeek = submissions
            .filter(s => {
                const subDate = s.timestamp.toDate();
                return s.facilityId === user.facilityId && subDate >= startOfWeek && subDate <= endOfWeek;
            });

        // Group submissions by batchId or, if none, by individual document id
        const grouped = submissionsThisWeek.reduce((acc, sub) => {
            const key = sub.batchId || sub.id;
            if (!acc[key]) {
                acc[key] = {
                    id: key,
                    programName: sub.programName,
                    userName: sub.userName,
                    timestamp: sub.timestamp,
                    status: sub.status, // The status of all items in a batch will be the same initially
                };
            }
            return acc;
        }, {});

        // Convert the grouped object back to an array and sort by date
        return Object.values(grouped)
            .sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
    }, [user, submissions]);

    // --- UPDATED: This logic now calculates compliance per file for the current period ---
    const complianceStats = useMemo(() => {
        if (!user || !programs || !submissions || !facilityUsers.length) {
            return { approved: 0, rejected: 0, pending: 0, notSubmitted: 0, total: 0 };
        }

        const assignedProgramIds = new Set(facilityUsers.flatMap(u => u.assignedPrograms || []));
        const assignedPrograms = programs.filter(p => assignedProgramIds.has(p.id));

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentWeek = getMorbidityWeek(now);

        let submissionsForCurrentPeriod = [];
        let programsWithSubmissions = new Set();

        assignedPrograms.forEach(program => {
            const isPidsr = program.name?.toUpperCase().includes('PIDSR');
            const period = isPidsr 
                ? { type: 'weekly', week: currentWeek, year: currentYear }
                : { type: 'monthly', month: currentMonth, year: currentYear };

            const programSubmissions = submissions.filter(s =>
                s.facilityId === user.facilityId &&
                (s.programId === program.id || (isPidsr && s.programId === 'PIDSR')) &&
                s.submissionYear === period.year &&
                (period.type === 'monthly' ? s.submissionMonth === period.month : s.morbidityWeek === period.week)
            );

            if (programSubmissions.length > 0) {
                submissionsForCurrentPeriod.push(...programSubmissions);
                programsWithSubmissions.add(program.id);
            }
        });
        
        const approved = submissionsForCurrentPeriod.filter(s => s.status === 'approved').length;
        const rejected = submissionsForCurrentPeriod.filter(s => s.status === 'rejected').length;
        const pending = submissionsForCurrentPeriod.filter(s => s.status === 'pending').length;
        const notSubmitted = assignedPrograms.length - programsWithSubmissions.size;

        return { approved, rejected, pending, notSubmitted, total: assignedPrograms.length };
    }, [user, submissions, programs, facilityUsers]);

    const StatusBadge = ({ status }) => {
        const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full inline-flex items-center";
        switch (status) {
            case 'approved':
                return <span className={`${baseClasses} bg-green-100 text-green-800`}><CheckCircle className="w-3 h-3 mr-1"/>Approved</span>;
            case 'rejected':
                return <span className={`${baseClasses} bg-red-100 text-red-800`}><XCircle className="w-3 h-3 mr-1"/>Rejected</span>;
            case 'pending':
            default:
                return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}><Clock className="w-3 h-3 mr-1"/>Pending</span>;
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">{user.facilityName} Dashboard</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Compliance Overview */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4">Current Compliance Status ({complianceStats.total} Programs)</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-3xl font-bold text-green-600">{complianceStats.approved}</p>
                                <p className="text-sm font-medium text-green-700">Approved Files</p>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-lg">
                                <p className="text-3xl font-bold text-yellow-600">{complianceStats.pending}</p>
                                <p className="text-sm font-medium text-yellow-700">Pending Files</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg">
                                <p className="text-3xl font-bold text-red-600">{complianceStats.rejected}</p>
                                <p className="text-sm font-medium text-red-700">Rejected Files</p>
                            </div>
                             <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-3xl font-bold text-gray-600">{complianceStats.notSubmitted}</p>
                                <p className="text-sm font-medium text-gray-700">Programs Awaiting Submission</p>
                            </div>
                        </div>
                    </div>

                    {/* --- NEW: Program Assignment Matrix --- */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4">Program Assignment Matrix</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                    <tr>
                                        <th className="p-2">User</th>
                                        {facilityPrograms.map(program => (
                                            <th key={program.id} className="p-2 text-center">{program.name}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {facilityUsers.map(u => (
                                        <tr key={u.id} className="border-b last:border-b-0">
                                            <td className="p-2 font-medium text-gray-800">{u.name}</td>
                                            {facilityPrograms.map(program => (
                                                <td key={program.id} className="p-2 text-center">
                                                    {u.assignedPrograms?.includes(program.id) && (
                                                        <CheckSquare className="w-5 h-5 text-green-500 mx-auto" />
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* --- UPDATED: Recent Submissions moved into the main content column --- */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4">This Week's Activity</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-500">
                                    <tr>
                                        <th className="p-2">Program</th>
                                        <th className="p-2">User</th>
                                        <th className="p-2">Date</th>
                                        <th className="p-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {weeklySubmissions.length > 0 ? weeklySubmissions.map(sub => (
                                        <tr key={sub.id} className="border-t">
                                            <td className="p-2 font-medium text-gray-800">{sub.programName}</td>
                                            <td className="p-2">{sub.userName}</td>
                                            <td className="p-2">{sub.timestamp.toDate().toLocaleDateString()}</td>
                                            <td className="p-2"><StatusBadge status={sub.status} /></td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="4" className="text-center p-4 text-gray-500">No submissions this week.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar Area */}
                <div className="space-y-6">
                    {/* User Status */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4">User Status</h2>
                        <div className="space-y-3">
                            {facilityUsers.length > 0 ? facilityUsers.map(u => (
                                <div key={u.id} className="flex items-center justify-between p-2 rounded-md bg-gray-50">
                                    <p className="font-medium text-gray-700">{u.name}</p>
                                    <div className="flex items-center">
                                        <span className={`h-3 w-3 rounded-full mr-2 ${onlineStatuses[u.id] ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        <span className="text-xs text-gray-500">{onlineStatuses[u.id] ? 'Online' : 'Offline'}</span>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-gray-500">No other users in this facility.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FacilityAdminDashboard;
