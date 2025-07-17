import React, { useState, useEffect, useCallback } from "react";
import { Trash2, Loader, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, limit, startAfter } from "firebase/firestore";

const PAGE_SIZE = 15; // Number of submissions to load at a time

const SubmissionsHistory = ({ user, db, onDelete }) => {
  const [userSubmissions, setUserSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchSubmissions = useCallback((isInitialLoad = false) => {
    if (!user || !db) {
      setLoading(false);
      setError("User or database not available.");
      return;
    }

    if (isInitialLoad) {
      setLoading(true);
      setUserSubmissions([]);
      setLastDoc(null);
    } else {
      setLoadingMore(true);
    }

    let submissionsQuery = query(
      collection(db, "submissions"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(PAGE_SIZE)
    );

    if (!isInitialLoad && lastDoc) {
      submissionsQuery = query(submissionsQuery, startAfter(lastDoc));
    }

    const unsubscribe = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        const newSubmissions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        setLastDoc(lastVisible);
        
        setHasMore(newSubmissions.length === PAGE_SIZE);

        setUserSubmissions((prev) => isInitialLoad ? newSubmissions : [...prev, ...newSubmissions]);
        
        if (isInitialLoad) setLoading(false);
        setLoadingMore(false);
      },
      (err) => {
        console.error("Error fetching submission history:", err);
        setError("Failed to load submission history.");
        if (isInitialLoad) setLoading(false);
        setLoadingMore(false);
      }
    );

    return () => unsubscribe();
  }, [user, db, lastDoc]);

  useEffect(() => {
    fetchSubmissions(true);
  }, [user, db]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchSubmissions(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800";
      case "Waiting for Approval":
        return "bg-yellow-100 text-yellow-800";
      case "Rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">My Submissions History</h1>
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Submitted</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10">
                      <div className="flex justify-center items-center text-gray-500">
                        <Loader className="w-6 h-6 animate-spin mr-2" />
                        <span>Loading history...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10">
                       <div className="flex flex-col justify-center items-center text-red-500">
                        <AlertCircle className="w-8 h-8 mb-2" />
                        <span>{error}</span>
                      </div>
                    </td>
                  </tr>
                ) : userSubmissions.length > 0 ? (
                  userSubmissions.map((submission) => (
                    <tr key={submission.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{submission.programName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">{submission.fileName || "N/A"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {submission.timestamp ? new Date(submission.timestamp.toDate()).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(submission.status)}`}>
                          {submission.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button onClick={() => onDelete(submission.id)} className="p-2 text-red-600 rounded-full hover:bg-red-100 hover:text-red-800" title="Delete Submission">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                      You have not made any submissions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
           {hasMore && (
            <div className="p-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmissionsHistory;
