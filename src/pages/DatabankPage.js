// src/pages/DatabankPage.js
import React, { useState, useMemo } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFileIcon } from '../utils/helpers';

const DatabankPage = ({ user, submissions, programs, facilities, db, onSuperAdminDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProgram, setSelectedProgram] = useState('');
    const [selectedFacility, setSelectedFacility] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState('');

    const handleRequestDeletion = async (subId) => {
        if (user.role === 'Super Admin') {
            onSuperAdminDelete(subId);
        } else {
            if (window.confirm("Are you sure you want to request deletion for this submission? A Super Admin will need to approve it.")) {
                try {
                    const subDocRef = doc(db, "submissions", subId);
                    await updateDoc(subDocRef, {
                        deletionRequest: {
                            requestedBy: user.uid,
                            requestedByName: user.name,
                            timestamp: serverTimestamp()
                        }
                    });
                    alert("Deletion requested. Awaiting Super Admin approval.");
                } catch (error) {
                    alert(`Error requesting deletion: ${error.message}`);
                }
            }
        }
    };

    const filteredSubmissions = useMemo(() => {
        let subs = submissions.filter(s => s.confirmed && !s.deletionRequest); // Only show confirmed and not pending deletion

        // Role-based filtering
        if (user.role === 'PHO Admin') {
            const assignedProgramNames = programs
                .filter(p => user.assignedPrograms.includes(p.id))
                .map(p => p.name);
            subs = subs.filter(s => assignedProgramNames.includes(s.programName));
        } else if (user.role === 'Facility Admin' || user.role === 'Facility User') {
            subs = subs.filter(s => s.facilityName === user.facilityName);
        }

        // UI filters
        if (searchTerm) {
            subs = subs.filter(s => 
                s.programName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.uploaderName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (selectedProgram) {
            subs = subs.filter(s => s.programName === selectedProgram);
        }
        if (selectedFacility) {
            subs = subs.filter(s => s.facilityName === selectedFacility);
        }
        if (selectedYear) {
            subs = subs.filter(s => new Date(s.submissionDate).getFullYear() === selectedYear);
        }
        if (selectedMonth) {
            subs = subs.filter(s => (new Date(s.submissionDate).getMonth() + 1) === parseInt(selectedMonth));
        }
        
        return subs.sort((a,b) => new Date(b.submissionDate) - new Date(a.submissionDate));

    }, [user, submissions, programs, searchTerm, selectedProgram, selectedFacility, selectedYear, selectedMonth]);

    const programOptions = [...new Set(programs.filter(p => p.active !== false).map(p => p.name))].sort();
    const facilityOptions = [...new Set(facilities.map(f => f.name))].sort();
    const monthOptions = [
        { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' }, 
        { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' }, 
        { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' }, 
        { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Databank</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                    <input 
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg md:col-span-1"
                    />
                    <select value={selectedProgram} onChange={e => setSelectedProgram(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-white">
                        <option value="">All Programs</option>
                        {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {user.role !== 'Facility Admin' && user.role !== 'Facility User' && (
                        <select value={selectedFacility} onChange={e => setSelectedFacility(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-white">
                            <option value="">All Facilities</option>
                            {facilityOptions.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    )}
                     <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="w-full px-4 py-2 border rounded-lg bg-white">
                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                        <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                    </select>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-white">
                        <option value="">All Months</option>
                        {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredSubmissions.map(sub => (
                                <tr key={sub.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.programName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.facilityName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.uploaderName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center">
                                        {getFileIcon(sub.fileName)}
                                        <span className="ml-2">{sub.fileName}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(sub.submissionDate).toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                                        <a href={sub.fileURL} download={sub.fileName} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-secondary inline-block">
                                            <Download className="w-5 h-5"/>
                                        </a>
                                        {(user.role === 'Super Admin' || user.role === 'PHO Admin') && (
                                            <button onClick={() => handleRequestDeletion(sub.id)} className="text-red-600 hover:text-red-800 inline-block">
                                                <Trash2 className="w-5 h-5"/>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
export default DatabankPage;