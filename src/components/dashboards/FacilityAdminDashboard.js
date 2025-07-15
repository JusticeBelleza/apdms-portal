// src/components/dashboards/FacilityAdminDashboard.js
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { getStatusForProgram } from '../../utils/helpers';

const FacilityAdminDashboard = ({ user, programs, submissions, users, onlineStatuses }) => {
    const facilityName = user.facilityName;
    const facilityUsers = users.filter(u => u.facilityName === facilityName && u.role === 'Facility User');
    const assignedProgramIds = [...new Set(facilityUsers.flatMap(u => u.assignedPrograms || []))];
    const facilityPrograms = programs.filter(p => assignedProgramIds.includes(p.id));

    const complianceData = facilityPrograms.map(p => {
        const status = getStatusForProgram(facilityName, p, submissions).text;
        return { name: p.name, status };
    });

    const statusCounts = complianceData.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, {});

    const pieData = [
        { name: 'Submitted', value: statusCounts['Submitted'] || 0 },
        { name: 'Pending', value: (statusCounts['Pending'] || 0) + (statusCounts['Pending Confirmation'] || 0) },
        { name: 'Overdue', value: statusCounts['Overdue'] || 0 },
    ];

    const COLORS = {
        Submitted: '#10b981',
        Pending: '#f59e0b',
        Overdue: '#ef4444',
    };

    return (
        <div className="space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">{facilityName} Dashboard</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Facility Compliance</h2>
                    <div style={{ width: '100%', height: 250 }}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </div>
                </div>
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">User Status</h2>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {facilityUsers.map(u => (
                            <div key={u.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                <p className="font-medium">{u.name}</p>
                                <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {u.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    <span className={`h-3 w-3 rounded-full ${onlineStatuses[u.id] ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
             <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Recent Submissions</h2>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {submissions.filter(s => s.facilityName === facilityName).slice(0, 5).map(s => {
                                const program = programs.find(p => p.name === s.programName);
                                const status = getStatusForProgram(facilityName, program, submissions);
                                return (
                                <tr key={s.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{s.programName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{s.uploaderName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{s.submissionDate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.style}`}>
                                            {status.icon}
                                            <span className="ml-1.5">{status.text}</span>
                                        </span>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
export default FacilityAdminDashboard;