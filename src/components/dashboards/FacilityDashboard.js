import React, { useState, useEffect } from "react";
import { FileText, CheckCircle, Upload, XCircle, Clock, AlertCircle, LogOut } from "lucide-react";
import { getMorbidityWeek } from "../../utils/helpers";
import UploadModal from "../modals/UploadModal";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config";

const FacilityDashboard = ({ user, allPrograms, db }) => {
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [facilitySubmissions, setFacilitySubmissions] = useState([]);

    // --- FIX: Moved useEffect hook to the top level before any early returns ---
    useEffect(() => {
        // The check for assigned programs will prevent this from running unnecessarily
        if (!user || !db || !user.assignedPrograms || user.assignedPrograms.length === 0) return;

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

    const handleLogout = () => {
        signOut(auth).catch(error => console.error("Logout Error:", error));
    };

    // --- Check for assigned programs can now happen after all hooks are called ---
    if (!user.assignedPrograms || user.assignedPrograms.length === 0) {
        return (
            <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
                    <AlertCircle className="w-16 h-16 text-yellow-500 mb-4 mx-auto" />
                    <h1 className="text-2xl font-bold text-gray-800">Account Configuration Pending</h1>
                    <p className="mt-2 text-gray-600">
                        You have not been assigned any programs yet. Please wait for your facility administrator to finish setting up your account.
                    </p>
                    <button
                        onClick={handleLogout}
                        className="mt-6 w-full flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Go to Login Page
                    </button>
                </div>
            </div>
        );
    }

    const now = new Date();
    const currentMorbidityWeek = getMorbidityWeek();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

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
    
    // Filter to only show programs assigned to the user
    const assignedPrograms = allPrograms.filter(p => user.assignedPrograms.includes(p.id));


    return (
        <div className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Programs Dashboard</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {assignedPrograms.map((program) => {
                    const submission = getSubmissionForPeriod(program);
                    const isPending = submission && submission.status === "pending";
                    const isApproved = submission && submission.status === "approved";
                    const isRejected = submission && submission.status === "rejected";
                    const isLocked = isPending || isApproved;

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
                                            : isPending
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
                                    ) : isPending ? (
                                        <>
                                            <Clock className="w-4 h-4 mr-2" />
                                            Pending Approval
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
