// src/context/UserContext.js
import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from '../firebase/config';

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userData.isActive === false) {
                        setUser(null);
                    } else {
                        const permsDocRef = doc(db, "permissions", userData.role);
                        const permsDocSnap = await getDoc(permsDocRef);
                        
                        let permissions = {};
                        if (permsDocSnap.exists()) {
                            permissions = permsDocSnap.data();
                        }
                        if (userData.role === 'Super Admin') {
                           permissions = { canManageUsers: true, canManageFacilities: true, canManagePrograms: true, canManagePermissions: true, canViewAuditLog: true, canExportData: true, canConfirmSubmissions: true };
                        }
                        setUser({ uid: firebaseUser.uid, ...userData, permissions });
                    }
                } else {
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser, loading }}>
            {children}
        </UserContext.Provider>
    );
};