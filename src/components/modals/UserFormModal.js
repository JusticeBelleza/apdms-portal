// src/components/modals/UserFormModal.js
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { initializeApp } from "firebase/app";

const UserFormModal = ({ title, user, onClose, onSave, facilities, programs, currentUser }) => {
    const isSuperAdmin = currentUser.role === 'Super Admin';
    const isPhoAdmin = currentUser.role === 'PHO Admin';
    const isFacilityAdmin = currentUser.role === 'Facility Admin';

    const getInitialFormData = () => {
        if (user) { // Editing existing user
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                password: '',
                confirmPassword: '',
                facilityName: user.facilityName,
                facilityId: user.facilityId, // Ensure existing facilityId is carried over
                role: user.role,
                assignedPrograms: user.assignedPrograms || []
            };
        } else { // Adding new user
            let initialRole = 'Facility User';
            let initialFacility = '';
            if (isSuperAdmin) {
                initialRole = 'PHO Admin';
                initialFacility = 'Provincial Health Office';
            } else if (isFacilityAdmin) {
                initialFacility = currentUser.facilityName;
            }
            return {
                id: null,
                name: '',
                email: '',
                password: '',
                confirmPassword: '',
                facilityName: initialFacility,
                facilityId: null, // Initialize facilityId
                role: initialRole,
                assignedPrograms: []
            };
        }
    };

    const [formData, setFormData] = useState(getInitialFormData());

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'role') {
            const isPhoRole = value === 'PHO Admin' || value === 'Viewer';
            setFormData(prev => ({
                ...prev,
                [name]: value,
                facilityName: isPhoRole ? 'Provincial Health Office' : ''
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleToggleProgram = (programId) => {
        setFormData(prev => {
            const assigned = prev.assignedPrograms;
            if (assigned.includes(programId)) {
                return { ...prev, assignedPrograms: assigned.filter(id => id !== programId) };
            } else {
                return { ...prev, assignedPrograms: [...assigned, programId] };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
        if (!user && !formData.password) {
            alert('Password field cannot be empty for new users.');
            return;
        }

        // --- Start of Fix ---
        // Create a copy of the form data to be saved.
        const dataToSave = { ...formData };

        // If the role is facility-related, find the corresponding facilityId.
        if (dataToSave.facilityName) {
            const selectedFacility = facilities.find(facility => facility.name === dataToSave.facilityName);
            if (selectedFacility) {
                dataToSave.facilityId = selectedFacility.id;
            } else {
                 // Handle case where facility might not be found, though this is unlikely with a dropdown.
                alert('Selected facility is not valid.');
                return;
            }
        }
        // --- End of Fix ---
        
        onSave(dataToSave);
    };

    const renderRoleOptions = () => {
        if (isSuperAdmin) {
            return (
                <>
                    <option>PHO Admin</option>
                    <option>Viewer</option>
                    <option>Facility Admin</option>
                    <option>Facility User</option>
                </>
            );
        }
        if (isPhoAdmin) {
             return (
                <>
                    <option>Facility Admin</option>
                    <option>Facility User</option>
                </>
            );
        }
        if (isFacilityAdmin) {
            return <option>Facility User</option>;
        }
        return null;
    };
    
    const isFacilityRole = formData.role === 'Facility Admin' || formData.role === 'Facility User';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button>
                <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required disabled={!!user} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" placeholder={user ? "Leave blank to keep current" : "Set initial password"} required={!user} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                        <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" placeholder="Confirm password" required={!user || formData.password} />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Role</label>
                        <select name="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" disabled={!!user && !isSuperAdmin}>
                            {renderRoleOptions()}
                        </select>
                    </div>

                    {isFacilityRole && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Facility</label>
                            <select 
                                name="facilityName" 
                                value={formData.facilityName} 
                                onChange={handleChange} 
                                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" 
                                disabled={isFacilityAdmin || (!!user && !isSuperAdmin)}
                            >
                                <option value="">Select a Facility</option>
                                {facilities.filter(f => f.name !== 'Provincial Health Office').map(f => (
                                    <option key={f.id} value={f.name}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {(isSuperAdmin || (isFacilityAdmin && user?.role === 'Facility User')) && (
                         <div className="border-t pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Health Programs</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {programs.map(program => (
                                    <div key={program.id} className="flex items-center justify-between">
                                        <span>{program.name}</span>
                                        <label htmlFor={`user-toggle-${program.id}`} className="flex items-center cursor-pointer">
                                            <div className="relative">
                                                <input type="checkbox" id={`user-toggle-${program.id}`} className="sr-only" checked={formData.assignedPrograms.includes(program.id)} onChange={() => handleToggleProgram(program.id)} />
                                                <div className={`block w-12 h-6 rounded-full ${formData.assignedPrograms.includes(program.id) ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${formData.assignedPrograms.includes(program.id) ? 'transform translate-x-6' : ''}`}></div>
                                            </div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Save User</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default UserFormModal;
