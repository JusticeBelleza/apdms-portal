import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
// CORRECTED: Using your firebase config path and db import
import { auth, db } from '../firebase/config';

const UserContext = createContext();

export const useUser = () => {
  return useContext(UserContext);
};

// This helper function remains the same and is a good practice
const getPermissionsForRole = (role) => {
  const basePermissions = {
    canManagePrograms: false,
    canManageFacilities: false,
    canManageUsers: false,
    canUploadSubmissions: false,
    canViewSubmissions: false,
    canManagePermissions: false,
  };

  switch (role) {
    case 'Super Admin':
      return Object.keys(basePermissions).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {});
    case 'PHO Admin':
      return {
        ...basePermissions,
        canManagePrograms: true,
        canManageFacilities: true,
        canManageUsers: true,
        canViewSubmissions: true,
      };
    case 'Facility Admin':
      return {
        ...basePermissions,
        canManageUsers: true,
        canUploadSubmissions: true,
        canViewSubmissions: true,
      };
    case 'Facility User':
      return {
        ...basePermissions,
        canUploadSubmissions: true,
        canViewSubmissions: true,
      };
    default:
      return basePermissions;
  }
};


export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchRoleAndPermissions = async (user) => {
      if (user) {
        try {
          // Fetch the user document from Firestore to get the role
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);

          let userRole = 'No Role'; // Default role
          if (userDoc.exists()) {
            userRole = userDoc.data().role; // Get role from the document
          }
          setRole(userRole);

          // Set permissions and admin status based on the role from Firestore
          setPermissions(getPermissionsForRole(userRole));
          setIsAdmin(userRole === 'Super Admin' || userRole === 'PHO Admin');

        } catch (error) {
          console.error("Error fetching user role:", error);
          setPermissions(getPermissionsForRole('No Role'));
          setIsAdmin(false);
          setRole('No Role');
        }
      } else {
        // Clear state on logout
        setRole(null);
        setPermissions({});
        setIsAdmin(false);
      }
      setLoading(false);
    };

    fetchRoleAndPermissions(currentUser);
  }, [currentUser]);

  const value = {
    currentUser,
    isAdmin,
    role,
    permissions,
    loading,
  };

  return (
    <UserContext.Provider value={value}>
      {!loading && children}
    </UserContext.Provider>
  );
};