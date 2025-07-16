
// src/App.js

import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import toast, { Toaster } from 'react-hot-toast';

// Firebase and Auth
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, getDoc, getDocs, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp, orderBy, writeBatch, updateDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import { ref as rtdbRef, onValue, off, set, onDisconnect } from "firebase/database";
import { auth, db, rtdb, storage } from './firebase/config';

// Helper Functions
import { logAudit } from './utils/helpers';

// Layout Components
import LoadingScreen from './components/layout/LoadingScreen';
import LoginScreen from './components/layout/LoginScreen';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ConfirmationModal from './components/modals/ConfirmationModal';

// Dashboard Components
import AdminDashboard from './components/dashboards/AdminDashboard';
import FacilityDashboard from './components/dashboards/FacilityDashboard';
import FacilityAdminDashboard from './components/dashboards/FacilityAdminDashboard';
import PhoAdminDashboard from './components/dashboards/PhoAdminDashboard';

// Page Components
import ReportsPage from './pages/ReportsPage';
import DatabankPage from './pages/DatabankPage';
import FacilityManagementPage from './pages/FacilityManagementPage';
import SettingsPage from './pages/SettingsPage';
import UserManagementPage from './pages/UserManagementPage';
import SubmissionsHistory from './pages/SubmissionsHistory';
import ProfilePage from './pages/ProfilePage';
import AuditLogPage from './pages/AuditLogPage';
import DeletionRequestsPage from './pages/DeletionRequestsPage';

export default function App() {
    const [user, setUser] = useState(null);
    const [page, setPage] = useState('dashboard');
    const [loading, setLoading] = useState(true);

    const [facilities, setFacilities] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [users, setUsers] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
    const [onlineStatuses, setOnlineStatuses] = useState({});
    
    const [showDeletionConfirmation, setShowDeletionConfirmation] = useState(false);
    const [deletionInfo, setDeletionInfo] = useState({ subId: null, action: null });
    
    const listenerUnsubscribes = useRef([]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userData.isActive === false) {
                        toast.error("Your account has been deactivated. Please contact an administrator.");
                        signOut(auth);
                        return;
                    }

                    const permsDocRef = doc(db, "permissions", userData.role);
                    const permsDocSnap = await getDoc(permsDocRef);
                    
                    let permissions = {};
                    if (permsDocSnap.exists()) {
                        permissions = permsDocSnap.data();
                    }
                    if (userData.role === 'Super Admin') {
                        permissions = { canManageUsers: true, canManageFacilities: true, canManagePrograms: true, canManagePermissions: true, canViewAuditLog: true, canExportData: true, canConfirmSubmissions: true };
                    }

                    setUser({ 
                        uid: firebaseUser.uid, 
                        ...userData, 
                        permissions, 
                        seenAnnouncements: userData.seenAnnouncements || []
                    });

                } else {
                    console.error("No user document found in Firestore for this authenticated user. Signing out.");
                    signOut(auth);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (user && announcements.length > 0) {
            const seenIds = user.seenAnnouncements || [];
            const newUnreadCount = announcements.filter(ann => !seenIds.includes(ann.id)).length;
            
            console.log("--- Notification Debug ---");
            console.log("Total announcements fetched:", announcements.length);
            console.log("Announcement IDs seen by user:", seenIds);
            console.log("Calculated unread count:", newUnreadCount);

            setUnreadAnnouncements(newUnreadCount);
        } else {
            setUnreadAnnouncements(0);
        }
    }, [user, announcements]);

    useEffect(() => {
        if (!user) {
            listenerUnsubscribes.current.forEach(unsub => unsub());
            listenerUnsubscribes.current = [];
            return;
        };

        const myConnectionsRef = rtdbRef(rtdb, `status/${user.uid}`);
        const connectedRef = rtdbRef(rtdb, '.info/connected');
        
        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                set(myConnectionsRef, true);
                onDisconnect(myConnectionsRef).remove();
            }
        });

        const statusRef = rtdbRef(rtdb, 'status');
        onValue(statusRef, (snapshot) => {
            setOnlineStatuses(snapshot.val() || {});
        });

        const deleteOldAnnouncements = async () => {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const announcementsQuery = query(collection(db, "announcements"), where("timestamp", "<", sevenDaysAgo));
            const snapshot = await getDocs(announcementsQuery);
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        };

        deleteOldAnnouncements();
    
        listenerUnsubscribes.current = [
            onSnapshot(collection(db, "programs"), (snapshot) => setPrograms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(collection(db, "users"), (snapshot) => setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(collection(db, "facilities"), (snapshot) => setFacilities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(collection(db, "submissions"), (snapshot) => setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "announcements"), orderBy("timestamp", "desc")), (snapshot) => {
                setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }),
        ];
    
        return () => {
            listenerUnsubscribes.current.forEach(unsub => unsub());
            off(statusRef);
        }
    }, [user]);

    const handleLogin = async (email, password) => {
        if (!email || !password) {
            toast.error("Email and password cannot be empty.");
            return;
        }

        setLoading(true);
        const toastId = toast.loading('Logging in...');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            toast.success('Successfully logged in!', { id: toastId });
        } catch (error) {
            setLoading(false);
            let errorMessage = 'An unknown error occurred.';
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No user found with this email.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password. Please try again.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'The email address is not valid.';
                    break;
                case 'auth/invalid-credential':
                     errorMessage = 'Invalid credentials. Please check your email and password.';
                     break;
                default:
                    errorMessage = 'Login failed. Please try again.';
                    break;
            }
            toast.error(errorMessage, { id: toastId });
        }
    };

    const handleLogout = () => {
        listenerUnsubscribes.current.forEach(unsub => unsub());
        listenerUnsubscribes.current = [];

        if(user) {
            const userStatusRef = rtdbRef(rtdb, `status/${user.uid}`);
            set(userStatusRef, false);
        }
        signOut(auth);
        toast.success("You have been logged out.");
        setPage('dashboard');
    };

    const handleConfirmSubmission = async (submissionId) => {
        const subDocRef = doc(db, 'submissions', submissionId);
        await setDoc(subDocRef, { confirmed: true, status: 'Submitted' }, { merge: true });
        toast.success('Submission confirmed!');
    };
    
    const handleDenySubmission = async (submissionId) => {
        const subDocRef = doc(db, 'submissions', submissionId);
        await setDoc(subDocRef, { confirmed: false, status: 'Rejected' }, { merge: true });
        toast.error('Submission rejected.');
    };

    const handleAddAnnouncement = async (title, message) => {
        await addDoc(collection(db, "announcements"), { title, message, timestamp: serverTimestamp(), author: user.name });
        await logAudit(db, user, "Create Announcement", { title });
        toast.success("Announcement posted!");
    };
    
    const handleDeleteAnnouncement = async (announcementId) => {
        if (window.confirm("Are you sure you want to delete this announcement?")) {
            await deleteDoc(doc(db, "announcements", announcementId));
            await logAudit(db, user, "Delete Announcement", { announcementId });
            toast.success("Announcement deleted.");
        }
    };

    const handleDeletionConfirm = (subId, action) => {
        setDeletionInfo({ subId, action });
        setShowDeletionConfirmation(true);
    };
    
    const executeDeletion = async () => {
        if (deletionInfo.action === 'approve') {
            await handleApproveDeletion(deletionInfo.subId);
        } else if (deletionInfo.action === 'deny') {
            await handleDenyDeletionRequest(deletionInfo.subId);
        }
        setShowDeletionConfirmation(false);
        setDeletionInfo({ subId: null, action: null });
    };

    const handleApproveDeletion = async (subId) => {
        const subDocRef = doc(db, "submissions", subId);
        const subDoc = await getDoc(subDocRef);
        if (subDoc.exists()) {
            const subData = subDoc.data();
            if (subData.fileURL) {
                const fileRef = storageRef(storage, subData.fileURL);
                try {
                    await deleteObject(fileRef);
                } catch (error) {
                    console.error("Error deleting file from storage:", error);
                }
            }
        }
        await deleteDoc(subDocRef);
        toast.success('Deletion approved and submission removed.');
    };

    const handleDenyDeletionRequest = async (subId) => {
        const subDocRef = doc(db, "submissions", subId);
        await updateDoc(subDocRef, { deletionRequest: null });
        toast.error('Deletion request denied.');
    };

    const markAnnouncementsAsRead = async () => {
        if (!user) return;
        const userDocRef = doc(db, "users", user.uid);
        const announcementIds = announcements.map(ann => ann.id);
        
        try {
            await updateDoc(userDocRef, { seenAnnouncements: announcementIds });
            
            setUser(prevUser => ({ ...prevUser, seenAnnouncements: announcementIds }));
            setUnreadAnnouncements(0);
        } catch (err) {
            console.error("Failed to mark announcements as read:", err);
            toast.error("Could not save notification status.");
        }
    };
    
    const handleSuperAdminDeletionRequest = (subId) => {
        handleDeletionConfirm(subId, 'approve');
    };

    const renderPage = () => {
        const loggedInUserDetails = { ...user, ...users.find(u => u.id === user.uid) };
        const activePrograms = programs.filter(p => p.active !== false);
        const programsForUser = (user.role === 'PHO Admin')
            ? activePrograms.filter(p => loggedInUserDetails.assignedPrograms?.includes(p.id))
            : activePrograms;
            
        switch(page) {
            case 'dashboard':
                if (user.role === 'Facility User') return <FacilityDashboard user={loggedInUserDetails} allPrograms={activePrograms} submissions={submissions} db={db} />;
                if (user.role === 'PHO Admin') return <PhoAdminDashboard user={loggedInUserDetails} programs={programs} submissions={submissions} users={users} onConfirm={handleConfirmSubmission} onDeny={handleDenySubmission} />;
                if (user.role === 'Facility Admin') return <FacilityAdminDashboard user={loggedInUserDetails} programs={programs} submissions={submissions} users={users} onlineStatuses={onlineStatuses}/>;
                return <AdminDashboard facilities={facilities} programs={programsForUser} submissions={submissions} users={users} onConfirm={handleConfirmSubmission} user={loggedInUserDetails} onNavigate={setPage} />;
            case 'reports':
                if (user.permissions?.canExportData) return <ReportsPage programs={programsForUser} submissions={submissions} users={users} user={loggedInUserDetails} />;
                break;
            case 'databank':
                return <DatabankPage user={loggedInUserDetails} submissions={submissions} programs={programs} facilities={facilities} db={db} onSuperAdminDelete={handleSuperAdminDeletionRequest} />;
            case 'facilities':
                if (user.permissions?.canManageFacilities) return <FacilityManagementPage user={loggedInUserDetails} facilities={facilities} db={db} />;
                break;
            case 'settings':
                if (user.permissions?.canManagePrograms || user.permissions?.canManagePermissions) return <SettingsPage programs={programs} user={loggedInUserDetails} db={db} />;
                break;
            case 'users':
                if (user.permissions?.canManageUsers) return <UserManagementPage users={users} facilities={facilities} programs={programs} currentUser={loggedInUserDetails} auth={auth} db={db} />;
                break;
            case 'submissions':
                 return <SubmissionsHistory user={loggedInUserDetails} submissions={submissions} db={db} />;
            case 'profile':
                return <ProfilePage user={loggedInUserDetails} auth={auth} db={db} setUser={setUser} />;
            case 'audit':
                if (user.permissions?.canViewAuditLog) return <AuditLogPage db={db} />;
                break;
            case 'deletion-requests':
                 if (user.role === 'Super Admin') return <DeletionRequestsPage submissions={submissions} onApprove={(subId) => handleDeletionConfirm(subId, 'approve')} onDeny={(subId) => handleDeletionConfirm(subId, 'deny')} />;
                 break;
            default:
                return <div>Page not found</div>;
        }
        return <div className="p-6"><h1 className="text-2xl font-bold text-red-600">Access Denied</h1><p>You do not have permission to view this page.</p></div>;
    };

    if (loading) {
        return <LoadingScreen />;
    }

    // --- Start of Fix ---
    // The <Toaster /> component is moved to the top level of the return statement.
    // This ensures it is always rendered and can display notifications
    // regardless of the user's authentication state.
    return (
        <>
            <Toaster position="top-center" reverseOrder={false} />
            
            {!user ? (
                <LoginScreen onLogin={handleLogin} />
            ) : (
                (() => {
                    const loggedInUserDetails = { ...user, ...users.find(u => u.id === user.uid) };
                    return (
                        <div className="flex h-screen bg-gray-100 font-sans">
                            <Sidebar user={loggedInUserDetails} onNavigate={setPage} onLogout={handleLogout} currentPage={page} />
                            <main className="flex-1 flex flex-col overflow-hidden">
                                <Header
                                    user={loggedInUserDetails}
                                    onLogout={handleLogout}
                                    unreadCount={unreadAnnouncements}
                                    onBellClick={markAnnouncementsAsRead}
                                    announcements={announcements}
                                    onAddAnnouncement={handleAddAnnouncement}
                                    onDeleteAnnouncement={handleDeleteAnnouncement}
                                />
                                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                                    {renderPage()}
                                    <div className="h-20 md:hidden" />
                                </div>
                            </main>
                            <ConfirmationModal 
                                isOpen={showDeletionConfirmation}
                                onClose={() => setShowDeletionConfirmation(false)}
                                onConfirm={executeDeletion}
                                title="Confirm Action"
                                message="Are you sure you want to proceed with this action? This cannot be undone."
                            />
                        </div>
                    );
                })()
            )}
        </>
    );
    // --- End of Fix ---
};
