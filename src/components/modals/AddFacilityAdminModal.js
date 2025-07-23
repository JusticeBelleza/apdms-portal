// src/components/modals/AddFacilityAdminModal.js
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from 'firebase/firestore';
import { initializeApp } from "firebase/app";
import { auth as mainAuth, db } from '../../firebase/config'; // Use main instances for context

const AddFacilityAdminModal = ({ onClose, facilities }) => {
    const [formData, setFormData] = useState({
        facilityName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
        if (!formData.facilityName) {
            alert('Please select a facility.');
            return;
        }

        try {
            // Create a temporary, secondary auth instance to create a user without logging out the current admin
            // A unique name is required for each new app instance.
            const tempApp = initializeApp(mainAuth.app.options, `secondary-auth-${Date.now()}`);
            const tempAuth = getAuth(tempApp);

            const userCredential = await createUserWithEmailAndPassword(tempAuth, formData.email, formData.password);
            const newUser = userCredential.user;
            
            // Find the selected facility object from the facilities prop to get its ID
            const selectedFacility = facilities.find(facility => facility.name === formData.facilityName);

            if (!selectedFacility) {
                alert('Could not find the selected facility. Please try again.');
                return;
            }

            // Save the new user's details to Firestore
            await setDoc(doc(db, "users", newUser.uid), {
                id: newUser.uid,
                name: `${formData.facilityName} Admin`,
                email: formData.email,
                facilityName: formData.facilityName,
                // Add facilityId to the user document
                facilityId: selectedFacility.id, 
                role: 'Facility Admin',
                assignedPrograms: [],
                isActive: true
            });
            alert('Facility Admin created successfully!');
            onClose();
        } catch (error) {
            alert(`Error creating facility admin: ${error.message}`);
        }
    };
    
    // Group facilities by type for the dropdown
    const facilitiesByType = facilities.reduce((acc, facility) => {
        if (facility.name === 'Provincial Health Office') return acc; // Exclude PHO
        const type = facility.type || 'Uncategorized';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(facility);
        return acc;
    }, {});

    // Sort facilities within each type alphabetically by name
    for (const type in facilitiesByType) {
        facilitiesByType[type].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Get the keys (types) and sort them alphabetically
    const sortedTypes = Object.keys(facilitiesByType).sort((a, b) => a.localeCompare(b));


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Facility Admin</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Facility</label>
                        <select name="facilityName" value={formData.facilityName} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required>
                            <option value="">Select a Facility</option>
                            {sortedTypes.map(type => (
                                <optgroup label={type} key={type}>
                                    {facilitiesByType[type].map(facility => (
                                        <option key={facility.id} value={facility.name}>{facility.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Admin Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                        <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Facility Admin</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddFacilityAdminModal;
