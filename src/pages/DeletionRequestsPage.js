// src/pages/DeletionRequestsPage.js
import React from 'react';
import { Ban, Check } from 'lucide-react';

const DeletionRequestsPage = ({ submissions, onApprove, onDeny }) => {
    const requests = submissions.filter(s => s.deletionRequest);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Deletion Requests</h1>
             <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Requested</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {requests.map(sub => (
                                <tr key={sub.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.programName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.facilityName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{sub.deletionRequest.requestedByName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(sub.deletionRequest.timestamp?.toDate()).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                                        <button onClick={() => onDeny(sub.id)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"><Ban className="w-5 h-5"/></button>
                                        <button onClick={() => onApprove(sub.id)} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Check className="w-5 h-5"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default DeletionRequestsPage;