// src/components/modals/ProgramFormModal.js
import React, { useState } from 'react';
import { X } from 'lucide-react';

const ProgramFormModal = ({ program, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: program?.name || '',
        frequency: program?.frequency || 'Monthly',
        type: program?.type || 'upload',
        reportTypes: program?.reportTypes || ['Quarterly', 'Annual'],
    });

    const allReportTypes = ['Morbidity Week', 'Morbidity Month', 'Morbidity Year', 'Quarterly', 'Annual'];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleReportTypeChange = (e) => {
        const { options } = e.target;
        const selectedTypes = [];
        for (let i = 0, l = options.length; i < l; i++) {
            if (options[i].selected) {
                selectedTypes.push(options[i].value);
            }
        }
        setFormData(prev => ({ ...prev, reportTypes: selectedTypes }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button>
                <h2 className="text-xl font-bold text-gray-800 mb-4">{program ? 'Edit' : 'Add'} Program</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Program Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Frequency</label>
                            <select name="frequency" value={formData.frequency} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                                <option>Weekly</option>
                                <option>Monthly</option>
                                <option>Quarterly</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Submission Type</label>
                            <select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                                <option value="upload">File Upload</option>
                                <option value="external">Mark as Submitted</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Report Types</label>
                        <select multiple value={formData.reportTypes} onChange={handleReportTypeChange} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm">
                            {allReportTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Save Program</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ProgramFormModal;