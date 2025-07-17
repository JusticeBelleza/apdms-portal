import React, { useState } from "react";
import { Bell, LogOut, Calendar } from "lucide-react";
import { getMorbidityWeek } from "../../utils/helpers";
import NotificationDropdown from "./NotificationDropdown";

const Header = ({
  user,
  onLogout,
  notifications,
  unreadNotificationsCount,
  onMarkNotificationsAsRead,
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
          />
        </div>
        <button onClick={onLogout} className="p-2 rounded-full hover:bg-gray-200 md:hidden">
          <LogOut className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </header>
  );
};

export default Header;