import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Edit } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

const ProfilePage = ({ user, auth, db, setUser }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user.name);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        const userDocRef = doc(db, "users", user.uid);
        try {
            await setDoc(userDocRef, { name: name }, { merge: true });
            setUser(prevUser => ({ ...prevUser, name }));
            toast.success("Profile updated successfully!");
            setIsEditing(false);
        } catch (error) {
            toast.error(`Failed to update profile: ${error.message}`);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            toast.error("New passwords do not match.");
            return;
        }
        if (!currentPassword || !newPassword) {
            toast.error("All password fields are required.");
            return;
        }

        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            toast.error("No user is currently signed in.");
            return;
        }

        const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);

        try {
            await reauthenticateWithCredential(firebaseUser, credential);
            await updatePassword(firebaseUser, newPassword);
            toast.success("Password updated successfully!");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (error) {
            toast.error(`Failed to update password: ${error.message}`);
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">User Profile</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-700">Your Information</h2>
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full">
                                <Edit className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Full Name</label>
                            {isEditing ? (
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" />
                            ) : (
                                <p className="text-lg text-gray-800">{user.name}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Email Address</label>
                            <p className="text-lg text-gray-800">{user.email}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Assigned Facility</label>
                            <p className="text-lg text-gray-800">{user.facilityName}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Role</label>
                            <p className="text-lg text-gray-800">{user.role}</p>
                        </div>
                        {isEditing && (
                            <div className="flex justify-end space-x-2 pt-2">
                                <button type="button" onClick={() => { setIsEditing(false); setName(user.name); }} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Save</button>
                            </div>
                        )}
                    </form>
                </div>
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Change Password</h2>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Current Password</label>
                            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">New Password</label>
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                            <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                        <div className="text-right">
                            <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary">Update Password</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;