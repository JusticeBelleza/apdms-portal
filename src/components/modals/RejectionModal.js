// src/components/modals/RejectionModal.js
import React, { useState } from 'react';
import { X, MessageSquareWarning } from 'lucide-react';

const RejectionModal = ({ isOpen, onClose, onConfirm }) => {
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!reason.trim()) {
            alert('Please provide a reason for rejection.');
            return;
        }
        onConfirm(reason);
        onClose(); // Close the modal after confirming
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <div className="flex items-start">
                    <div className="mr-4 flex-shrink-0">
                        <MessageSquareWarning className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Reason for Rejection</h2>
                        <p className="text-gray-600 mb-4">Please provide a clear reason for rejecting this submission. This will be sent to the facility.</p>
                    </div>
                </div>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    rows="4"
                    placeholder="e.g., Incorrect file format, missing data..."
                />
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button onClick={handleConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reject Submission</button>
                </div>
            </div>
        </div>
    );
};

export default RejectionModal;