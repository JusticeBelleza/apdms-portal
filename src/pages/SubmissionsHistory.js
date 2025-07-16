// src/pages/SubmissionsHistory.js
import React from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { Download, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast'; // Import toast

const SubmissionsHistory = ({ user, submissions, db }) => {
    // --- FIX: Sort by timestamp for reliability ---
    const userSubmissions = submissions
        .filter(s => s.facilityName === user.facilityName)
        .sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));

    const handleDeleteSubmission = async (submissionId) => {
        if (window.confirm('Are you sure you want to delete this unconfirmed submission? This action cannot be undone.')) {
            try {
                await deleteDoc(doc(db, "submissions", submissionId));
                toast.success('Submission deleted successfully!');
            } catch (error) {
                toast.error(`Error deleting submission: ${error.message}`);
            }
        }
    };
    
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Your Submission History</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Morbidity Week</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {userSubmissions.length > 0 ? userSubmissions.map(sub => (
                                <tr key={sub.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.programName}</td>
                                    {/* --- FIX: Display N/A for old records without a submissionDate --- */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.submissionDate ? new Date(sub.submissionDate).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.morbidityWeek}</td>
                                    {/* --- FIX: Use the correct field 'submittedByName' --- */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.submittedByName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        {sub.fileURL && (
                                            <a href={sub.fileURL} download={sub.fileName} target="_blank" rel="noopener noreferrer" className="p-2 text-primary hover:text-secondary inline-block">
                                                <Download className="w-5 h-5"/>
                                            </a>
                                        )}
                                        {/* Allow deletion only if the submission is not yet confirmed */}
                                        {!sub.confirmed && (
                                            <button onClick={() => handleDeleteSubmission(sub.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full inline-flex items-center">
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="text-center py-10 text-gray-500">
                                        No submissions found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SubmissionsHistory;