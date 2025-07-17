import React, { useState, useEffect } from "react";
import { Download, Loader, AlertCircle } from "lucide-react"; // Changed Trash2 to Download
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, startAfter } from "firebase/firestore";
import toast from "react-hot-toast";

const PAGE_SIZE = 15; // Number of submissions to load at a time

const SubmissionsHistory = ({ user, db }) => { // Removed onDelete from props
  const [userSubmissions, setUserSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // useEffect for the initial load and setting up the real-time listener
  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const submissionsQuery = query(
      collection(db, "submissions"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        const initialSubmissions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        setLastDoc(lastVisible);
        setUserSubmissions(initialSubmissions);
        setHasMore(initialSubmissions.length === PAGE_SIZE);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching submission history:", err);
        setError("Failed to load submission history.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, db]);

  // Function to handle loading more documents
  const handleLoadMore = async () => {
    if (!lastDoc || !hasMore) return;

    setLoadingMore(true);

    const nextQuery = query(
      collection(db, "submissions"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc"),
      startAfter(lastDoc),
      limit(PAGE_SIZE)
    );

    try {
      const documentSnapshots = await getDocs(nextQuery);
      const newSubmissions = documentSnapshots.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const lastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
      
      setUserSubmissions((prevSubmissions) => [...prevSubmissions, ...newSubmissions]);
      setLastDoc(lastVisible);
      setHasMore(newSubmissions.length === PAGE_SIZE);
    } catch (err) {
      console.error("Error loading more submissions:", err);
      setError("Could not load more items.");
    } finally {
      setLoadingMore(false);
    }
  };
  
  // Function to handle the file download
  const handleDownload = (fileURL, fileName) => {
    if (!fileURL) {
      toast.error("No file available for this submission.");
      return;
    }
    // Create a temporary link element to trigger the download
    const link = document.createElement('a');
    link.href = fileURL;
    link.target = '_blank'; // Open in a new tab to start download
    link.download = fileName || 'download'; // Suggest a filename
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    const styles = {
      "Approved": "bg-green-100 text-green-800",
      "Waiting for Approval": "bg-yellow-100 text-yellow-800",
      "Rejected": "bg-red-100 text-red-800",
      "default": "bg-gray-100 text-gray-800",
    };
    return styles[status] || styles.default;
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
                    <tr key={submission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{submission.programName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">{submission.fileName || "N/A"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {submission.timestamp?.toDate().toLocaleDateString() ?? "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(submission.status)}`}>
                          {submission.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                            onClick={() => handleDownload(submission.fileURL, submission.fileName)}
                            className="p-2 text-blue-600 rounded-full hover:bg-blue-100 hover:text-blue-800 disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors" 
                            title="Download Submission"
                            aria-label="Download Submission"
                            disabled={!submission.fileURL}
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                      You have not made any submissions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
           {(hasMore || loadingMore) && (
            <div className="p-4 text-center border-t border-gray-200">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore || !hasMore}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
              >
                {loadingMore ? (
                    <span className="flex items-center"><Loader className="w-5 h-5 animate-spin mr-2" /> Loading...</span>
                ) : hasMore ? (
                    "Load More"
                ) : (
                    "No More Submissions"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmissionsHistory;