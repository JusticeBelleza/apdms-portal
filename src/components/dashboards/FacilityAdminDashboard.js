import React, { useMemo } from 'react';
import { Users, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

const FacilityAdminDashboard = ({ user, users, submissions, onlineStatuses, onNavigate }) => {

    // Memoized calculation to find users belonging to the admin's facility.
    const facilityUsers = useMemo(() => {
        if (!user || !user.facilityId || !users) {
            return [];
        }
        return users.filter(u => u.facilityId === user.facilityId && u.id !== user.id);
    }, [user, users]);

    // Memoized calculation for recent submissions from the facility.
    const recentSubmissions = useMemo(() => {
        if (!user || !user.facilityId || !submissions) {
            return [];
        }
        return submissions
            .filter(s => s.facilityId === user.facilityId)
            .sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate())
            .slice(0, 5); // Get the 5 most recent submissions
    }, [user, submissions]);

    // Memoized calculation for compliance stats for the current month.
    const complianceStats = useMemo(() => {
        if (!user || !user.facilityId || !submissions) {
            return { approved: 0, rejected: 0, pending: 0 };
        }
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const facilitySubmissionsThisMonth = submissions.filter(s => 
            s.facilityId === user.facilityId && s.timestamp.toDate() >= startOfMonth
        );

        return {
            approved: facilitySubmissionsThisMonth.filter(s => s.status === 'approved').length,
            rejected: facilitySubmissionsThisMonth.filter(s => s.status === 'rejected').length,
            pending: facilitySubmissionsThisMonth.filter(s => s.status === 'pending').length,
        };
    }, [user, submissions]);

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
                        <h2 className="text-xl font-semibold mb-4">This Month's Compliance</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-3xl font-bold text-green-600">{complianceStats.approved}</p>
                                <p className="text-sm font-medium text-green-700">Approved</p>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-lg">
                                <p className="text-3xl font-bold text-yellow-600">{complianceStats.pending}</p>
                                <p className="text-sm font-medium text-yellow-700">Pending</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg">
                                <p className="text-3xl font-bold text-red-600">{complianceStats.rejected}</p>
                                <p className="text-sm font-medium text-red-700">Rejected</p>
                            </div>
                        </div>
                    </div>

                    {/* Recent Submissions */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4">Recent Submissions</h2>
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
                                    {recentSubmissions.length > 0 ? recentSubmissions.map(sub => (
                                        <tr key={sub.id} className="border-t">
                                            <td className="p-2 font-medium text-gray-800">{sub.programName}</td>
                                            <td className="p-2">{sub.userName}</td>
                                            <td className="p-2">{sub.timestamp.toDate().toLocaleDateString()}</td>
                                            <td className="p-2"><StatusBadge status={sub.status} /></td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="4" className="text-center p-4 text-gray-500">No recent submissions.</td>
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
