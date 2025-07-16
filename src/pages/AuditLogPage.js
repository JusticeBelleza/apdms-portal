import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { Search } from 'lucide-react';

const AuditLogPage = ({ db }) => {
    const [logs, setLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // --- State for Pagination ---
    const [lastVisible, setLastVisible] = useState(null);
    const [isLastPage, setIsLastPage] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch the first page of logs
    useEffect(() => {
        const fetchFirstPage = async () => {
            setIsLoading(true);
            try {
                const logsCollection = collection(db, "audit_logs");
                const firstPageQuery = query(logsCollection, orderBy("timestamp", "desc"), limit(30));
                const documentSnapshots = await getDocs(firstPageQuery);

                const firstPageLogs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setLogs(firstPageLogs);

                // Set the last visible document for the next page's cursor
                const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
                setLastVisible(lastDoc);

                // Check if this is the last page
                if (documentSnapshots.docs.length < 30) {
                    setIsLastPage(true);
                } else {
                    setIsLastPage(false);
                }
            } catch (error) {
                toast.error("Failed to fetch audit logs.");
                console.error("Error fetching audit logs:", error);
            }
            setIsLoading(false);
        };

        fetchFirstPage();
    }, [db]);
    
    // Function to fetch the next page
    const fetchNextPage = async () => {
        if (!lastVisible) return; // Should not happen if not the last page
        
        setIsLoading(true);
        try {
            const logsCollection = collection(db, "audit_logs");
            const nextPageQuery = query(logsCollection, orderBy("timestamp", "desc"), startAfter(lastVisible), limit(30));
            const documentSnapshots = await getDocs(nextPageQuery);

            const nextPageLogs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLogs(prevLogs => [...prevLogs, ...nextPageLogs]); // Append new logs

            const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
            setLastVisible(lastDoc);

            if (documentSnapshots.docs.length < 30) {
                setIsLastPage(true);
            }
        } catch (error) {
            toast.error("Failed to fetch next page.");
            console.error("Error fetching next page:", error);
        }
        setIsLoading(false);
    };

    const filteredLogs = logs.filter(log =>
        Object.values(log).some(value =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <div className="space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Audit Log</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
                 <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search logs on the current page..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredLogs.map(log => (
                                <tr key={log.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.timestamp?.toDate()).toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.userName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.userRole}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.action}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.details ? JSON.stringify(log.details) : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-center items-center mt-6">
                    {!isLastPage && (
                        <button
                            onClick={fetchNextPage}
                            disabled={isLoading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-secondary disabled:bg-gray-400"
                        >
                            {isLoading ? 'Loading...' : 'Load More'}
                        </button>
                    )}
                    {isLastPage && logs.length > 0 && (
                        <p className="text-sm text-gray-500">You've reached the end of the logs.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditLogPage;