// src/components/dashboards/PhoAdminDashboard.js
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Download, Ban, Check } from 'lucide-react';

// The 'onDeny' prop will now open the rejection modal
const PhoAdminDashboard = ({ user, programs, submissions, users, onConfirm, onDeny }) => {
    // Keep this for the chart, as it's still relevant to "My Programs"
    const assignedProgramIds = user.assignedPrograms || [];
    const myPrograms = programs.filter(p => assignedProgramIds.includes(p.id));
    const myProgramNames = myPrograms.map(p => p.name);

    // --- MODIFICATION START ---
    // Show all submissions pending confirmation to the PHO Admin
    const pendingSubmissions = submissions.filter(s =>
        !s.confirmed && s.status !== 'Rejected'
    );
    // --- MODIFICATION END ---

    const chartData = myPrograms.map(p => {
        const facilitiesForProgram = users.filter(u => u.assignedPrograms?.includes(p.id) && u.role === 'Facility User');
        
        const submittedFacilities = new Set(
            submissions
                .filter(s => s.programName === p.name && s.confirmed)
                .map(s => s.facilityName)
        );
        const submittedCount = submittedFacilities.size;

        return { name: p.name, Submitted: submittedCount, Pending: facilitiesForProgram.length - submittedCount };
    });
    
    return (
        <div className="space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">PHO Admin Dashboard</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">My Programs Compliance</h2>
                    <div style={{ width: '100%', height: 300 }}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Submitted" stackId="a" fill="#14b8a6" />
                            <Bar dataKey="Pending" stackId="a" fill="#f59e0b" />
                        </BarChart>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Pending Confirmations</h2>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {pendingSubmissions.length > 0 ? pendingSubmissions.map(sub => (
                            <div key={sub.id} className="bg-gray-50 p-3 rounded-md">
                                <p className="font-semibold">{sub.programName}</p>
                                <p className="text-sm text-gray-600">From: {sub.facilityName}</p>
                                <div className="flex justify-between items-center mt-2">
                                    <a href={sub.fileURL} download={sub.fileName} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Download className="w-5 h-5"/></a>
                                    <div className="flex space-x-2">
                                        {/* The onDeny function will now open the rejection modal */}
                                        <button onClick={() => onDeny(sub.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Ban className="w-5 h-5"/></button>
                                        {user.permissions?.canConfirmSubmissions && (
                                            <button onClick={() => onConfirm(sub.id)} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Check className="w-5 h-5"/></button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-gray-500 pt-10">No pending submissions.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default PhoAdminDashboard;