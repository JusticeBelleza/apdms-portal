import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { ShieldCheck } from 'lucide-react';
import ConfirmationModal from '../components/modals/ConfirmationModal'; // <-- THIS IS THE CORRECTED PATH

// Moved constants outside the component to fix the dependency warning
const ROLES = ['PHO Admin', 'Facility Admin', 'Viewer', 'Facility User'];
const PERMISSION_KEYS = [
    { key: 'canManageUsers', label: 'Manage Users' },
    { key: 'canManageFacilities', label: 'Manage Facilities' },
    { key: 'canManagePrograms', label: 'Manage Programs' },
    { key: 'canManagePermissions', label: 'Manage Permissions' },
    { key: 'canViewAuditLog', label: 'View Audit Log' },
    { key: 'canExportData', label: 'Export Data' },
    { key: 'canConfirmSubmissions', label: 'Confirm Submissions' },
];

const PermissionsManagement = ({ db }) => {
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    useEffect(() => {
        const fetchPermissions = async () => {
            setLoading(true);
            const perms = {};
            for (const role of ROLES) {
                const docRef = doc(db, "permissions", role);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    perms[role] = docSnap.data();
                } else {
                    perms[role] = PERMISSION_KEYS.reduce((acc, p) => ({ ...acc, [p.key]: false }), {});
                }
            }
            setPermissions(perms);
            setLoading(false);
        };
        fetchPermissions();
    }, [db]);

    const handlePermissionChange = (role, permissionKey) => {
        setPermissions(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [permissionKey]: !prev[role][permissionKey]
            }
        }));
    };

    const handleSavePermissions = async () => {
        const batch = writeBatch(db);
        for (const role in permissions) {
            const docRef = doc(db, "permissions", role);
            batch.set(docRef, permissions[role]);
        }
        await batch.commit();
        setShowConfirmModal(false);
        toast.success('Permissions updated successfully!');
    };

    if (loading) {
        return <div className="bg-white p-6 rounded-lg shadow-md">Loading permissions...</div>;
    }

    return (
        <>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Role Permissions</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                {PERMISSION_KEYS.map(p => (
                                    <th key={p.key} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{p.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {ROLES.map(role => (
                                <tr key={role}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{role}</td>
                                    {PERMISSION_KEYS.map(p => (
                                        <td key={p.key} className="px-6 py-4 whitespace-nowrap text-center">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                                checked={permissions[role]?.[p.key] || false}
                                                onChange={() => handlePermissionChange(role, p.key)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="text-right mt-4">
                    <button onClick={() => setShowConfirmModal(true)} className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-3 md:px-4 rounded-lg">
                        <ShieldCheck className="w-5 h-5 md:mr-2" />
                        <span className="hidden md:inline">Save Permissions</span>
                    </button>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={handleSavePermissions}
                title="Save Permissions"
                message="Are you sure you want to save these permission changes? This will affect all users with these roles."
            />
        </>
    );
};

export default PermissionsManagement;