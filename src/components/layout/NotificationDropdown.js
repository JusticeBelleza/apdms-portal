// src/components/layout/NotificationDropdown.js
import React, { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

const NotificationDropdown = ({ isOpen, onClose, announcements, user, onSave, onDelete }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const dropdownRef = useRef(null);

    // Effect to handle clicks outside the dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !event.target.closest('button > svg.lucide-bell')) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);


    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            alert("Title and message cannot be empty.");
            return;
        }
        onSave(title, message);
        setTitle('');
        setMessage('');
    };

    return (
        <div
            ref={dropdownRef}
            className={`absolute top-full right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-2xl border transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
        >
            <div className="p-3 border-b">
                 <h2 className="text-lg font-bold text-gray-800">Notifications</h2>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto p-3">
                {announcements.map(ann => (
                    <div key={ann.id} className="bg-gray-50 p-3 rounded-lg relative hover:bg-gray-100">
                         <p className="font-semibold text-sm">{ann.title}</p>
                         <p className="text-gray-700 text-sm">{ann.message}</p>
                         <p className="text-xs mt-1 text-gray-500">
                             {ann.author} - {new Date(ann.timestamp?.toDate()).toLocaleDateString()}
                         </p>
                         {user.role === 'Super Admin' && (
                            <button onClick={() => onDelete(ann.id)} className="absolute top-1 right-1 p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100">
                                <Trash2 className="w-3 h-3" />
                            </button>
                         )}
                    </div>
                ))}
                {announcements.length === 0 && <p className="text-center text-gray-500 py-4">No new announcements.</p>}
            </div>
             {user.role === 'Super Admin' && (
                <form onSubmit={handleSubmit} className="space-y-3 p-3 border-t">
                    <h3 className="text-md font-semibold">New Announcement</h3>
                    <div>
                        <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full text-sm py-1 px-2 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                    <div>
                        <textarea placeholder="Message..." value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1 block w-full text-sm py-1 px-2 border border-gray-300 rounded-md shadow-sm" rows="2" required></textarea>
                    </div>
                    <div className="text-right">
                        <button type="submit" className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Post</button>
                    </div>
                </form>
             )}
        </div>
    );
};

export default NotificationDropdown;