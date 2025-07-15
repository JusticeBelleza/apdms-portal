import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { deleteDoc, doc, collection, query, orderBy, limit, getDocs, startAfter, endBefore, limitToLast } from 'firebase/firestore';
import { PlusCircle, Download, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import AddFacilityModal from '../components/modals/AddFacilityModal';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import { exportToCSV } from '../utils/helpers';

const FacilityManagementPage = ({ user, db }) => {
    // Component State
    const [facilities, setFacilities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [facilityToDelete, setFacilityToDelete] = useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [firstVisible, setFirstVisible] = useState(null);
    const [lastVisible, setLastVisible] = useState(null);
    
    const facilitiesPerPage = 10;

    // Data fetching function
    const fetchFacilities = useCallback(async (pageDirection) => {
        setIsLoading(true);
        try {
            const facilitiesCollection = collection(db, "facilities");
            let q;

            if (pageDirection === 'next' && lastVisible) {
                q = query(facilitiesCollection, orderBy("name"), startAfter(lastVisible), limit(facilitiesPerPage));
            } else if (pageDirection === 'prev' && firstVisible) {
                q = query(facilitiesCollection, orderBy("name"), endBefore(firstVisible), limitToLast(facilitiesPerPage));
            } else {
                // Initial fetch
                q = query(facilitiesCollection, orderBy("name"), limit(facilitiesPerPage));
                setCurrentPage(1);
            }

            const documentSnapshots = await getDocs(q);
            const facilitiesData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (!documentSnapshots.empty) {
                setFacilities(facilitiesData.filter(f => f.name !== 'Provincial Health Office'));
                setFirstVisible(documentSnapshots.docs[0]);
                setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
            } else {
                if (pageDirection === 'next') {
                    setCurrentPage(prev => prev > 1 ? prev - 1 : 1);
                } else if (pageDirection === 'prev') {
                    // This case is handled by hiding the button on page 1
                }
            }
        } catch (error) {
            toast.error("Failed to fetch facilities.");
            console.error(error);
        }
        setIsLoading(false);
    }, [db, lastVisible, firstVisible]);

    useEffect(() => {
        fetchFacilities();
    }, [db]);

    const handleNextPage = () => {
        setCurrentPage(prev => prev + 1);
        fetchFacilities('next');
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
            fetchFacilities('prev');
        }
    };
    
    const handleDeleteClick = (facilityId) => {
        setFacilityToDelete(facilityId);
        setShowConfirmModal(true);
    };

    const confirmDeleteFacility = async () => {
        if (!facilityToDelete) return;
        try {
            await deleteDoc(doc(db, "facilities", facilityToDelete));
            toast.success('Facility deleted successfully!');
            fetchFacilities(); // Refresh the current page after deletion
        } catch (error) {
            toast.error(`Error deleting facility: ${error.message}`);
        } finally {
            setShowConfirmModal(false);
            setFacilityToDelete(null);
        }
    };

    const handleExport = () => {
        const dataToExport = facilities.map(({ id, ...rest }) => rest);
        exportToCSV(dataToExport, "facilities-page-" + currentPage);
    };
    
    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Manage Facilities</h1>
                    <div className="flex space-x-2">
                        <button onClick={handleExport} className="inline-flex items-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                            <Download className="w-5 h-5 md:mr-2" />
                            <span className="hidden md:inline">Export Page</span>
                        </button>
                        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                            <PlusCircle className="w-5 h-5 md:mr-2" />
                            <span className="hidden md:inline">Add Facility</span>
                        </button>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Existing Facilities</h2>
                    <div className="overflow-x-auto min-h-[400px]">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full"><p>Loading facilities...</p></div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility Type</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {facilities.map(facility => (
                                        <tr key={facility.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{facility.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{facility.type}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={() => handleDeleteClick(facility.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full inline-flex items-center">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    {/* --- UPDATED Pagination Controls --- */}
                    <div className="flex justify-center items-center space-x-4 mt-4">
                        {/* Only show "Previous" button if not on page 1 */}
                        {currentPage > 1 && (
                            <button 
                                onClick={handlePrevPage} 
                                disabled={isLoading}
                                className="inline-flex items-center px-3 md:px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-200">
                                <ChevronLeft className="w-5 h-5" />
                                <span className="hidden md:inline ml-2">Previous</span>
                            </button>
                        )}

                        <span className="text-sm text-gray-700">Page {currentPage}</span>

                        {/* Only show "Next" button if the current page is full */}
                        {facilities.length === facilitiesPerPage && (
                             <button 
                                onClick={handleNextPage} 
                                disabled={isLoading}
                                className="inline-flex items-center px-3 md:px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-200">
                                <span className="hidden md:inline mr-2">Next</span>
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={confirmDeleteFacility}
                title="Delete Facility"
                message="Are you sure you want to delete this facility? This action cannot be undone."
            />

            {showAddModal && <AddFacilityModal onClose={() => { setShowAddModal(false); fetchFacilities(); }} db={db} />}
        </>
    );
};

export default FacilityManagementPage;