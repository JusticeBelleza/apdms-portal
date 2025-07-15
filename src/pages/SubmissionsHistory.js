// src/pages/SubmissionsHistory.js
import React from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { Download, Trash2 } from 'lucide-react';

const SubmissionsHistory = ({ user, submissions, db }) => {
    const userSubmissions = submissions.filter(s => s.facilityName === user.facilityName)
        .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));

    const handleDeleteSubmission = async (submissionId) => {
        if (window.confirm('Are you sure you want to delete this submission?')) {
            await deleteDoc(doc(db, "submissions", submissionId));
        }
    };
    
    return (
        <div className="space-y-6"><h1 className="text-2xl md:text-3xl font-bold text-gray-800">Your Submission History</h1><div className="bg-white p-6 rounded-lg shadow-md"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Morbidity Week</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{userSubmissions.length > 0 ? userSubmissions.map(sub => (<tr key={sub.id}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.programName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.submissionDate}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.morbidityWeek}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.uploaderName}</td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">{sub.fileURL && <a href={sub.fileURL} download={sub.fileName} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-100 rounded-full inline-flex items-center"><Download className="w-4 h-4"/></a>}{!sub.confirmed && (<button onClick={() => handleDeleteSubmission(sub.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full inline-flex items-center"><Trash2 className="w-4 h-4"/></button>)}</td></tr>)) : (<tr><td colSpan="5" className="text-center py-10 text-gray-500">No submissions found.</td></tr>)}</tbody></table></div></div></div>
    );
};

export default SubmissionsHistory;