import React, { useState } from 'react';
import toast from 'react-hot-toast'; // Make sure toast is imported
import { logAudit, exportToCSV } from '../utils/helpers';
import { setDoc, doc, deleteDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { Download, PlusCircle, Building, ChevronDown, ChevronUp, Edit, Trash2 } from 'lucide-react';
import UserFormModal from '../components/modals/UserFormModal';
import AddFacilityAdminModal from '../components/modals/AddFacilityAdminModal';
import ConfirmationModal from '../components/modals/ConfirmationModal';

const UserManagementPage = ({ users, facilities, programs, currentUser, auth, db }) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showAddFacilityAdminModal, setShowAddFacilityAdminModal] = useState(false);
    const [expandedFacility, setExpandedFacility] = useState(null);

    // State for the confirmation modal
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    const isSuperAdmin = currentUser.role === 'Super Admin';
    const isPhoAdmin = currentUser.role === 'PHO Admin';
    const isFacilityAdmin = currentUser.role === 'Facility Admin';

    const phoUsers = users
        .filter(u => u.facilityName === 'Provincial Health Office' && u.role !== 'Super Admin')
        .sort((a,b) => a.name.localeCompare(b.name));

    const facilityUsersByFacility = users
        .filter(u => u.facilityName !== 'Provincial Health Office')
        .sort((a,b) => a.facilityName.localeCompare(b.name) || a.name.localeCompare(b.name))
        .reduce((acc, user) => {
            const { facilityName } = user;
            if (!acc[facilityName]) {
                acc[facilityName] = [];
            }
            acc[facilityName].push(user);
            return acc;
        }, {});
    
    const facilitiesToDisplay = isFacilityAdmin 
        ? Object.keys(facilityUsersByFacility).filter(name => name === currentUser.facilityName)
        : Object.keys(facilityUsersByFacility).sort();


    const handleAddUser = async (newUser) => {
        const toastId = toast.loading('Creating user...'); // Start loading toast
        try {
            const tempAuth = getAuth(initializeApp(auth.app.options, `secondary-auth-${Date.now()}`));
            const userCredential = await createUserWithEmailAndPassword(tempAuth, newUser.email, newUser.password);
            const user = userCredential.user;
            await setDoc(doc(db, "users", user.uid), {
                id: user.uid,
                name: newUser.name,
                email: newUser.email,
                facilityName: newUser.facilityName,
                role: newUser.role,
                assignedPrograms: newUser.assignedPrograms,
                isActive: true
            });
            await logAudit(db, currentUser, "Create User", { newUserName: newUser.name, newUserRole: newUser.role });
            toast.success('User added successfully.', { id: toastId }); // Success toast
            setShowAddModal(false);
        } catch (error) {
            toast.error(`Error adding user: ${error.message}`, { id: toastId }); // Error toast
        }
    };

    const handleEditUser = async (updatedUser) => {
        const toastId = toast.loading('Updating user...'); // Start loading toast
        try {
            const userDocRef = doc(db, "users", updatedUser.id);
            await setDoc(userDocRef, updatedUser, { merge: true });
            await logAudit(db, currentUser, "Edit User", { targetUserName: updatedUser.name });
            toast.success("User updated successfully.", { id: toastId }); // Success toast
            setShowEditModal(false);
            setEditingUser(null);
        } catch (error) {
            toast.error(`Error updating user: ${error.message}`, { id: toastId }); // Error toast
        }
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setShowEditModal(true);
    };

    // New delete process
    const initiateDelete = (user) => {
        setUserToDelete(user);
        setShowConfirmModal(true);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;

        const toastId = toast.loading('Deleting user...'); // Start loading toast
        const { id } = userToDelete;
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            return toast.error("Error: You must be logged in to perform this action.", { id: toastId });
        }

        try {
            const idToken = await firebaseUser.getIdToken(true);
            const functionUrl = 'https://us-central1-apdms-portal.cloudfunctions.net/deleteUser';

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ data: { uid: id } })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete user.');
            }

            const result = await response.json();
            // The Cloud Function deletes the user from Firestore now.
            // await deleteDoc(doc(db, "users", id)); 
            await logAudit(db, currentUser, "Permanently Delete User", { targetUserId: id });
            toast.success(result.data.message || 'User successfully deleted.', { id: toastId }); // Success toast
        } catch (error) {
            console.error("Error deleting user:", error);
            toast.error(`An error occurred: ${error.message}`, { id: toastId }); // Error toast
        } finally {
            setShowConfirmModal(false);
            setUserToDelete(null);
        }
    };

    const handleToggleUserStatus = async (user, isActive) => {
        const toastId = toast.loading(isActive ? "Deactivating user..." : "Activating user..."); // Start loading toast
        try {
            const userDocRef = doc(db, "users", user.id);
            await setDoc(userDocRef, { isActive: !isActive }, { merge: true });
            await logAudit(db, currentUser, isActive ? "Deactivate User" : "Activate User", { targetUserName: user.name });
            toast.success(`User has been ${isActive ? "deactivated" : "activated"}.`, { id: toastId }); // Success toast
        } catch(error) {
            toast.error(`Failed to update status: ${error.message}`, { id: toastId }); // Error toast
        }
    };

    const handleExport = () => {
        const dataToExport = users.map(({ password, ...rest }) => rest);
        exportToCSV(dataToExport, "users");
    };

    const canEditOrDelete = (targetUser) => {
        if (isSuperAdmin) return targetUser.id !== currentUser.id;
        if (isPhoAdmin) return targetUser.role === 'Facility Admin' || targetUser.role === 'Facility User';
        if (isFacilityAdmin) return targetUser.role === 'Facility User' && targetUser.facilityName === currentUser.facilityName;
        return false;
    }

    const UserRow = ({user}) => (
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3 px-4">
            <div>
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
                <p className="text-sm text-gray-600 md:hidden">{user.facilityName} - {user.role}</p>
            </div>
            <div className="flex items-center space-x-2 mt-2 md:mt-0">
                {user.role !== 'Super Admin' && (
                    <label htmlFor={`toggle-active-${user.id}`} className={`flex items-center ${user.id === currentUser.id ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <div className="relative">
                            <input
                                type="checkbox"
                                id={`toggle-active-${user.id}`}
                                className="sr-only"
                                checked={user.isActive}
                                onChange={() => handleToggleUserStatus(user, user.isActive)}
                                disabled={user.id === currentUser.id}
                            />
                            <div className={`block w-12 h-6 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${user.isActive ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                    </label>
                )}
                {canEditOrDelete(user) && <button onClick={() => openEditModal(user)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit className="w-4 h-4"/></button>}
                {canEditOrDelete(user) && <button onClick={() => initiateDelete(user)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 className="w-4 h-4"/></button>}
            </div>
        </div>
    );

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Manage Users</h1>
                    <div className="flex space-x-2">
                        {currentUser.permissions?.canExportData && (
                            <button onClick={handleExport} className="inline-flex items-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                                <Download className="w-5 h-5 md:mr-2" />
                                <span className="hidden md:inline">Export Users</span>
                            </button>
                        )}
                        {(isSuperAdmin || isPhoAdmin) && (
                            <button onClick={() => setShowAddFacilityAdminModal(true)} className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                                <Building className="w-5 h-5 md:mr-2"/>
                                <span className="hidden md:inline">Add Facility Admin</span>
                            </button>
                        )}
                        {(isSuperAdmin || isFacilityAdmin) && (
                            <button onClick={() => setShowAddModal(true)} className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                                <PlusCircle className="w-5 h-5 md:mr-2"/>
                                <span className="hidden md:inline">Add User</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    {isSuperAdmin && (
                        <>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">PHO Accounts</h3>
                            <div className="divide-y divide-gray-200 border rounded-lg">
                                {phoUsers.map(user => <UserRow key={user.id} user={user} />)}
                            </div>
                        </>
                    )}

                    <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Facility Accounts</h3>
                    <div className="space-y-2">
                        {facilitiesToDisplay.map(facilityName => (
                            <div key={facilityName} className="border rounded-lg">
                                <button onClick={() => setExpandedFacility(expandedFacility === facilityName ? null : facilityName)} className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-50">
                                    <span className="font-medium text-gray-800">{facilityName}</span>
                                    {expandedFacility === facilityName ? <ChevronUp /> : <ChevronDown />}
                                </button>
                                {expandedFacility === facilityName && (
                                    <div className="p-4 border-t bg-gray-50 divide-y divide-gray-200">
                                        {facilityUsersByFacility[facilityName].map(user => <UserRow key={user.id} user={user} />)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showConfirmModal && (
                <ConfirmationModal
                    isOpen={showConfirmModal}
                    onClose={() => setShowConfirmModal(false)}
                    onConfirm={confirmDeleteUser}
                    title="Delete User"
                    message={`Are you sure you want to permanently delete this user (${userToDelete?.email})? This action cannot be undone.`}
                />
            )}

            {showAddModal && <UserFormModal title="Add New User" onClose={() => setShowAddModal(false)} onSave={handleAddUser} facilities={facilities} programs={programs} currentUser={currentUser} auth={auth} db={db} />}
            {showEditModal && <UserFormModal title="Edit User" user={editingUser} onClose={() => setShowEditModal(false)} onSave={handleEditUser} facilities={facilities} programs={programs} currentUser={currentUser} auth={auth} db={db} />}
            {showAddFacilityAdminModal && <AddFacilityAdminModal onClose={() => setShowAddFacilityAdminModal(false)} facilities={facilities} />}
        </>
    );
};

export default UserManagementPage;