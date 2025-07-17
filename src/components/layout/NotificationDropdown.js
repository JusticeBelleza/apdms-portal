import React, { useEffect, useRef } from "react";
import { Bell } from "lucide-react";

const NotificationDropdown = ({ isOpen, onClose, notifications = [] }) => {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !event.target.closest("button.relative.p-2")) {
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

  return (
    <div
      ref={dropdownRef}
      className={`absolute top-full right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-2xl border transition-all duration-300 ease-in-out ${
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      }`}
    >
      <div className="p-3 border-b">
        <h2 className="text-lg font-bold text-gray-800">Notifications</h2>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto p-3">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`p-3 rounded-lg relative hover:bg-gray-100 ${!notif.isRead ? "bg-teal-50" : "bg-gray-50"}`}
          >
            <div className="flex items-start">
              {!notif.isRead && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 mr-2 flex-shrink-0"></span>}
              <div className="flex-grow">
                <p className="font-semibold text-sm">{notif.title}</p>
                <p className="text-gray-700 text-sm">{notif.message}</p>
                <p className="text-xs mt-1 text-gray-500">
                  {notif.timestamp ? new Date(notif.timestamp.toDate()).toLocaleString() : "Just now"}
                </p>
              </div>
            </div>
          </div>
        ))}
        {(!notifications || notifications.length === 0) && (
          <div className="text-center text-gray-500 py-10">
            <Bell className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p>No new notifications.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;