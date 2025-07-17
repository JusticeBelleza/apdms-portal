import React, { useState, useEffect } from "react";
import { FileText, CheckCircle, Upload, XCircle, Clock } from "lucide-react";
import { getMorbidityWeek } from "../../utils/helpers";
import UploadModal from "../modals/UploadModal";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const FacilityDashboard = ({ user, allPrograms, db }) => {
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [facilitySubmissions, setFacilitySubmissions] = useState([]);

  const now = new Date();
  const currentMorbidityWeek = getMorbidityWeek();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    if (!user || !db) return;

    const submissionsQuery = query(
      collection(db, "submissions"),
      where("facilityId", "==", user.facilityId)
    );

    const unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
      const userSubmissions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFacilitySubmissions(userSubmissions);
    });

    return () => unsubscribe();
  }, [user, db]);

  const getSubmissionPeriod = (program) => {
    if (program && program.name && program.name.toLowerCase().includes("rabies")) {
      return { type: "monthly", month: currentMonth, year: currentYear };
    }
    return { type: "weekly", week: currentMorbidityWeek, year: currentYear };
  };

  const getSubmissionForPeriod = (program) => {
    const period = getSubmissionPeriod(program);
    let submissionsForPeriod;

    if (period.type === "monthly") {
      submissionsForPeriod = facilitySubmissions.filter(
        (sub) =>
          sub.programId === program.id &&
          sub.submissionMonth === period.month &&
          sub.submissionYear === period.year
      );
    } else { // weekly
      submissionsForPeriod = facilitySubmissions.filter(
        (sub) =>
          sub.programId === program.id &&
          sub.morbidityWeek === period.week &&
          sub.submissionYear === period.year
      );
    }

    if (submissionsForPeriod.length === 0) {
      return null;
    }

    // Sort by timestamp to get the most recent submission for the period
    submissionsForPeriod.sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
    });
    
    return submissionsForPeriod[0];
  };

  const handleOpenUploadModal = (program) => {
    setSelectedProgram(program);
    setUploadModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Programs Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {allPrograms.map((program) => {
          const submission = getSubmissionForPeriod(program);
          const isWaiting = submission && submission.status === "Waiting for Approval";
          const isApproved = submission && submission.status === "Approved";
          const isRejected = submission && submission.status === "Rejected";
          const isLocked = isWaiting || isApproved;

          const period = getSubmissionPeriod(program);
          const submissionPeriodText =
            period.type === "monthly"
              ? new Date(period.year, period.month - 1).toLocaleString("default", {
                  month: "long",
                  year: "numeric",
                })
              : `Morbidity Week ${period.week}, ${period.year}`;

          return (
            <div
              key={program.id}
              className={`bg-white rounded-xl shadow-md p-5 flex flex-col justify-between transition-all duration-300 ${
                isLocked ? "bg-gray-50" : "hover:shadow-lg hover:-translate-y-1"
              }`}
            >
              <div>
                <div className="flex items-center mb-3">
                  <div className="p-2 bg-primary-light rounded-full mr-3">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">{program.name}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">{program.description}</p>
                <div className="text-xs text-gray-600 bg-gray-100 rounded-full px-3 py-1 inline-block">
                  Submission for: <strong>{submissionPeriodText}</strong>
                </div>
                {isRejected && (
                  <div className="mt-3 p-2 bg-red-100 text-red-700 rounded-lg text-xs">
                    <p className="font-bold">Submission Rejected</p>
                    <p>Reason: {submission.rejectionReason}</p>
                  </div>
                )}
              </div>
              <div className="mt-5">
                <button
                  onClick={() => handleOpenUploadModal(program)}
                  disabled={isLocked}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    isApproved
                      ? "bg-green-100 text-green-700 cursor-not-allowed"
                      : isWaiting
                      ? "bg-yellow-100 text-yellow-800 cursor-not-allowed"
                      : isRejected
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-primary text-white hover:bg-secondary"
                  }`}
                >
                  {isApproved ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approved
                    </>
                  ) : isWaiting ? (
                    <>
                      <Clock className="w-4 h-4 mr-2" />
                      Waiting for Approval
                    </>
                  ) : isRejected ? (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Resubmit Report
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Submit Report
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isUploadModalOpen && selectedProgram && (
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          program={selectedProgram}
          user={user}
          db={db}
          submissionPeriod={getSubmissionPeriod(selectedProgram)}
        />
      )}
    </div>
  );
};

export default FacilityDashboard;
