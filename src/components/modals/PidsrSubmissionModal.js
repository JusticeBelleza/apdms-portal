import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import toast from 'react-hot-toast';

// List of diseases for the PIDSR Program
const PIDSR_DISEASES = [
  "Acute bloody diarrhea",
  "Acute flaccid paralysis",
  "Acute meningitis encephalitis",
  "Acute viral hepatitis",
  "Chikungunya viral disease",
  "Cholera",
  "Dengue",
  "Diphtheria",
  "Hand, foot & mouth disease",
  "Influenza like illness",
  "Leptospirosis",
  "Measles",
  "Meningococcal disease",
  "Neonatal tetanus",
  "Non-neonatal tetanus",
  "Pertussis",
  "Rabies",
  "Rotavirus",
  "Severe acute respiratory infection",
  "Typhoid and paratyphoid fever",
];

export default function PidsrSubmissionModal({ isOpen, onClose, db, storage, user, submissionPeriod, batchDocuments = [] }) {
  
  const isResubmission = batchDocuments.length > 0;

  const initialFormState = useMemo(() => {
    return PIDSR_DISEASES.reduce((acc, disease) => {
        acc[disease] = { file: null, isZeroCase: false, status: 'new', progress: 0, isUploading: false };
        return acc;
    }, {});
  }, []);

  const [formState, setFormState] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionProgress, setCompletionProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (isResubmission) {
        const newState = PIDSR_DISEASES.reduce((acc, disease) => {
          const doc = batchDocuments.find(d => d.diseaseName === disease);
          acc[disease] = doc 
            ? { 
                file: null, 
                isZeroCase: doc.isZeroCase, 
                status: doc.status, 
                docId: doc.id,
                rejectionReason: doc.rejectionReason || null,
                fileName: doc.fileName,
                progress: 0,
                isUploading: false,
              }
            : { file: null, isZeroCase: false, status: 'new', progress: 0, isUploading: false };
          return acc;
        }, {});
        setFormState(newState);
      } else {
        setFormState(initialFormState);
      }
    }
  }, [isOpen, isResubmission, batchDocuments, initialFormState]);

  useEffect(() => {
    const totalItems = Object.values(formState).length;
    let completedItems = 0;

    if(isResubmission) {
        completedItems = Object.values(formState).filter(
            (disease) => disease.status === 'approved' || (disease.status === 'rejected' && (disease.file || disease.isZeroCase))
        ).length;
    } else {
        completedItems = Object.values(formState).filter(
            (disease) => disease.file || disease.isZeroCase
        ).length;
    }
    
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    setCompletionProgress(progress);
  }, [formState, isResubmission]);

  if (!isOpen) return null;

  const handleFileChange = (e, diseaseName) => {
    const file = e.target.files[0];
    const allowedExtensions = ['.mdb', '.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));

    if (file && allowedExtensions.includes(fileExtension.toLowerCase())) {
      setFormState(prevState => ({
        ...prevState,
        [diseaseName]: { ...prevState[diseaseName], file: file, isZeroCase: false },
      }));
    } else {
      toast.error("Please select a valid .mdb, .xlsx, .xls, or .csv file.");
      e.target.value = null;
    }
  };

  const handleZeroCaseToggle = (diseaseName) => {
    setFormState(prevState => {
      const isCurrentlyZero = prevState[diseaseName].isZeroCase;
      return {
        ...prevState,
        [diseaseName]: {
          ...prevState[diseaseName],
          isZeroCase: !isCurrentlyZero,
          file: !isCurrentlyZero ? null : prevState[diseaseName].file,
        },
      };
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (completionProgress < 100) {
      toast.error("Please complete all items before submitting.");
      return;
    }
    
    setIsSubmitting(true);
    const toastId = toast.loading(isResubmission ? 'Resubmitting reports...' : 'Submitting reports...');
    
    try {
        const itemsToProcess = Object.entries(formState).filter(([, data]) => isResubmission ? data.status === 'rejected' && (data.file || data.isZeroCase) : (data.file || data.isZeroCase));
        
        const uploadPromises = itemsToProcess.map(([disease, data]) => {
            return new Promise(async (resolve, reject) => {
                if (!data.file) { // Handle zero case reports
                    resolve({ disease, data, downloadURL: null });
                    return;
                }

                setFormState(prev => ({ ...prev, [disease]: { ...prev[disease], isUploading: true }}));

                const periodPath = submissionPeriod.type === "monthly" ? `${submissionPeriod.month}` : `W${submissionPeriod.week}`;
                const storagePath = `submissions/pending/${user.facilityId}/PIDSR/${submissionPeriod.year}/${periodPath}/${disease}-${data.file.name}`;
                const fileRef = ref(storage, storagePath);
                const uploadTask = uploadBytesResumable(fileRef, data.file);

                uploadTask.on('state_changed', 
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setFormState(prev => ({ ...prev, [disease]: { ...prev[disease], progress: progress }}));
                    },
                    (error) => {
                        console.error("Upload error for", disease, error);
                        setFormState(prev => ({ ...prev, [disease]: { ...prev[disease], isUploading: false }}));
                        reject(error);
                    },
                    async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        setFormState(prev => ({ ...prev, [disease]: { ...prev[disease], isUploading: false }}));
                        resolve({ disease, data, downloadURL });
                    }
                );
            });
        });

        const uploadedFilesData = await Promise.all(uploadPromises);

        if (isResubmission) {
            const batch = writeBatch(db);
            uploadedFilesData.forEach(({ data, downloadURL }) => {
                const docRef = doc(db, "submissions", data.docId);
                batch.update(docRef, {
                    status: "pending",
                    fileURL: downloadURL,
                    fileName: data.file ? data.file.name : "Zero Case Report",
                    fileType: data.file ? data.file.type : null,
                    fileSize: data.file ? data.file.size : 0,
                    isZeroCase: data.isZeroCase,
                    timestamp: serverTimestamp(),
                    rejectionReason: null,
                });
            });
            await batch.commit();
            toast.success('Resubmitted reports successfully!', { id: toastId });
        } else {
            const batchId = `pidsr-${user.facilityId}-${Date.now()}`;
            const addDocPromises = uploadedFilesData.map(({ disease, data, downloadURL }) => {
                const submissionData = {
                    batchId,
                    programId: 'PIDSR',
                    programName: 'PIDSR Program',
                    diseaseName: disease,
                    facilityId: user.facilityId,
                    facilityName: user.facilityName,
                    userId: user.uid,
                    userName: user.name,
                    timestamp: serverTimestamp(),
                    status: "pending",
                    submissionYear: submissionPeriod.year,
                    isZeroCase: data.isZeroCase,
                    submissionMonth: submissionPeriod.type === "monthly" ? submissionPeriod.month : new Date().getMonth() + 1,
                    morbidityWeek: submissionPeriod.type === "weekly" ? submissionPeriod.week : null,
                    fileURL: downloadURL,
                    fileName: data.file ? data.file.name : "Zero Case Report",
                    fileType: data.file ? data.file.type : null,
                    fileSize: data.file ? data.file.size : 0,
                };
                return addDoc(collection(db, "submissions"), submissionData);
            });
            await Promise.all(addDocPromises);
            toast.success('All reports submitted successfully!', { id: toastId });
        }

        setTimeout(onClose, 1500); 
    } catch (error) {
        toast.error(`Submission failed: ${error.message}`, { id: toastId });
        console.error("Submission error:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col transform transition-all">
        <div className="sticky top-0 z-10 bg-white px-6 md:px-8 pt-6 pb-4 rounded-t-2xl border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">PIDSR Program Submission</h2>
              <p className="text-gray-600 text-sm">{isResubmission ? "Please correct and resubmit the rejected reports." : "For each disease, upload the corresponding file or mark it as a 'Zero Case Report'."}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between mb-1">
                <span className="text-base font-medium text-blue-700">Form Completion</span>
                <span className="text-sm font-medium text-blue-700">{completionProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${completionProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        <form id="pidsr-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto px-6 md:px-8 pb-6">
          <div className="space-y-4 pt-6">
            {PIDSR_DISEASES.map(disease => {
                const diseaseData = formState[disease];
                if (!diseaseData) return null;

                const isApproved = diseaseData.status === 'approved';
                const isRejected = diseaseData.status === 'rejected';

                return (
                    <div key={disease} className={`p-4 rounded-lg border transition-all 
                        ${isApproved ? 'bg-green-50 border-green-200' : ''}
                        ${isRejected ? 'bg-red-50 border-red-200' : ''}
                        ${diseaseData.status === 'new' ? 'bg-gray-50' : ''}
                    `}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                            <span className="font-semibold text-gray-700 mb-2 sm:mb-0">{disease}</span>
                            <div className="flex items-center space-x-2 w-full sm:w-auto">
                               {isApproved ? (
                                   <span className="font-semibold text-green-600 inline-flex items-center"><CheckCircle className="w-4 h-4 mr-2"/>Approved</span>
                               ) : (
                                <>
                                    <input
                                        type="file"
                                        id={`file-${disease}`}
                                        accept=".mdb,.xlsx,.xls,.csv"
                                        onChange={(e) => handleFileChange(e, disease)}
                                        disabled={isSubmitting || diseaseData.isZeroCase}
                                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 disabled:opacity-50"
                                    />
                                    <button type="button" onClick={() => handleZeroCaseToggle(disease)} disabled={isSubmitting || !!diseaseData.file} className={`px-3 py-2 text-xs font-medium rounded-md ${diseaseData.isZeroCase ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Zero Case</button>
                                </>
                               )}
                            </div>
                        </div>
                        {isRejected && (
                            <div className="text-xs text-red-600 mt-2 pl-1">
                                <span className="font-bold">Rejected:</span> {diseaseData.rejectionReason || "No reason provided."}
                            </div>
                        )}
                        {diseaseData.file && !diseaseData.isUploading && (
                            <p className="text-xs text-green-600 mt-2">New file selected: {diseaseData.file.name}</p>
                        )}
                        {diseaseData.isUploading && (
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                <div className="bg-blue-600 h-1.5 rounded-full" style={{width: `${diseaseData.progress}%`}}></div>
                            </div>
                        )}
                    </div>
                )
            })}
          </div>
        </form>

        <div className="px-6 md:px-8 py-4 border-t border-gray-200 bg-white rounded-b-2xl">
          <div className="flex justify-end">
            <button
              type="submit"
              form="pidsr-form"
              disabled={isSubmitting || completionProgress < 100}
              className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:bg-gray-400"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Reports'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
