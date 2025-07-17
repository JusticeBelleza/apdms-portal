import React, { useState } from "react";
import { Bell, LogOut, Calendar, Megaphone } from "lucide-react";
import { getMorbidityWeek } from "../../utils/helpers";
import NotificationDropdown from "./NotificationDropdown";
// The AnnouncementModal is no longer rendered here, so we don't need to import it.

const Header = ({
  user,
  onLogout,
  notifications,
  unreadNotificationsCount,
  onMarkNotificationsAsRead,
  onClearAllNotifications,
  onAddAnnouncement, // This prop now correctly triggers the modal in App.js
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleToggleDropdown = () => {
    if (!isDropdownOpen && unreadNotificationsCount > 0) {
      onMarkNotificationsAsRead();
    }
    setIsDropdownOpen((prev) => !prev);
  };

  return (
    <header className="flex items-center justify-between h-auto md:h-20 p-2 sm:p-4 bg-white border-b relative z-30">
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-gray-800 truncate">Welcome, {user.name}!</h2>
        <p className="text-xs sm:text-sm text-gray-500">
          <span className="hidden sm:inline">{user.facilityName} - </span>
          <span>{user.role}</span>
        </p>
        <div className="flex items-center text-xs text-gray-500 mt-1">
          <Calendar className="w-4 h-4 mr-1.5" />
          <span>Morbidity Week: {getMorbidityWeek()}</span>
        </div>
      </div>
      <div className="flex items-center space-x-1 sm:space-x-2">
        {/* Announce Button for Super Admin */}
        {user.role === 'Super Admin' && (
          <button
            onClick={onAddAnnouncement} // This calls the function from App.js to open the modal
            className="relative p-2 rounded-full hover:bg-gray-200"
            title="Create Announcement"
          >
            <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
          </button>
        )}

        <div className="relative">
          <button onClick={handleToggleDropdown} className="relative p-2 rounded-full hover:bg-gray-200">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            )}
          </button>
          <NotificationDropdown
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            notifications={notifications}
            onClear={onClearAllNotifications}
          />
        </div>
        <button onClick={onLogout} className="p-2 rounded-full hover:bg-gray-200 md:hidden">
          <LogOut className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      {/* The AnnouncementModal is now rendered in App.js, not here */}
    </header>
  );
};

export default Header;
