import React, { useState } from "react";
import { X, UploadCloud, File, AlertTriangle } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase/config";
import toast from "react-hot-toast";

const UploadModal = ({ isOpen, onClose, program, user, db, submissionPeriod }) => {
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload.");
      return;
    }
    if (!submissionPeriod) {
      toast.error("Submission period is not defined. Cannot upload.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const toastId = toast.loading("Starting upload...");

    const periodPath =
      submissionPeriod.type === "monthly"
        ? `${submissionPeriod.month}`
        : `W${submissionPeriod.week}`;
    const storagePath = `submissions/${user.facilityId}/${program.id}/${submissionPeriod.year}/${periodPath}/${file.name}`;
    const fileRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
        toast.loading(`Uploading: ${Math.round(progress)}%`, { id: toastId });
      },
      (error) => {
        setIsUploading(false);
        console.error("Upload failed:", error);
        toast.error("Upload failed. Please try again.", { id: toastId });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

        const submissionData = {
          programId: program.id,
          programName: program.name,
          facilityId: user.facilityId,
          facilityName: user.facilityName,
          userId: user.uid,
          userName: user.name,
          fileURL: downloadURL,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          timestamp: serverTimestamp(),
          status: "Waiting for Approval",
          confirmed: false,
          submissionYear: submissionPeriod.year,
          isZeroCase: false,
        };

        if (submissionPeriod.type === "monthly") {
          submissionData.submissionMonth = submissionPeriod.month;
        } else {
          submissionData.morbidityWeek = submissionPeriod.week;
          submissionData.submissionMonth = new Date().getMonth() + 1;
        }

        await addDoc(collection(db, "submissions"), submissionData);

        toast.success("File uploaded and awaiting approval!", { id: toastId });
        setIsUploading(false);
        onClose();
      }
    );
  };

  const handleZeroCaseSubmit = async () => {
    if (!submissionPeriod) {
      toast.error("Submission period is not defined. Cannot submit.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Submitting zero case report...");

    try {
      const submissionData = {
        programId: program.id,
        programName: program.name,
        facilityId: user.facilityId,
        facilityName: user.facilityName,
        userId: user.uid,
        userName: user.name,
        fileURL: null,
        fileName: "Zero Case Report",
        fileType: null,
        fileSize: 0,
        timestamp: serverTimestamp(),
        status: "Waiting for Approval",
        confirmed: false,
        submissionYear: submissionPeriod.year,
        isZeroCase: true,
      };

      if (submissionPeriod.type === "monthly") {
        submissionData.submissionMonth = submissionPeriod.month;
      } else {
        submissionData.morbidityWeek = submissionPeriod.week;
        submissionData.submissionMonth = new Date().getMonth() + 1;
      }

      await addDoc(collection(db, "submissions"), submissionData);

      toast.success("Zero case report submitted and awaiting approval!", { id: toastId });
      onClose();
    } catch (error) {
      console.error("Zero case submission failed:", error);
      toast.error("Failed to submit zero case report.", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };


  const submissionPeriodText =
    submissionPeriod.type === "monthly"
      ? new Date(submissionPeriod.year, submissionPeriod.month - 1).toLocaleString("default", {
          month: "long",
          year: "numeric",
        })
      : `Morbidity Week ${submissionPeriod.week}, ${submissionPeriod.year}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 transform transition-all">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{program.name}</h2>
            <p className="text-sm text-gray-500">Submit report for: {submissionPeriodText}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="mt-6">
          <label
            htmlFor="file-upload"
            className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
          >
            {file ? (
              <div className="text-center">
                <File className="w-12 h-12 mx-auto text-primary" />
                <p className="mt-2 font-semibold text-gray-700">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            ) : (
              <div className="text-center">
                <UploadCloud className="w-12 h-12 mx-auto text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">Excel, CSV, or other required formats</p>
              </div>
            )}
            <input id="file-upload" type="file" className="sr-only" onChange={handleFileChange} disabled={isUploading} />
          </label>
        </div>

        {isUploading && (
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}

        <div className="mt-8 space-y-3">
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="w-full flex items-center justify-center px-4 py-3 bg-primary text-white rounded-lg font-semibold text-base hover:bg-secondary disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? "Uploading..." : "Upload and Submit"}
          </button>
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-500 text-sm">Or</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>
          <button
            onClick={handleZeroCaseSubmit}
            disabled={isUploading}
            className="w-full flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-lg font-semibold text-base hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <AlertTriangle className="w-5 h-5 mr-2" />
            Submit Zero Case Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
