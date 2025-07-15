// src/components/modals/AddFacilityModal.js
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';

const AddFacilityModal = ({ onClose, db }) => {
    const [facilityName, setFacilityName] = useState('');
    const [facilityType, setFacilityType] = useState('Primary Care Facility');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!facilityName) {
            alert('Facility name cannot be empty.');
            return;
        }

        try {
            const newFacility = {
                name: facilityName,
                type: facilityType,
            };
            await addDoc(collection(db, "facilities"), newFacility);
            alert('Facility added successfully!');
            onClose();
        } catch (error) {
            alert(`Error adding facility: ${error.message}`);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200">
                    <X className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Facility</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Facility Type</label>
                        <select value={facilityType} onChange={e => setFacilityType(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                            <option>Primary Care Facility</option>
                            <option>Government Hospital</option>
                            <option>Private Hospital</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Facility Name</label>
                        <input type="text" value={facilityName} onChange={e => setFacilityName(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" placeholder="e.g., Abra Provincial Hospital" required />
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Add Facility</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddFacilityModal;