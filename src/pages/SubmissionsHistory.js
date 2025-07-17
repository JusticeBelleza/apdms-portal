import React from 'react';
import { Download } from 'lucide-react';

const SubmissionsHistory = ({ user, submissions }) => {
    // Show relevant submissions based on user role.
    const filteredSubmissions = submissions.filter(s => {
        if (user.role === 'PHO Admin') {
            return s.confirmed;
        }
        return s.facilityName === user.facilityName;
    });

    const userSubmissions = filteredSubmissions
        .sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
    
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Submission History</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th>
                                {user.role === 'PHO Admin' && (
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility</th>
                                )}
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission Date & Time</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zero Report</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {userSubmissions.length > 0 ? userSubmissions.map(sub => (
                                <tr key={sub.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.programName}</td>
                                    {user.role === 'PHO Admin' && (
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.facilityName}</td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.timestamp?.toDate().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            sub.confirmed ? 'bg-green-100 text-green-800' :
                                            sub.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {sub.confirmed ? 'Approved' : sub.status || 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.submittedByName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {sub.isZeroReport ? 'Yes' : 'No'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {sub.fileURL && (
                                            <a href={sub.fileURL} download={sub.fileName} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:text-blue-800 inline-block">
                                                <Download className="w-5 h-5"/>
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={user.role === 'PHO Admin' ? 7 : 6} className="text-center py-10 text-gray-500">
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
