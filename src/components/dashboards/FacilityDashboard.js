// src/components/dashboards/FacilityDashboard.js
import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { getStatusForProgram } from '../../utils/helpers';
import UploadModal from '../modals/UploadModal'; // We created this earlier
import { addDoc, collection } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from '../../firebase/config';

const FacilityDashboard = ({ user, allPrograms, submissions, db }) => {
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);

    const handleUploadClick = (program) => { setSelectedProgram(program); setShowUploadModal(true); };

    const handleFileUpload = async (file, morbidityWeek) => {
        if (!file || !selectedProgram) return;

        const fileRef = storageRef(storage, `submissions/${user.facilityName}/${selectedProgram.name}/${morbidityWeek}/${file.name}`);
        
        try {
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const newSubmission = {
                facilityName: user.facilityName,
                programName: selectedProgram.name,
                submissionDate: new Date().toISOString(),
                status: 'Pending Confirmation',
                fileURL: downloadURL, 
                fileName: file.name,
                confirmed: false,
                uploaderName: user.name,
                morbidityWeek: morbidityWeek,
            };

            await addDoc(collection(db, "submissions"), newSubmission);
            
            setShowUploadModal(false);
            setSelectedProgram(null);
            alert(`Proof for "${selectedProgram.name}" uploaded successfully for Morbidity Week ${morbidityWeek}. Pending PHO confirmation.`);
        } catch (error) {
            console.error("Error uploading file:", error);
            alert(`File upload failed: ${error.message}`);
        }
    };

    const userPrograms = allPrograms.filter(p => p.active && user.assignedPrograms.includes(p.id));

    return (
        <div className="space-y-6"><h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Your Reporting Dashboard</h1><div className="bg-white p-6 rounded-lg shadow-md"><h2 className="text-xl font-semibold mb-4 text-gray-700">Reporting Obligations Checklist</h2><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{userPrograms.map(program => { const status = getStatusForProgram(user.facilityName, program, submissions); return (<tr key={program.id} className={status.text === 'Overdue' ? 'bg-red-50' : ''}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{program.name}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{program.frequency}</td><td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.style}`}>{status.icon}<span className="ml-1.5">{status.text}</span></span></td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{program.type === 'upload' ? (<button onClick={() => handleUploadClick(program)} className="text-primary hover:text-secondary flex items-center"><Upload className="w-4 h-4 mr-1"/> Upload Report</button>) : (<button onClick={() => handleUploadClick(program)} className="text-indigo-600 hover:text-indigo-900 flex items-center"><Upload className="w-4 h-4 mr-1"/> Upload Proof</button>)}</td></tr>);})}</tbody></table></div></div>{showUploadModal && <UploadModal program={selectedProgram} onClose={() => setShowUploadModal(false)} onFileUpload={handleFileUpload} />}</div>
    );
};
export default FacilityDashboard;