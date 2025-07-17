import React from "react";
import { Check, X } from "lucide-react";

const PhoAdminDashboard = ({ user, programs, submissions, users, onConfirm, onDeny }) => {
  const assignedPrograms = user.assignedPrograms || [];

  const pendingSubmissions = submissions.filter(
    (sub) => sub.status === "Waiting for Approval" && (assignedPrograms.length === 0 || assignedPrograms.includes(sub.programId))
  );

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">PHO Dashboard</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Pending Submissions</h2>
        {pendingSubmissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facility</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingSubmissions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{sub.facilityName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{sub.programName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{sub.userName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sub.timestamp ? new Date(sub.timestamp.toDate()).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a href={sub.fileURL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mr-4">
                        View File
                      </a>
                      <button onClick={() => onConfirm(sub.id)} className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200 mr-2">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDeny(sub.id)} className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No pending submissions.</p>
        )}
      </div>
    </div>
  );
};

export default PhoAdminDashboard;
