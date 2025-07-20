import React, { useState, useEffect, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";

// Firebase and Auth
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  getDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  orderBy,
  writeBatch,
  updateDoc,
} from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { ref as rtdbRef, onValue, off, set, onDisconnect } from "firebase/database";
import { auth, db, rtdb, storage } from "./firebase/config";

// Helper Functions
import { logAudit } from "./utils/helpers";

// Layout Components
import LoadingScreen from "./components/layout/LoadingScreen";
import LoginScreen from "./components/layout/LoginScreen";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import ConfirmationModal from "./components/modals/ConfirmationModal";
import AnnouncementModal from "./components/modals/AnnouncementModal";

// Dashboard Components
import AdminDashboard from "./components/dashboards/AdminDashboard";
import FacilityDashboard from "./components/dashboards/FacilityDashboard";
import FacilityAdminDashboard from "./components/dashboards/FacilityAdminDashboard";
import PhoAdminDashboard from "./components/dashboards/PhoAdminDashboard";

// Page Components
import ReportsPage from "./pages/ReportsPage";
import DatabankPage from "./pages/DatabankPage";
import FacilityManagementPage from "./pages/FacilityManagementPage";
import SettingsPage from "./pages/SettingsPage";
import UserManagementPage from "./pages/UserManagementPage";
import SubmissionsHistory from "./pages/SubmissionsHistory";
import ProfilePage from "./pages/ProfilePage";
import AuditLogPage from "./pages/AuditLogPage";
import DeletionRequestsPage from "./pages/DeletionRequestsPage";

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [facilities, setFacilities] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [users, setUsers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [onlineStatuses, setOnlineStatuses] = useState({});

  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [userNotifications, setUserNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const [showDeletionConfirmation, setShowDeletionConfirmation] = useState(false);
  const [deletionInfo, setDeletionInfo] = useState({ subId: null, action: null });

  const [isAnnouncementModalOpen, setAnnouncementModalOpen] = useState(false);

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

          if (userData.role === "Super Admin") {
            permissions = {
              canManageUsers: true,
              canManageFacilities: true,
              canManagePrograms: true,
              canManagePermissions: true,
              canViewAuditLog: true,
              canExportData: true,
              canConfirmSubmissions: true,
            };
          }

          setUser({
            uid: firebaseUser.uid,
            ...userData,
            permissions,
            seenAnnouncements: userData.seenAnnouncements || [],
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
    if (isLoggingOut && user === null) {
        const performSignOut = async () => {
            try {
                await signOut(auth);
                toast.success("You have been logged out.");
            } catch (error) {
                console.error("Sign out error:", error);
                toast.error("An error occurred during sign out.");
            } finally {
                setPage("dashboard");
                setIsLoggingOut(false);
            }
        };
        setTimeout(performSignOut, 50);
    }
  }, [user, isLoggingOut]);

  useEffect(() => {
    if (user && announcements.length > 0) {
      const seenIds = user.seenAnnouncements || [];
      const newUnreadCount = announcements.filter((ann) => !seenIds.includes(ann.id)).length;
      setUnreadAnnouncements(newUnreadCount);
    } else {
      setUnreadAnnouncements(0);
    }
  }, [user, announcements]);

  useEffect(() => {
    if (!user) {
      if (listenerUnsubscribes.current.length > 0) {
        listenerUnsubscribes.current.forEach((unsub) => unsub());
        listenerUnsubscribes.current = [];
      }
      return;
    }

    const myConnectionsRef = rtdbRef(rtdb, `status/${user.uid}`);
    const connectedRef = rtdbRef(rtdb, ".info/connected");

    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        set(myConnectionsRef, true);
        onDisconnect(myConnectionsRef).remove();
      }
    });

    const statusRef = rtdbRef(rtdb, "status");
    onValue(statusRef, (snapshot) => {
      setOnlineStatuses(snapshot.val() || {});
    });

    const listeners = [
      onSnapshot(collection(db, "programs"), (snapshot) =>
        setPrograms(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      ),
      onSnapshot(collection(db, "users"), (snapshot) =>
        setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      ),
      onSnapshot(collection(db, "facilities"), (snapshot) =>
        setFacilities(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      ),
      onSnapshot(query(collection(db, "announcements"), orderBy("timestamp", "desc")), (snapshot) => {
        setAnnouncements(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }),
      onSnapshot(
        query(collection(db, "notifications"), where("userId", "==", user.uid), orderBy("timestamp", "desc")),
        (snapshot) => {
          const fetchedNotifications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setUserNotifications(fetchedNotifications);
          setUnreadNotificationsCount(fetchedNotifications.filter((n) => !n.isRead).length);
        }
      ),
    ];
    
    // This now fetches all submissions for all relevant roles.
    // The filtering logic is handled inside the respective dashboard components.
    if (user.role === "PHO Admin" || user.role === "Super Admin" || user.role === "Facility Admin") {
      const submissionsQuery = query(collection(db, "submissions"));
      listeners.push(
        onSnapshot(submissionsQuery, (snapshot) => {
          setSubmissions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        })
      );
    } else {
      // For Facility User, only fetch their own submissions.
      const submissionsQuery = query(collection(db, "submissions"), where("userId", "==", user.uid));
       listeners.push(
        onSnapshot(submissionsQuery, (snapshot) => {
          setSubmissions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        })
      );
    }

    listenerUnsubscribes.current = listeners;

    return () => {
      listenerUnsubscribes.current.forEach((unsub) => unsub());
      off(statusRef);
    };
  }, [user]);

  const handleLogin = async (email, password) => {
    if (!email || !password) {
      toast.error("Email and password cannot be empty.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Logging in...");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Successfully logged in!", { id: toastId });
    } catch (error) {
      setLoading(false);
      let errorMessage = "An unknown error occurred.";
      switch (error.code) {
        case "auth/user-not-found":
          errorMessage = "No user found with this email.";
          break;
        case "auth/wrong-password":
          errorMessage = "Incorrect password. Please try again.";
          break;
        default:
          errorMessage = "Invalid credentials. Please check your email and password.";
          break;
      }
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleLogout = async () => {
    if (auth.currentUser) {
      const userStatusRef = rtdbRef(rtdb, `status/${auth.currentUser.uid}`);
      await set(userStatusRef, false);
    }
    setIsLoggingOut(true);
    setUser(null);
  };

  const handleDeleteSubmission = async (subId) => {
    if (!subId) {
      toast.error("Invalid submission ID.");
      return;
    }

    const toastId = toast.loading("Deleting submission...");

    try {
      const subDocRef = doc(db, "submissions", subId);
      const subDoc = await getDoc(subDocRef);

      if (subDoc.exists()) {
        const subData = subDoc.data();
        if (subData.fileURL) {
          const fileRef = storageRef(storage, subData.fileURL);
          try {
            await deleteObject(fileRef);
          } catch (storageError) {
            if (storageError.code !== 'storage/object-not-found') {
              console.error("Could not delete file from storage, continuing with Firestore deletion.", storageError);
            }
          }
        }
      }

      await deleteDoc(subDocRef);

      toast.success("Submission deleted successfully!", { id: toastId });
      await logAudit(db, user, "Delete Submission", { submissionId: subId });
    } catch (error) {
      console.error("Error deleting submission:", error);
      toast.error(`Error deleting submission: ${error.message}`, { id: toastId });
    }
  };

  const handleAddAnnouncement = async (title, message) => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message cannot be empty.");
      return;
    }

    const toastId = toast.loading("Posting announcement...");
    const batch = writeBatch(db);

    const announcementRef = doc(collection(db, "announcements"));
    batch.set(announcementRef, {
      title,
      message,
      timestamp: serverTimestamp(),
      author: user.name,
    });

    const usersToNotify = users.filter((u) => u.id !== user.uid);
    usersToNotify.forEach((userToNotify) => {
      const notificationRef = doc(collection(db, "notifications"));
      batch.set(notificationRef, {
        userId: userToNotify.id,
        title: `New Announcement: ${title}`,
        message: message,
        timestamp: serverTimestamp(),
        isRead: false,
        relatedAnnouncementId: announcementRef.id,
      });
    });

    try {
      await batch.commit();
      await logAudit(db, user, "Create Announcement", { title });
      toast.success("Announcement posted and users notified!", { id: toastId });
      setAnnouncementModalOpen(false);
    } catch (error) {
      console.error("Error posting announcement:", error);
      toast.error("Failed to post announcement.", { id: toastId });
    }
  };

  const handleDeletionConfirm = (subId, action) => {
    setDeletionInfo({ subId, action });
    setShowDeletionConfirmation(true);
  };

  const executeDeletion = async () => {
    if (deletionInfo.action === "approve") {
      await handleApproveDeletion(deletionInfo.subId);
    } else if (deletionInfo.action === "deny") {
      await handleDenyDeletionRequest(deletionInfo.subId);
    }
    setShowDeletionConfirmation(false);
    setDeletionInfo({ subId: null, action: null });
  };

  const handleApproveDeletion = async (subId) => {
    await handleDeleteSubmission(subId);
  };

  const handleDenyDeletionRequest = async (subId) => {
    const subDocRef = doc(db, "submissions", subId);
    await updateDoc(subDocRef, { deletionRequest: null });
    toast.error("Deletion request denied.");
  };
  
  const markAnnouncementsAsRead = async () => {
    if (!user || unreadAnnouncements === 0) return;
    const userDocRef = doc(db, "users", user.uid);
    const announcementIds = announcements.map((ann) => ann.id);

    try {
      await updateDoc(userDocRef, { seenAnnouncements: announcementIds });
      setUser((prevUser) => ({ ...prevUser, seenAnnouncements: announcementIds }));
    } catch (err) {
      console.error("Failed to mark announcements as read:", err);
      toast.error("Could not mark announcements as read.");
    }
  };

  const handleMarkNotificationsAsRead = async () => {
    if (!user || unreadNotificationsCount === 0) return;
    const batch = writeBatch(db);
    userNotifications.forEach((notification) => {
      if (!notification.isRead) {
        const notifRef = doc(db, "notifications", notification.id);
        batch.update(notifRef, { isRead: true });
      }
    });
    await batch.commit().catch((err) => console.error("Failed to mark notifications as read", err));
  };

  const handleClearAllNotifications = async () => {
    if (!user || userNotifications.length === 0) return;

    const toastId = toast.loading("Clearing notifications...");
    const batch = writeBatch(db);
    userNotifications.forEach((notification) => {
      const notifRef = doc(db, "notifications", notification.id);
      batch.delete(notifRef);
    });

    try {
      await batch.commit();
      toast.success("All notifications cleared.", { id: toastId });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      toast.error("Failed to clear notifications.", { id: toastId });
    }
  };

  const renderPage = () => {
    const loggedInUserDetails = { ...user, ...users.find((u) => u.id === user.uid) };
    const activePrograms = programs.filter((p) => p.active !== false);
    const programsForUser =
      user.role === "PHO Admin"
        ? activePrograms.filter((p) => loggedInUserDetails.assignedPrograms?.includes(p.id))
        : activePrograms;

    switch (page) {
      case "dashboard":
        if (user.role === "Facility User")
          return (
            <FacilityDashboard
              user={loggedInUserDetails}
              allPrograms={activePrograms}
              db={db}
            />
          );
        if (user.role === "PHO Admin")
          return (
            <PhoAdminDashboard
              user={loggedInUserDetails}
              programs={programs}
              submissions={submissions}
            />
          );
        if (user.role === "Facility Admin")
          return (
            <FacilityAdminDashboard
              user={loggedInUserDetails}
              programs={programs}
              submissions={submissions}
              users={users}
              onlineStatuses={onlineStatuses}
            />
          );
        return (
          <AdminDashboard
            facilities={facilities}
            programs={programsForUser}
            submissions={submissions}
            users={users}
            user={loggedInUserDetails}
            onNavigate={setPage}
          />
        );
      case "reports":
        if (user.permissions?.canExportData)
          return <ReportsPage programs={programsForUser} users={users} user={loggedInUserDetails} submissions={submissions} />;
        break;
      case "databank":
        return (
          <DatabankPage
            user={loggedInUserDetails}
            programs={programs}
            facilities={facilities}
            db={db}
            onSuperAdminDelete={handleDeletionConfirm}
          />
        );
      case "facilities":
        if (user.permissions?.canManageFacilities)
          return <FacilityManagementPage user={loggedInUserDetails} facilities={facilities} db={db} />;
        break;
      case "settings":
        if (user.permissions?.canManagePrograms || user.permissions?.canManagePermissions)
          return <SettingsPage programs={programs} user={loggedInUserDetails} db={db} />;
        break;
      case "users":
        if (user.permissions?.canManageUsers)
          return (
            <UserManagementPage
              users={users}
              facilities={facilities}
              programs={programs}
              currentUser={loggedInUserDetails}
              auth={auth}
              db={db}
            />
          );
        break;
      case "submissions":
        return <SubmissionsHistory user={loggedInUserDetails} db={db} onDelete={handleDeleteSubmission} />;
      case "profile":
        return <ProfilePage user={loggedInUserDetails} auth={auth} db={db} setUser={setUser} />;
      case "audit":
        if (user.permissions?.canViewAuditLog) return <AuditLogPage db={db} />;
        break;
      case "deletion-requests":
        if (user.role === "Super Admin")
          return (
            <DeletionRequestsPage
              submissions={submissions}
              onApprove={(subId) => handleDeletionConfirm(subId, "approve")}
              onDeny={(subId) => handleDeletionConfirm(subId, "deny")}
            />
          );
        break;
      default:
        return <div>Page not found</div>;
    }
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  };

  if (loading || isLoggingOut) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />

      {!user ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        (() => {
          const loggedInUserDetails = { ...user, ...users.find((u) => u.id === user.uid) };
          return (
            <div className="flex h-screen bg-gray-100 font-sans">
              <Sidebar user={loggedInUserDetails} onNavigate={setPage} onLogout={handleLogout} currentPage={page} />
              <main className="flex-1 flex flex-col overflow-hidden">
                <Header
                  user={loggedInUserDetails}
                  onLogout={handleLogout}
                  onAddAnnouncement={() => setAnnouncementModalOpen(true)}
                  notifications={userNotifications}
                  unreadNotificationsCount={unreadNotificationsCount}
                  unreadAnnouncements={unreadAnnouncements}
                  onMarkAnnouncementsAsRead={markAnnouncementsAsRead}
                  onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
                  onClearAllNotifications={handleClearAllNotifications}
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
                message="Are you sure you want to proceed with this action? This should not be undone."
              />
              <AnnouncementModal
                isOpen={isAnnouncementModalOpen}
                onClose={() => setAnnouncementModalOpen(false)}
                onPost={handleAddAnnouncement}
              />
            </div>
          );
        })()
      )}
    </>
  );
}
