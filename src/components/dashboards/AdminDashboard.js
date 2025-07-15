// src/components/dashboards/AdminDashboard.js
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { CheckCircle2, Clock, FileText, User, Search } from 'lucide-react';
import { getStatusForProgram } from '../../utils/helpers';

const AdminDashboard = ({ facilities, programs, submissions, users, onConfirm, user, onNavigate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProgramId, setSelectedProgramId] = useState('');

    useEffect(() => {
        if (programs.length > 0 && !selectedProgramId) {
            setSelectedProgramId(programs[0].id);
        }
    }, [programs, selectedProgramId]);
    
    const selectedProgram = useMemo(() => programs.find(p => p.id === selectedProgramId), [programs, selectedProgramId]);

    const deletionRequests = useMemo(() => submissions.filter(s => s.deletionRequest), [submissions]);

    const filteredFacilities = useMemo(() => {
        if (!selectedProgram) return [];
        
        const applicableFacilityNames = new Set(
            users
                .filter(u => u.role === 'Facility User' && (u.assignedPrograms || []).includes(selectedProgram.id))
                .map(u => u.facilityName)
        );

        return facilities.filter(f => applicableFacilityNames.has(f.name));
    }, [selectedProgram, facilities, users]);

    const complianceData = useMemo(() => {
        if (!selectedProgram) {
            return { totalSubmitted: 0, totalPending: 0, complianceRate: 0, totalFacilities: 0, chartData: [] };
        }

        const submittedFacilities = new Set(
            submissions
                .filter(s => s.programName === selectedProgram.name && s.confirmed)
                .map(s => s.facilityName)
        );
        
        const totalSubmitted = submittedFacilities.size;
        const totalFacilities = filteredFacilities.length;
        const totalPending = totalFacilities - totalSubmitted;
        const complianceRate = totalFacilities > 0 ? ((totalSubmitted / totalFacilities) * 100).toFixed(1) : 0;
        
        const statsByType = filteredFacilities.reduce((acc, facility) => {
            const type = facility.type || 'Uncategorized';
            if (!acc[type]) {
                acc[type] = { total: 0, submitted: 0 };
            }
            acc[type].total += 1;
            if (submittedFacilities.has(facility.name)) {
                acc[type].submitted += 1;
            }
            return acc;
        }, {});
        
        const chartData = Object.keys(statsByType).map(type => ({
            name: type,
            Submitted: statsByType[type].submitted,
            Pending: statsByType[type].total - statsByType[type].submitted
        }));

        return { totalSubmitted, totalPending, complianceRate, totalFacilities, chartData };
    }, [selectedProgram, submissions, filteredFacilities]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Provincial Compliance Dashboard</h1>
                 <select 
                     value={selectedProgramId} 
                     onChange={e => setSelectedProgramId(e.target.value)}
                     className="mt-1 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                 >
                     {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
            </div>
            
            {deletionRequests.length > 0 && (
                 <div className="bg-red-50 border border-red-200 p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-red-800">Deletion Requests ({deletionRequests.length})</h2>
                        <button onClick={() => onNavigate('deletion-requests')} className="text-sm font-medium text-primary hover:underline">Manage Requests</button>
                    </div>
                    <p className="text-red-700">There are submissions marked for deletion that require your approval.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-teal-100"><CheckCircle2 className="w-6 h-6 text-primary" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Compliance Rate</p>
                        <p className="text-2xl font-bold text-gray-800">{complianceData.complianceRate}%</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-green-100"><FileText className="w-6 h-6 text-green-600" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Total Submitted</p>
                        <p className="text-2xl font-bold text-gray-800">{complianceData.totalSubmitted}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-yellow-100"><Clock className="w-6 h-6 text-yellow-600" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Total Pending/Overdue</p>
                        <p className="text-2xl font-bold text-gray-800">{complianceData.totalPending}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full bg-blue-100"><User className="w-6 h-6 text-blue-600" /></div>
                    <div className="ml-4">
                        <p className="text-sm text-gray-500">Reporting Facilities</p>
                        <p className="text-2xl font-bold text-gray-800">{complianceData.totalFacilities}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Compliance by Facility Type</h2>
                <div style={{ width: '100%', height: 300 }}>
                    <BarChart data={complianceData.chartData}>
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
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Facility Submission Status</h2>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" placeholder="Search for a facility..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"/>
                </div>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {filteredFacilities.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).map(facility => {
                        if (!selectedProgram) return null;
                        const status = getStatusForProgram(facility.name, selectedProgram, submissions);
                        return (
                            <div key={facility.id} className="border rounded-lg p-4 flex justify-between items-center">
                                <div className="flex items-center">
                                    <span className="font-medium text-gray-800">{facility.name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {status.isActionable && <a href={status.fileURL} download={status.fileName} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">View Proof</a>}
                                    {status.isActionable && user.permissions?.canConfirmSubmissions && <button onClick={() => onConfirm(status.submissionId)} className="text-sm bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">Confirm</button>}
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.style}`}>{status.icon}<span className="ml-1.5">{status.text}</span></span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};
export default AdminDashboard;