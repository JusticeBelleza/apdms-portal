// src/components/dashboards/FacilityDashboard.js
import React, { useState, useEffect } from 'react';
import { Upload, FileText } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from '../../firebase/config';
import UploadModal from '../modals/UploadModal';
import { getMorbidityWeek } from '../../utils/helpers';
import toast from 'react-hot-toast'; // Import toast

const FacilityDashboard = ({ user, allPrograms, submissions, db }) => {
    const [facilityPrograms, setFacilityPrograms] = useState([]);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);

    useEffect(() => {
        if (user && user.facilityId && allPrograms.length > 0) {
            const assignedPrograms = allPrograms.filter(p => p.assignedFacilities?.includes(user.facilityId));
            setFacilityPrograms(assignedPrograms);
        }
    }, [user, allPrograms]);

    const handleUploadClick = (program) => {
        setSelectedProgram(program);
        setShowUploadModal(true);
    };

    const handleFileUpload = async (file, morbidityWeek) => {
        if (!selectedProgram || !user) {
            toast.error("An unexpected error occurred. Please try again.");
            return;
        }

        const toastId = toast.loading('Uploading file...'); // Show loading toast

        const isZeroCase = !file;
        let fileName = '';
        if (file) {
            const fileExtension = file.name.split('.').pop();
            fileName = `${user.facilityName}-${selectedProgram.name}-MW${morbidityWeek}-${Date.now()}.${fileExtension}`;
        } else {
            fileName = `Zero-Case-Report-${new Date().getFullYear()}-MW-${morbidityWeek}.pdf`;
        }

        const storagePath = `submissions/${user.facilityName}/${selectedProgram.name}/${morbidityWeek}/${fileName}`;
        const fileRef = storageRef(storage, storagePath);
        const submissionRef = doc(collection(db, "submissions"));

        try {
            let fileURL = '';
            if (file) {
                await uploadBytes(fileRef, file);
                fileURL = await getDownloadURL(fileRef);
            }
            
            const submissionData = {
                facilityId: user.facilityId,
                facilityName: user.facilityName,
                programId: selectedProgram.id,
                programName: selectedProgram.name,
                morbidityWeek: morbidityWeek,
                submittedBy: user.uid,
                submittedByName: user.name,
                timestamp: serverTimestamp(),
                status: 'For Confirmation',
                fileURL: fileURL,
                fileName: fileName,
                isZeroCase: isZeroCase,
            };
            
            await setDoc(submissionRef, submissionData);
            
            toast.success('File uploaded successfully!', { id: toastId }); // Show success toast
            setShowUploadModal(false);

        } catch (error) {
            console.error("Error uploading file:", error);
            toast.error('File upload failed. Please try again.', { id: toastId }); // Show error toast
        }
    };
    
    // ... rest of the component remains the same
    
    const programSubmissions = (programId, week) => {
        return submissions.filter(s => s.facilityId === user.facilityId && s.programId === programId && s.morbidityWeek === week);
    };
    
    const currentWeek = getMorbidityWeek();

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Facility Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {facilityPrograms.map(program => {
                    const subs = programSubmissions(program.id, currentWeek);
                    const isSubmitted = subs.length > 0;
                    const submissionStatus = isSubmitted ? subs[0].status : 'Not Submitted';

                    return (
                        <div key={program.id} className="bg-white p-6 rounded-xl shadow-md flex flex-col justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-700">{program.name}</h2>
                                <p className="text-sm text-gray-500 mb-4">{program.description}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium mb-2">
                                    MW {currentWeek} Status: 
                                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                                        submissionStatus === 'Submitted' ? 'bg-green-100 text-green-800' :
                                        submissionStatus === 'For Confirmation' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {submissionStatus}
                                    </span>
                                </p>
                                <button
                                    onClick={() => handleUploadClick(program)}
                                    disabled={isSubmitted && submissionStatus !== 'Rejected'}
                                    className="flex items-center justify-center w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    <span>{isSubmitted && submissionStatus !== 'Rejected' ? 'Submitted' : 'Upload Report'}</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showUploadModal && (
                <UploadModal
                    program={selectedProgram}
                    onClose={() => setShowUploadModal(false)}
                    onFileUpload={handleFileUpload}
                />
            )}

            <div className="mt-8 bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-bold text-gray-700 mb-4">Recent Submissions</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Program</th>
                                <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Morbidity Week</th>
                                <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions
                                .filter(s => s.facilityId === user.facilityId)
                                .sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate())
                                .slice(0, 5)
                                .map(sub => (
                                <tr key={sub.id} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-3 text-sm text-gray-700">{sub.programName}</td>
                                    <td className="py-3 px-3 text-sm text-gray-700">{sub.morbidityWeek}</td>
                                    <td className="py-3 px-3 text-sm">
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                            sub.status === 'Submitted' ? 'bg-green-100 text-green-800' :
                                            sub.status === 'For Confirmation' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {sub.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FacilityDashboard;