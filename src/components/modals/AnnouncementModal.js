import React, { useState } from 'react';
import { X, Send } from 'lucide-react';

const AnnouncementModal = ({ isOpen, onClose, onPost }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handlePost = () => {
    if (!title.trim() || !message.trim()) {
      alert('Title and message cannot be empty.');
      return;
    }
    onPost(title, message);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200">
          <X className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Create Announcement</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              placeholder="e.g., System Maintenance"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="5"
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              placeholder="Enter your announcement details here..."
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={handlePost}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
          >
            <Send className="w-4 h-4 mr-2" />
            Post Announcement
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;